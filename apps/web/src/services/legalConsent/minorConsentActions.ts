"use server";

import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { computeTermsDocumentHash } from "./consentShared";

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
