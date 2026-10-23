"use server";

import crypto from "node:crypto";
import { headers, cookies } from "next/headers";
import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { SESSION_COOKIE, SESSION_MAX_AGE, encodeSession } from "@/lib/session";
import { sendWelcomeEmail } from "@/lib/email/mailersend";
import {
  CURRENT_PLATFORM_TERMS_VERSION,
  type ConsentType,
  type LegalConsentResult,
  type RecordLegalConsentInput,
  type UserView,
} from "@gestarahub/contracts";

/**
 * Calcula o hash SHA-256 do documento para garantia de integridade probatória perante a ANPD / Judiciário.
 */
function computeTermsDocumentHash(
  version: string,
  content = `GestaraHub Platform Terms of Use and Privacy Policy (LGPD) - Version ${version}`,
): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

async function resolveAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Dominios reservados (demonstracao e e2e): nunca recebem e-mail de verdade. */
const RESERVED_EMAIL_DOMAIN = /\.(test|example|invalid|localhost)$/i;

/** Boas-vindas so no 1o aceite dos termos e so para o dono do espaco. */
async function sendWelcomeOnFirstAcceptance(userId: string, appUrl: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: dbUser }, { count }] = await Promise.all([
      admin.from("users").select("name, email, profile").eq("id", userId).maybeSingle(),
      admin
        .from("legal_consents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("consent_type", "platform_terms"),
    ]);
    if (!dbUser?.email || dbUser.profile !== "owner" || count !== 1) return;
    if (RESERVED_EMAIL_DOMAIN.test(dbUser.email as string)) return;
    const sent = await sendWelcomeEmail({
      toEmail: dbUser.email as string,
      toName: (dbUser.name as string) || "",
      appUrl,
    });
    if (!sent.ok) console.warn("[recordLegalConsentAction] Boas-vindas não enviadas:", sent.error);
  } catch (err) {
    console.error("[recordLegalConsentAction] Erro ao enviar boas-vindas:", err);
  }
}

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

export interface ConfirmMinorConsentInput {
  studentId: string;
  guardianName?: string;
  guardianPhone?: string;
  relationship?: string;
}

/**
 * Registra a confirmação de consentimento de menor efetuada diretamente pelo responsável
 * através do link público no WhatsApp, capturando IP, User-Agent e carimbo temporal UTC.
 * Atende o Artigo 14 da Lei 13.709/2018 (LGPD).
 */
export async function confirmMinorConsentAction(
  input: ConfirmMinorConsentInput,
): Promise<{ success: boolean; error?: string }> {
  const headerList = await headers();
  const rawIp =
    headerList.get("x-forwarded-for") ||
    headerList.get("x-real-ip") ||
    "127.0.0.1";
  const ipAddress = rawIp.split(",")[0].trim();
  const userAgent = headerList.get("user-agent") || "unknown";

  const adminClient = createSupabaseAdminClient();

  const { data: student, error: studentErr } = await adminClient
    .from("clients")
    .select("id, organization_id, name, guardians")
    .eq("id", input.studentId)
    .maybeSingle();

  if (studentErr || !student) {
    return { success: false, error: "Aluno não encontrado." };
  }

  const acceptedAt = new Date().toISOString();
  const guardiansList = Array.isArray(student.guardians) ? student.guardians : [];
  const guardianName =
    input.guardianName ||
    (guardiansList[0] as { name?: string })?.name ||
    "Responsável Legal";

  const documentHash = computeTermsDocumentHash(
    "minor-consent-v1.0",
    `Autorização de Matrícula e Tratamento de Dados de Menor (Art. 14 da LGPD) - Aluno ${student.name} - Responsável ${guardianName}`,
  );

  const metadata = {
    studentId: student.id,
    studentName: student.name,
    guardianName,
    guardianPhone: input.guardianPhone,
    relationship: input.relationship,
    channel: "whatsapp_online",
  };

  // 1. Grava evidência probatória em legal_consents
  await adminClient.from("legal_consents").insert({
    organization_id: student.organization_id,
    user_id: `guardian-${student.id}`,
    consent_type: "minor_guardian",
    terms_version: "minor-consent-v1.0",
    ip_address: ipAddress,
    user_agent: userAgent,
    document_hash: documentHash,
    metadata,
  });

  // 2. Atualiza status no registro do aluno
  await adminClient
    .from("clients")
    .update({
      minor_consent_status: "confirmed_whatsapp",
      minor_consent_at: acceptedAt,
      minor_consent_by: guardianName,
      minor_consent_evidence: {
        ipAddress,
        userAgent,
        method: "whatsapp_online",
        acceptedAt,
      },
    })
    .eq("id", student.id);

  return { success: true };
}

/**
 * Registra que o responsável assinou fisicamente uma ficha de matrícula / termo em papel no balcão.
 */
export async function confirmPaperMinorConsentAction(
  studentId: string,
  guardianName?: string,
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Não autorizado." };
  }

  const adminClient = createSupabaseAdminClient();
  const acceptedAt = new Date().toISOString();

  await adminClient
    .from("clients")
    .update({
      minor_consent_status: "confirmed_paper",
      minor_consent_at: acceptedAt,
      minor_consent_by: guardianName || "Responsável (termo em papel)",
      minor_consent_evidence: {
        recordedByUserId: currentUser.id,
        recordedByUserName: currentUser.name,
        method: "paper",
        acceptedAt,
      },
    })
    .eq("id", studentId);

  return { success: true };
}

/**
 * Consulta pública para a página de autorização aberta pelo pai no celular.
 */
export async function getPublicMinorConsentDetailsAction(studentId: string): Promise<{
  success: boolean;
  student?: {
    id: string;
    name: string;
    birthDate?: string;
    guardians?: Array<{ name: string; relationship?: string; phone?: string }>;
    minorConsentStatus?: string;
    organizationName: string;
  };
  error?: string;
}> {
  const adminClient = createSupabaseAdminClient();
  const { data: student, error } = await adminClient
    .from("clients")
    .select("id, organization_id, name, birth_date, guardians, minor_consent_status")
    .eq("id", studentId)
    .maybeSingle();

  if (error || !student) {
    return { success: false, error: "Aluno não encontrado." };
  }

  const { data: org } = await adminClient
    .from("organizations")
    .select("name")
    .eq("id", student.organization_id)
    .maybeSingle();

  const guardiansList = Array.isArray(student.guardians)
    ? (student.guardians as Array<{ name: string; relationship?: string; phone?: string }>)
    : [];

  return {
    success: true,
    student: {
      id: student.id,
      name: student.name,
      birthDate: student.birth_date ? String(student.birth_date) : undefined,
      guardians: guardiansList,
      minorConsentStatus: student.minor_consent_status as string,
      organizationName: org?.name || "Espaço de Aulas",
    },
  };
}

