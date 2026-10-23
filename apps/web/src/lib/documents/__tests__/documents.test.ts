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

const others: GeneratedReportData[] = [
  {
    type: "attendance_sheet",
    data: {
      header, classGroupId: "c1", sessionId: "a1", classOptions: [{ id: "c1", name: "Jiu-jitsu adulto" }],
      sessionOptions: [{ id: "a1", date: "2026-10-20", start: "19:00" }], className: "Jiu-jitsu adulto",
      modalityName: "Jiu-jitsu", teacherName: "Prof. Rafael", sessionDate: "2026-10-20", sessionTime: "19:00",
      totalPresent: 2, totalAbsent: 1, totalJustified: 0, totalUnmarked: 1, occupancyRatePercent: 75,
      rows: [
        { studentId: "s1", studentName: "Ana Souza", belt: "Azul", status: "present" },
        { studentId: "s2", studentName: "Bruno Lima", status: "absent" },
        { studentId: "s3", studentName: "Carla Dias", belt: "Branca", status: "present" },
        { studentId: "s4", studentName: "Davi Rocha", status: "unmarked" },
      ],
    },
  },
  {
    type: "billing_statement",
    data: {
      header, totalBilledCents: 45000, totalReceivedCents: 30000, totalPendingCents: 5000, totalOverdueCents: 10000,
      defaultRatePercent: 22.2,
      rows: [
        { chargeId: "b1", studentName: "Ana Souza", amountCents: 15000, dueDate: "2026-10-10", status: "paid", paidAt: "2026-10-09T15:00:00.000Z", paymentMethod: "pix" },
        { chargeId: "b2", studentName: "Bruno Lima", amountCents: 15000, dueDate: "2026-10-05", status: "paid", paidAt: "2026-10-05T12:00:00.000Z", paymentMethod: "cash" },
        { chargeId: "b3", studentName: "Carla Dias", amountCents: 10000, dueDate: "2026-10-01", status: "overdue" },
        { chargeId: "b4", studentName: "Davi Rocha", amountCents: 5000, dueDate: "2026-10-28", status: "pending" },
      ],
    },
  },
  {
    type: "course_summary",
    data: {
      header, totalContractedCents: 120000, totalReceivedCents: 80000, totalOpenCents: 40000, receivedInPeriodCents: 20000,
      rows: [
        { classGroupId: "k1", className: "Curso de violão iniciante", teacherName: "Prof. Lia", startDate: "2026-09-01", endDate: "2026-11-30", enrolled: 6, completed: 0, canceled: 1, contractedCents: 120000, receivedCents: 80000, openCents: 40000 },
      ],
    },
  },
  {
    type: "package_summary",
    data: {
      header, totalSold: 3, totalLessonsUsed: 14, totalLessonsRemaining: 16, totalReceivedCents: 90000,
      rows: [{ packageId: "p1", packageName: "Pacote 10 aulas", sold: 3, lessonsSold: 30, lessonsUsed: 14, lessonsRemaining: 16, receivedCents: 90000 }],
    },
  },
  {
    type: "monthly_birthdays",
    data: {
      header, monthName: "Outubro", totalBirthdays: 1,
      rows: [{ id: "s1", name: "Ana Souza", phone: "+5511987654321", birthDate: "1995-10-12", day: 12, planName: "Mensal 3x" }],
    },
  },
  {
    type: "financial_income_statement",
    data: {
      header, grossRevenueCents: 500000, deductionsCents: 12000, netRevenueCents: 488000, operatingExpensesCents: 300000,
      operationalResultCents: 188000, operatingMarginPercent: 37.6,
      incomeCategories: [{ name: "Mensalidades", amountCents: 450000, percent: 90 }, { name: "Pacotes", amountCents: 50000, percent: 10 }],
      expenseCategories: [{ name: "Aluguel", amountCents: 200000, percent: 66.7 }, { name: "Energia", amountCents: 100000, percent: 33.3 }],
    },
  },
  {
    type: "churn_retention",
    data: {
      header, activeStudentsStart: 40, newEnrollments: 5, cancellations: 2, activeStudentsEnd: 43, netGrowth: 3,
      churnRatePercent: 5, retentionRatePercent: 95,
      modalitiesBreakdown: [{ modalityName: "Jiu-jitsu", activeCount: 30, churnRatePercent: 3.3 }, { modalityName: "Muay thai", activeCount: 13, churnRatePercent: 7.1 }],
    },
  },
];

const logo = {
  src: `data:image/png;base64,${readFileSync(path.join(process.cwd(), "public", "documents", "gestarahub-logo.png")).toString("base64")}`,
};

async function pdf(model: ReturnType<typeof reportToDocument>, name: string) {
  const buffer = await renderToBuffer(createElement(DocumentPdf, { model, logo }) as never);
  if (process.env.DOCUMENTS_OUT) writeFileSync(path.join(process.env.DOCUMENTS_OUT, `${name}.pdf`), buffer);
  return buffer;
}

describe("documentos", () => {
  it("relação de alunos vira CSV com cabeçalho, linhas e situação", () => {
    const model = reportToDocument(roster, "2026-10", { levelLabel: "Faixa" });
    expect(model.fileName).toBe("relatorio-alunos-2026-10");
    const csv = documentToCsv(model);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Aluno";"Telefone";"Plano";"Vencimento";"Situação";"Faixa";"Cadastro"');
    expect(csv).toContain('"Ana Souza"');
    expect(csv).toContain('"Trancado"');
  });

  it("relação de alunos vira PDF", async () => {
    const model = reportToDocument(roster, "2026-10", { levelLabel: "Faixa" });
    const buffer = await pdf(model, "relatorio-alunos");
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it.each(others.map((report) => [report.type, report] as const))("%s vira CSV e PDF", async (_type, report) => {
    const model = reportToDocument(report, "2026-10", { levelLabel: "Faixa", levelLabelForModality: () => "Faixa" });
    expect(model.fileName.startsWith("relatorio-")).toBe(true);
    expect(documentToCsv(model).split("\n").length).toBeGreaterThan(3);
    const buffer = await pdf(model, model.fileName);
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
