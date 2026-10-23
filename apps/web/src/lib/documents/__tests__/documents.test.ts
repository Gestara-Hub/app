import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { GeneratedReportData } from "@gestarahub/contracts";
import { documentToCsv } from "../csv";
import { DocumentPdf } from "../document-pdf";
import { paymentReceiptDocument } from "../payment-receipt";
import { reportToDocument } from "../report-documents";

// Documentos (relatorios, comprovante): o mesmo modelo vira CSV e PDF.
// DOCUMENTS_OUT=<pasta> grava os PDFs para conferir o layout a olho.

const header = {
  organizationName: "Academia Exemplo",
  organizationSegment: "Lutas",
  unitName: "Unidade Centro",
  generatedAt: "2026-10-23T10:30:00.000Z",
  generatedBy: "Dono do espaço",
  periodLabel: "Outubro de 2026",
};

const roster: GeneratedReportData = {
  type: "students_roster",
  data: {
    header,
    totalActive: 2,
    totalPaused: 1,
    totalInactive: 0,
    rows: [
      { id: "s1", name: "Ana Souza", phone: "+5511987654321", planName: "Mensal 3x", dueDay: 10, status: "active", belt: "Azul", enrolledAt: "2025-03-02" },
      { id: "s2", name: "Bruno Lima", phone: "+5511912345678", planName: "Mensal livre", dueDay: 5, status: "active", enrolledAt: "2026-01-15" },
      { id: "s3", name: "Carla Dias", phone: "", planName: "Trimestral", dueDay: 20, status: "paused", belt: "Branca", enrolledAt: "2024-08-01" },
    ],
  },
};

const logo = {
  src: `data:image/png;base64,${readFileSync(path.join(process.cwd(), "public", "documents", "gestarahub-logo.png")).toString("base64")}`,
};

async function pdf(model: NonNullable<ReturnType<typeof reportToDocument>>, name: string) {
  const buffer = await renderToBuffer(createElement(DocumentPdf, { model, logo }) as never);
  if (process.env.DOCUMENTS_OUT) writeFileSync(path.join(process.env.DOCUMENTS_OUT, `${name}.pdf`), buffer);
  return buffer;
}

describe("documentos", () => {
  it("relação de alunos vira CSV com cabeçalho, linhas e situação", () => {
    const model = reportToDocument(roster, "2026-10", { levelLabel: "Faixa" });
    expect(model?.fileName).toBe("relatorio-alunos-2026-10");
    const csv = documentToCsv(model!);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Aluno";"Telefone";"Plano";"Vencimento";"Situação";"Faixa";"Cadastro"');
    expect(csv).toContain('"Ana Souza"');
    expect(csv).toContain('"Trancado"');
  });

  it("relação de alunos vira PDF", async () => {
    const model = reportToDocument(roster, "2026-10", { levelLabel: "Faixa" })!;
    const buffer = await pdf(model, "relatorio-alunos");
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("comprovante de pagamento vira PDF", async () => {
    const model = paymentReceiptDocument({
      code: "ABC123",
      organizationName: "Academia Exemplo",
      label: "Mensalidade de outubro",
      amountCents: 18990,
      paidAt: "2026-10-20T14:05:00.000Z",
      methodLabel: "Pix",
      competenceLabel: "Outubro de 2026",
      issuedAt: "2026-10-23T10:30:00.000Z",
    });
    expect(model.fileName).toBe("comprovante-ABC123");
    const buffer = await pdf(model, "comprovante");
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
