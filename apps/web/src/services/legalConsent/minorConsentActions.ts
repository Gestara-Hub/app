"use server";

import { requireTenant } from "@/services/server/tenant";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { computeTermsDocumentHash } from "./consentShared";
import { maskBirthDate, maskPersonName } from "@gestarahub/core/privacy";

/**
 * Autorizacao do responsavel pelo aluno menor (LGPD art. 14): pelo link, no papel e a pagina publica.
 */

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

  // Pagina publica (auditoria de 30/10/2026): limite por IP, so registra o que
  // ainda esta pendente (nao sobrescreve uma autorizacao dada) e texto com tamanho maximo.
  if (!(await checkRateLimit({ key: `minor_consent:${ipAddress}`, maxRequests: 10, windowSeconds: 3600 }))) {
    return { success: false, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }
  const tooLong = (value: string | undefined, max: number) => (value ?? "").trim().length > max;
  if (tooLong(input.guardianName, 120) || tooLong(input.guardianPhone, 20) || tooLong(input.relationship, 60)) {
    return { success: false, error: "Confira os dados digitados." };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: student, error: studentErr } = await adminClient
    .from("clients")
    .select("id, organization_id, name, guardians, minor_consent_status")
    .eq("id", input.studentId)
    .maybeSingle();

  if (studentErr || !student) {
    return { success: false, error: "Aluno não encontrado." };
  }
  if (student.minor_consent_status === "confirmed_whatsapp" || student.minor_consent_status === "confirmed_paper") {
    return { success: false, error: "A autorização deste aluno já está registrada." };
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
    .eq("id", student.id)
    .not("minor_consent_status", "in", "(confirmed_whatsapp,confirmed_paper)");

  return { success: true };
}

/**
 * Registra que o responsável assinou fisicamente uma ficha de matrícula / termo em papel no balcão.
 */
export async function confirmPaperMinorConsentAction(
  studentId: string,
  guardianName?: string,
): Promise<{ success: boolean; error?: string }> {
  // Quem registra vem da sessao do Supabase, com permissao de alunos, e so no
  // aluno do proprio espaco (antes: qualquer aluno de qualquer espaco, so com o
  // cookie do app; auditoria de 30/10/2026).
  let ctx: Awaited<ReturnType<typeof requireTenant>>;
  try {
    ctx = await requireTenant();
    ctx.require("clients:manage");
  } catch {
    return { success: false, error: "Não autorizado." };
  }
  const currentUser = await getCurrentUser();

  const adminClient = createSupabaseAdminClient();
  const acceptedAt = new Date().toISOString();

  const { data: updated, error } = await adminClient
    .from("clients")
    .update({
      minor_consent_status: "confirmed_paper",
      minor_consent_at: acceptedAt,
      minor_consent_by: guardianName || "Responsável (termo em papel)",
      minor_consent_evidence: {
        recordedByUserId: ctx.userId,
        recordedByUserName: currentUser?.name ?? "",
        method: "paper",
        acceptedAt,
      },
    })
    .eq("id", studentId)
    .eq("organization_id", ctx.organizationId)
    .select("id");

  if (error || !updated || updated.length === 0) return { success: false, error: "Aluno não encontrado." };
  return { success: true };
}

/**
 * Consulta pública para a página de autorização aberta pelo pai no celular.
 */
/**
 * Dados do termo publico do responsavel (/consent/minor/<aluno>), aberto sem
 * login por quem tiver o link: tudo mascarado no servidor (doc product/24,
 * "Rotas publicas"). O nome inteiro, a data de nascimento e o telefone nunca
 * vao para a pagina.
 */
export async function getPublicMinorConsentDetailsAction(studentId: string): Promise<{
  success: boolean;
  student?: {
    id: string;
    /** Mascarado: "Gabi S." */
    name: string;
    /** So o ano: "**\/**\/2015". */
    birthDateMasked?: string;
    /** Responsaveis cadastrados, so o nome mascarado (para quem assina se reconhecer). */
    guardians?: Array<{ nameMasked: string; relationship?: string }>;
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
    ? (student.guardians as Array<{ name?: string; relationship?: string }>)
    : [];

  return {
    success: true,
    student: {
      id: student.id,
      name: maskPersonName(String(student.name ?? "")),
      birthDateMasked: maskBirthDate(student.birth_date ? String(student.birth_date) : undefined),
      guardians: guardiansList
        .filter((g) => g?.name)
        .map((g) => ({ nameMasked: maskPersonName(g.name), ...(g.relationship ? { relationship: g.relationship } : {}) })),
      minorConsentStatus: student.minor_consent_status as string,
      organizationName: org?.name || "Espaço de Aulas",
    },
  };
}
