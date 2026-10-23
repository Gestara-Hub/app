import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { CertificateLayout, CourseCertificate, DocumentModel } from "@gestarahub/contracts";
import { CERTIFICATE_ACCENT_HEX, defaultCertificateTemplate, renderCertificate } from "@gestarahub/core/certificate";
import { CertificatePdf } from "../certificate-pdf";
import { documentToCsv } from "../csv";
import { DocumentPdf } from "../document-pdf";
import { paymentRecordDocument, paymentsStatementDocument, receiptNumber, teacherStatementDocument } from "../payment-documents";

// Recibo, declaracao anual, demonstrativo do professor e certificado.
// DOCUMENTS_OUT=<pasta> grava os PDFs para conferir o layout a olho.

const logo = {
  src: `data:image/png;base64,${readFileSync(path.join(process.cwd(), "public", "documents", "gestarahub-logo.png")).toString("base64")}`,
};
const ISSUED = "2026-10-23T10:30:00.000Z";

function save(name: string, buffer: Buffer) {
  if (process.env.DOCUMENTS_OUT) writeFileSync(path.join(process.env.DOCUMENTS_OUT, `${name}.pdf`), buffer);
  return buffer;
}

async function pdf(model: DocumentModel) {
  return save(model.fileName, await renderToBuffer(createElement(DocumentPdf, { model, logo }) as never));
}

describe("documentos de pagamento", () => {
  it("recibo cita o pagador, o CPF e o valor", async () => {
    const model = paymentRecordDocument({
      chargeId: "3f2a9c1e-0000-4000-8000-000000000000",
      organizationName: "Academia Exemplo",
      organizationDetails: "Unidade Centro",
      payer: { name: "Marta Souza", cpf: "52998224725" },
      studentName: "Ana Souza",
      label: "Mensalidade",
      competenceLabel: "out/2026",
      amountCents: 18990,
      paidAt: "2026-10-05T13:00:00.000Z",
      methodLabel: "Dinheiro",
      issuedAt: ISSUED,
    });
    expect(receiptNumber("3f2a9c1e-0000")).toBe("3F2A9C1E");
    const text = model.blocks[0];
    expect(text.type === "text" && text.text).toContain("Marta Souza (CPF 529.982.247-25)");
    expect(text.type === "text" && text.text).toMatch(/R\$\s189,90/);
    expect((await pdf(model)).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("declaração soma os pagamentos do ano", async () => {
    const model = paymentsStatementDocument({
      organizationName: "Academia Exemplo",
      studentName: "Ana Souza",
      payer: { name: "Ana Souza", cpf: "52998224725" },
      year: 2026,
      rows: [
        { paidAt: "2026-01-05T13:00:00.000Z", label: "Mensalidade · jan/2026", methodLabel: "Pix", amountCents: 18990 },
        { paidAt: "2026-02-05T13:00:00.000Z", label: "Mensalidade · fev/2026", methodLabel: "Dinheiro", amountCents: 18990 },
      ],
      issuedAt: ISSUED,
      fileKey: "ana",
    });
    expect(documentToCsv(model)).toContain('"Total";"";"379,80"');
    expect((await pdf(model)).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("demonstrativo do professor traz cálculo e aulas", async () => {
    const model = teacherStatementDocument({
      organizationName: "Academia Exemplo",
      professionalName: "Rafael Lima",
      competence: "2026-10",
      competenceLabel: "Outubro de 2026",
      statusLabel: "Pago",
      ruleSummary: "R$ 60,00 por aula + 30% do que os alunos pagaram",
      dueDate: "2026-11-05",
      paidAt: "2026-11-05T12:00:00.000Z",
      methodLabel: "Pix",
      lines: [
        { label: "12 aulas × R$ 60,00", quantity: 12, amountCents: 72000 },
        { label: "30% de R$ 1.500,00 em mensalidades", baseCents: 150000, amountCents: 45000 },
        { label: "Vale", amountCents: -10000 },
      ],
      totalCents: 107000,
      sessions: [
        { date: "2026-10-01", start: "19:00", className: "Jiu-jitsu adulto" },
        { date: "2026-10-03", start: "08:00", className: "Kids", substituting: "Paula Reis" },
      ],
      issuedAt: ISSUED,
      fileKey: "rafael",
    });
    expect(model.fileName).toBe("demonstrativo-rafael-2026-10");
    expect((await pdf(model)).subarray(0, 4).toString()).toBe("%PDF");
  });

  it.each(["classic", "modern", "minimal"] as CertificateLayout[])("certificado %s vira PDF", async (layout) => {
    const certificate: CourseCertificate = {
      enrollmentId: "e1",
      classGroupId: "c1",
      organizationName: "Academia Exemplo",
      studentName: "Ana Souza",
      courseName: "Confeitaria básica",
      startDate: "2026-08-03",
      endDate: "2026-10-30",
      lessonsCount: 12,
      workloadMinutes: 1440,
      attendancePercent: 92,
      instructorName: "Carla Dias",
      city: "São Paulo",
      issuedOn: "2026-10-31",
    };
    const template = { ...defaultCertificateTemplate(), layout, accentColor: "navy" as const };
    const buffer = await renderToBuffer(
      createElement(CertificatePdf, {
        text: renderCertificate(certificate, template),
        layout,
        organizationName: certificate.organizationName,
        accent: CERTIFICATE_ACCENT_HEX.navy,
        logo,
      }) as never,
    );
    save(`certificado-${layout}`, buffer);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
