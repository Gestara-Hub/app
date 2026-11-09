import type { CertificateVerification, CourseCertificate, GraduationCertificate } from "@gestarahub/contracts";
import { normalizeCertificateCode } from "@gestarahub/core/certificate";
import { maskPersonName } from "@gestarahub/core/privacy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

/**
 * Pagina publica do certificado (/p/certificado/<codigo>, doc 21 §1.3): confirma
 * que o certificado existe e vale, com os dados do momento da emissao. Pagina
 * publica: o nome sai mascarado ("Ana S."), nada mais da pessoa, e nada e
 * gravado (doc product/24 §6). Codigo desconhecido: null.
 */
export async function loadCertificatePage(input: string): Promise<CertificateVerification | null> {
  const code = normalizeCertificateCode(input);
  if (!code) return null;
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("issued_certificates")
      .select("code, status, kind, snapshot")
      .eq("code", code)
      .maybeSingle();
    if (!data) return null;
    const status = data.status === "canceled" ? "canceled" : "valid";
    if (data.kind === "graduation") {
      const snapshot = data.snapshot as GraduationCertificate;
      return {
        kind: "graduation",
        code: String(data.code),
        status,
        studentName: maskPersonName(snapshot.studentName),
        modalityName: snapshot.modalityName,
        organizationName: snapshot.organizationName,
        levelName: snapshot.levelName,
        ...(snapshot.previousLevelName ? { previousLevelName: snapshot.previousLevelName } : {}),
        graduatedOn: snapshot.graduatedOn,
        issuedOn: snapshot.issuedOn,
      };
    }
    const snapshot = data.snapshot as CourseCertificate;
    return {
      // Participacao em evento (doc product/29): mesmos campos, com o nome do evento em `courseName`.
      kind: data.kind === "event" ? "event" : "course",
      code: String(data.code),
      status,
      studentName: maskPersonName(snapshot.studentName),
      courseName: snapshot.courseName,
      ...(snapshot.modalityName ? { modalityName: snapshot.modalityName } : {}),
      organizationName: snapshot.organizationName,
      startDate: snapshot.startDate,
      endDate: snapshot.endDate,
      lessonsCount: snapshot.lessonsCount,
      workloadMinutes: snapshot.workloadMinutes,
      attendancePercent: snapshot.attendancePercent,
      issuedOn: snapshot.issuedOn,
    };
  } catch (error) {
    logError("[certificatePage] Erro ao carregar o certificado:", error);
    return null;
  }
}
