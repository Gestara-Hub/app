"use server";

import { headers, cookies } from "next/headers";
import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { SESSION_COOKIE, SESSION_MAX_AGE, encodeSession } from "@/lib/session";
import {
  CURRENT_PLATFORM_TERMS_VERSION,
  type ConsentType,
  type LegalConsentResult,
  type RecordLegalConsentInput,
  type UserView,
} from "@gestarahub/contracts";
import { computeTermsDocumentHash, resolveAppBaseUrl, sendWelcomeOnFirstAcceptance } from "./consentShared";

/**
 * Aceite dos termos da plataforma: registrar e conferir.
 */

/**
 * Registra o consentimento eletrônico com evidências probatórias completas
 * (IP, User-Agent, Data/Hora UTC, Hash SHA-256 do Documento e Identificação do Usuário/Organização).
 * Atende LGPD (Lei 13.709/2018 Art. 8 §2) e Marco Civil da Internet (Lei 12.965/2014 Arts. 10 e 15).
 */
export async function recordLegalConsentAction(
  input: RecordLegalConsentInput,
): Promise<LegalConsentResult> {
  const headerList = await headers();
  const rawIp =
    headerList.get("x-forwarded-for") ||
    headerList.get("x-real-ip") ||
    "127.0.0.1";
  const ipAddress = rawIp.split(",")[0].trim();
  const userAgent = headerList.get("user-agent") || "unknown";

  const currentUser = await getCurrentUser();
  const userId = input.userId || currentUser?.id;
  const organizationId = input.organizationId || currentUser?.organizationId;

  if (!userId || !organizationId) {
    return {
      success: false,
      error:
        "Usuário ou organização não autenticados para registro de consentimento.",
    };
  }

  const documentHash =
    input.documentHash || computeTermsDocumentHash(input.termsVersion);

  const enrichedMetadata = {
    email: currentUser?.email,
    userName: currentUser?.name,
    userProfile: currentUser?.profile,
    recordedAtUtc: new Date().toISOString(),
    source: input.metadata?.source || "first_login_modal",
    ...input.metadata,
  };

  const adminClient = createSupabaseAdminClient();

  const { data, error } = await adminClient
    .from("legal_consents")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      consent_type: input.consentType,
      terms_version: input.termsVersion,
      ip_address: ipAddress,
      user_agent: userAgent,
      document_hash: documentHash,
      metadata: enrichedMetadata,
    })
    .select("id, accepted_at")
    .single();

  if (error || !data) {
    console.error(
      "[recordLegalConsentAction] Erro ao gravar consentimento:",
      error,
    );
    return {
      success: false,
      error: "Erro ao gravar consentimento no banco de dados.",
    };
  }

  // Se for o aceite geral da plataforma, atualiza na tabela users para acesso rápido
  if (input.consentType === "platform_terms") {
    try {
      await adminClient
        .from("users")
        .update({
          terms_accepted_at: data.accepted_at,
          terms_version: input.termsVersion,
        })
        .eq("id", userId);
    } catch (updateErr) {
      console.warn(
        "[recordLegalConsentAction] Aviso ao atualizar public.users:",
        updateErr,
      );
    }

    // Atualiza imediatamente as claims da sessão ativa no cookie para refletir no server e client sem logout
    if (currentUser && currentUser.id === userId) {
      try {
        const updatedUser: UserView = {
          ...currentUser,
          termsAcceptedAt: data.accepted_at,
          termsVersion: input.termsVersion,
        };
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE, encodeSession(updatedUser), {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_MAX_AGE,
        });
      } catch (cookieErr) {
        console.warn(
          "[recordLegalConsentAction] Aviso ao atualizar cookie de sessão:",
          cookieErr,
        );
      }
    }

    // Primeiro aceite do dono: boas-vindas depois da resposta (nao atrasa nem
    // trava a entrada). Versao nova dos termos e convidados nao recebem.
    const appUrl = await resolveAppBaseUrl();
    after(() => sendWelcomeOnFirstAcceptance(userId, appUrl));
  }

  return {
    success: true,
    consentId: data.id,
    acceptedAt: data.accepted_at,
  };
}

/**
 * Consulta se o usuário já aceitou a versão vigente dos termos especificados.
 */
export async function checkUserLegalConsentAction(
  userId?: string,
  consentType: ConsentType = "platform_terms",
  requiredVersion = CURRENT_PLATFORM_TERMS_VERSION,
): Promise<{ accepted: boolean; acceptedAt?: string }> {
  let targetUserId = userId;
  const currentUser = await getCurrentUser();
  if (!targetUserId) {
    targetUserId = currentUser?.id;
  }

  if (!targetUserId) {
    return { accepted: false };
  }

  // Fast check: se o snapshot da sessão do usuário logado já tiver o aceite vigente
  if (
    consentType === "platform_terms" &&
    currentUser?.id === targetUserId &&
    currentUser.termsAcceptedAt &&
    currentUser.termsVersion === requiredVersion
  ) {
    return { accepted: true, acceptedAt: currentUser.termsAcceptedAt };
  }

  const adminClient = createSupabaseAdminClient();
  const { data } = await adminClient
    .from("legal_consents")
    .select("accepted_at")
    .eq("user_id", targetUserId)
    .eq("consent_type", consentType)
    .eq("terms_version", requiredVersion)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    accepted: Boolean(data),
    acceptedAt: data?.accepted_at,
  };
}
