import { renderToBuffer } from "@react-pdf/renderer";
import type { Id } from "@gestarahub/contracts";
import { CERTIFICATE_ACCENT_HEX, renderCertificate } from "@gestarahub/core/certificate";
import { CertificatePdf } from "@/lib/documents/certificate-pdf";
import { courseCertificateService } from "../classes/courseCertificateService";
import { runInWorld } from "../world/runWorld";
import { documentSlices } from "./documentSlices";
import { loadSpaceLogo } from "./documents";
import type { TenantContext } from "./tenant";

/**
 * Certificado de conclusao em PDF, no servidor: os mesmos dados e o mesmo
 * modelo do espaco da tela (o servico confere o plano e se o curso terminou).
 * Logo so a do espaco, como na folha da tela. Modulo so do servidor.
 */
export async function renderCertificatePdf(
  ctx: TenantContext,
  enrollmentId: Id,
): Promise<{ pdf: Buffer; fileName: string }> {
  const sheet = await runInWorld(ctx, () => courseCertificateService.getCourseCertificate(enrollmentId), {
    fn: documentSlices.certificate,
    args: [enrollmentId],
  });
  const { certificate, template } = sheet;
  const text = renderCertificate(certificate, template);
  const logo = template.logoFileId ? await loadSpaceLogo(ctx.organizationId) : null;
  const pdf = await renderToBuffer(
    <CertificatePdf
      text={text}
      layout={template.layout}
      organizationName={certificate.organizationName}
      accent={CERTIFICATE_ACCENT_HEX[template.accentColor] ?? CERTIFICATE_ACCENT_HEX.graphite}
      logo={logo}
    />,
  );
  const slug = certificate.studentName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return { pdf, fileName: `certificado-${slug || certificate.enrollmentId.slice(0, 8)}` };
}
