import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { DocumentModel } from "@gestarahub/contracts";
import { documentToCsv } from "../csv";
import { DocumentPdf } from "../document-pdf";
import { onlineStatementDocument } from "../payment-documents";
import { minorConsentDocument, reportCardDocument } from "../student-documents";

// Termo do responsavel, boletim e extrato da conta online.
// DOCUMENTS_OUT=<pasta> grava os PDFs para conferir o layout a olho.

const logo = {
  src: `data:image/png;base64,${readFileSync(path.join(process.cwd(), "public", "documents", "gestarahub-logo.png")).toString("base64")}`,
};
const ISSUED = "2026-10-23T10:30:00.000Z";

async function pdf(model: DocumentModel) {
  const buffer = await renderToBuffer(createElement(DocumentPdf, { model, logo }) as never);
  if (process.env.DOCUMENTS_OUT) writeFileSync(path.join(process.env.DOCUMENTS_OUT, `${model.fileName}.pdf`), buffer);
  return buffer;
}

describe("documentos do aluno", () => {
  it("termo traz as declarações e a autorização registrada", async () => {
    const model = minorConsentDocument({
      organizationName: "Academia Exemplo",
      studentName: "Leo Souza",
      birthDate: "2015-03-02",
      guardian: { name: "Marta Souza", relationship: "Mãe", phone: "+5511987654321" },
      confirmed: { method: "online", at: "2026-10-01T14:00:00.000Z", by: "Marta Souza" },
      issuedAt: ISSUED,
      fileKey: "leo",
    });
    const texts = model.blocks.flatMap((b) => (b.type === "text" ? [b.text] : []));
    expect(texts[0]).toContain("Leo Souza");
    expect(texts.at(-1)).toContain("Autorizado pelo link em 01/10/2026, 11:00, por Marta Souza");
    expect((await pdf(model)).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("termo em branco fica aguardando assinatura", () => {
    const model = minorConsentDocument({ organizationName: "Academia Exemplo", studentName: "Leo", issuedAt: ISSUED, fileKey: "leo" });
    expect(model.blocks.some((b) => b.type === "text" && b.text === "Aguardando a assinatura do responsável.")).toBe(true);
  });

  it("boletim traz trilha, notas e histórico", async () => {
    const model = reportCardDocument({
      organizationName: "Academia Exemplo",
      studentName: "Ana Souza",
      currentLevels: [{ modalityName: "Jiu-jitsu", label: "Azul · 2º grau", since: "2026-06-10" }],
      modalities: [
        {
          modalityName: "Jiu-jitsu",
          summary: "Média geral 7,8 · aprovação a partir de 6,0.",
          rows: [
            { date: "2026-10-10", name: "Prova técnica", className: "Adulto", levelName: "Azul", weight: 2, grade: "8,5" },
            { date: "2026-09-10", name: "Prova teórica", className: "Adulto", weight: 1, grade: "5,0", tone: "negative" },
            { date: "2026-08-10", name: "Simulado", className: "Adulto", weight: 1, grade: "Faltou", tone: "muted" },
          ],
        },
      ],
      promotions: [{ date: "2026-06-10", modalityName: "Jiu-jitsu", from: "Branca · 4º grau", to: "Azul", by: "Prof. Rafael" }],
      levelLabel: "Faixa",
      promotionLabel: "Graduação",
      issuedAt: ISSUED,
      fileKey: "ana",
    });
    expect(documentToCsv(model)).toContain('"Prova técnica"');
    expect((await pdf(model)).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("extrato online soma valor, taxas e líquido", async () => {
    const model = onlineStatementDocument({
      organizationName: "Academia Exemplo",
      competence: "2026-10",
      competenceLabel: "Outubro de 2026",
      rows: [
        { paidAt: "2026-10-05T13:00:00.000Z", studentName: "Ana Souza", label: "Mensalidade · out/2026", methodLabel: "Pix", amountCents: 15000, feeCents: 199, netCents: 14801, availability: "Disponível" },
        { paidAt: "2026-10-08T13:00:00.000Z", studentName: "Bruno Lima", label: "Curso Confeitaria", methodLabel: "Cartão de crédito", amountCents: 30000, feeCents: 1200, netCents: 28800, availability: "Libera em 09/11/2026" },
      ],
      issuedAt: ISSUED,
    });
    expect(documentToCsv(model)).toContain('"";"Total";"";"";"450,00";"13,99";"436,01";""');
    expect((await pdf(model)).subarray(0, 4).toString()).toBe("%PDF");
  });
});
