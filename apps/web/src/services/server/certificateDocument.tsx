import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { AnyCertificate, CertificateKind, CertificateTemplate, Id, SaveCertificateTemplate } from "@gestarahub/contracts";
import { CERTIFICATE_ACCENT_HEX, renderCertificate, validateCertificateTemplate } from "@gestarahub/core/certificate";
import { apiError, validationError } from "@gestarahub/core/api-error";
import { todayISO } from "@gestarahub/core/date";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { tierHasFeature, tierOf } from "@/lib/subscription";
import { sampleCertificate, sampleGraduationCertificate } from "@/features/certificates/certificate-meta";
import type { DocumentLogo } from "@/lib/documents/document-pdf";
import { CertificatePdf, CertificatesPdf, type CertificatePageProps } from "@/lib/documents/certificate-pdf";
import { courseCertificateService } from "../classes/courseCertificateService";
import { graduationCertificateService } from "../clients/graduationCertificateService";
import { runInWorld } from "../world/runWorld";
import { documentSlices } from "./documentSlices";
import { certificateLookupAddress, certificateVerifyUrl } from "@/features/certificates/certificate-verify";
import { loadSpaceImage } from "./documents";
import type { TenantContext } from "./tenant";

/**
 * Certificado de conclusao em PDF, no servidor: os mesmos dados e o mesmo
 * modelo do espaco da tela (o servico confere o plano e se o curso terminou).
 * Logo e arte de fundo so as do espaco, como na folha da tela. Modulo so do servidor.
 */
/** Logo e arte do modelo, em data URL, uma vez por PDF (o lote repete o mesmo modelo). */
async function loadTemplateImages(organizationId: string, template: CertificateTemplate) {
  // A logo do proprio modelo (o de graduacao pode ter outra), sempre da pasta do espaco.
  const logo = template.logoFileId ? await loadSpaceImage(organizationId, template.logoFileId) : null;
  const artwork =
    template.layout === "custom" && template.artwork ? await loadSpaceImage(organizationId, template.artwork.fileId) : null;
  return { logo, artwork };
}

/** Uma folha: texto do modelo, imagens e o rodape de verificacao (doc 21 §1.3). */
async function certificatePage(
  certificate: AnyCertificate,
  template: CertificateTemplate,
  images: { logo: DocumentLogo | null; artwork: DocumentLogo | null },
): Promise<CertificatePageProps> {
  const code = certificate.verificationCode;
  const verification = code
    ? {
        code,
        url: certificateVerifyUrl(code),
        qr: { src: await QRCode.toDataURL(certificateVerifyUrl(code), { margin: 0, width: 240 }) },
        lookup: certificateLookupAddress(),
      }
    : undefined;
  return {
    text: renderCertificate(certificate, template),
    layout: template.layout,
    organizationName: certificate.organizationName,
    accent: CERTIFICATE_ACCENT_HEX[template.accentColor] ?? CERTIFICATE_ACCENT_HEX.graphite,
    logo: images.logo,
    artwork: images.artwork,
    artworkSettings: template.artwork,
    verification,
  };
}

function slugOf(text: string, fallback: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

/**
 * Certificados de todos os concluidos da turma num PDF so (doc 21 §1.4), uma
 * folha por aluno; os cancelados ficam de fora. Emite quem ainda nao tinha.
 */
export async function renderClassCertificatesPdf(
  ctx: TenantContext,
  classGroupId: Id,
): Promise<{ pdf: Buffer; fileName: string }> {
  const batch = await runInWorld(ctx, () => courseCertificateService.issueCourseCertificates(classGroupId), {
    fn: documentSlices.certificates,
    args: [classGroupId],
  });
  const images = await loadTemplateImages(ctx.organizationId, batch.template);
  const pages = await Promise.all(
    batch.items.filter((item) => item.issued.status === "valid").map((item) => certificatePage(item.certificate, batch.template, images)),
  );
  const organizationName = batch.items[0]?.certificate.organizationName ?? "";
  const pdf = await renderToBuffer(<CertificatesPdf title={`Certificados · ${batch.className}`} organizationName={organizationName} pages={pages} />);
  return { pdf, fileName: `certificados-${slugOf(batch.className, batch.classGroupId.slice(0, 8))}` };
}

/** Certificado de graduacao em PDF (doc 21 §1.6): emite na 1a vez, como a tela. */
export async function renderGraduationCertificatePdf(
  ctx: TenantContext,
  studentId: Id,
  promotionId: Id,
): Promise<{ pdf: Buffer; fileName: string }> {
  const sheet = await runInWorld(ctx, () => graduationCertificateService.getGraduationCertificate(studentId, promotionId), {
    fn: documentSlices.graduationCertificate,
    args: [studentId, promotionId],
  });
  const { certificate, template } = sheet;
  const page = await certificatePage(certificate, template, await loadTemplateImages(ctx.organizationId, template));
  const pdf = await renderToBuffer(<CertificatePdf {...page} />);
  return { pdf, fileName: `certificado-graduacao-${slugOf(certificate.studentName, promotionId.slice(0, 8))}` };
}

export async function renderCertificatePdf(
  ctx: TenantContext,
  enrollmentId: Id,
): Promise<{ pdf: Buffer; fileName: string }> {
  const sheet = await runInWorld(ctx, () => courseCertificateService.getCourseCertificate(enrollmentId), {
    fn: documentSlices.certificate,
    args: [enrollmentId],
  });
  const { certificate, template } = sheet;
  const page = await certificatePage(certificate, template, await loadTemplateImages(ctx.organizationId, template));
  const pdf = await renderToBuffer(<CertificatePdf {...page} />);
  return { pdf, fileName: `certificado-${slugOf(certificate.studentName, certificate.enrollmentId.slice(0, 8))}` };
}

/**
 * Previa em PDF do modelo em edicao (botao "Ver em PDF" do editor): os dados
 * de exemplo da previa da tela com o modelo que veio do navegador, sem gravar
 * nada. Logo e arte so as ja salvas (arquivo novo aparece depois de salvar).
 * Mesmas regras do salvar (plano e validacao do modelo).
 */
export async function renderCertificatePreviewPdf(
  ctx: TenantContext,
  input: SaveCertificateTemplate,
  /** Um aluno de verdade no lugar dos dados de exemplo ("Previa com"): matricula concluida ou graduacao. */
  real: { kind?: CertificateKind; enrollmentId?: Id; studentId?: Id; promotionId?: Id } = {},
): Promise<{ pdf: Buffer; fileName: string }> {
  const kind: CertificateKind = real.kind === "graduation" ? "graduation" : "course";
  const admin = createSupabaseAdminClient();
  const [{ data: org }, { data: units }] = await Promise.all([
    admin.from("organizations").select("name, subscription").eq("id", ctx.organizationId).maybeSingle(),
    admin.from("units").select("address").eq("organization_id", ctx.organizationId).order("created_at", { ascending: true }).limit(1),
  ]);
  if (!tierHasFeature(tierOf({ subscription: org?.subscription ?? undefined }), "certificates")) {
    throw apiError("FEATURE_NOT_IN_PLAN", "Certificado de conclusão está disponível no Plano Profissional.", { httpStatus: 403 });
  }
  const template: CertificateTemplate = {
    layout: input.layout,
    accentColor: input.accentColor,
    title: String(input.title ?? ""),
    body: String(input.body ?? ""),
    signatures: Array.isArray(input.signatures) ? input.signatures.map((s) => ({ name: String(s.name ?? ""), role: String(s.role ?? "") })) : [],
    showAttendance: Boolean(input.showAttendance),
    ...(typeof input.logoFileId === "string" && input.logoFileId ? { logoFileId: input.logoFileId } : {}),
    ...(input.layout === "custom" && input.artwork ? { artwork: input.artwork } : {}),
  };
  const issues = validateCertificateTemplate(template, kind);
  if (issues.length > 0) throw validationError(issues);
  const address = units?.[0]?.address as { city?: string } | string | null | undefined;
  const sample = { organizationName: String(org?.name ?? ""), city: typeof address === "object" ? address?.city : undefined, today: todayISO() };
  const { enrollmentId, studentId, promotionId } = real;
  const certificate: AnyCertificate =
    kind === "graduation"
      ? studentId && promotionId
        ? await runInWorld(ctx, () => graduationCertificateService.previewGraduationCertificate(studentId, promotionId), {
            fn: documentSlices.graduationCertificatePreview,
            args: [studentId, promotionId],
          })
        : sampleGraduationCertificate(sample)
      : enrollmentId
        ? await runInWorld(ctx, () => courseCertificateService.previewCourseCertificate(enrollmentId), {
            fn: documentSlices.certificatePreview,
            args: [enrollmentId],
          })
        : sampleCertificate(sample);
  const page = await certificatePage(certificate, template, await loadTemplateImages(ctx.organizationId, template));
  const pdf = await renderToBuffer(<CertificatePdf {...page} />);
  return { pdf, fileName: "certificado-previa" };
}
