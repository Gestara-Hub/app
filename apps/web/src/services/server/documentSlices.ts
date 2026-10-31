import type { Id, ReportFilter, ReportType } from "@gestarahub/contracts";
import { classSlices } from "../classes/classSlices";
import { oneStudent } from "../clients/clientSlices";
import { teacherPaySlices } from "../finance/financeSlices";
import { gradeSlices } from "../grades/gradeSlices";
import { reportSlices } from "../reports/reportSlices";
import type { MethodSlice, SliceLoader } from "../world/slices";
import type { Row } from "../world/tables";

/**
 * Recortes dos documentos em PDF e CSV (doc 19, fase 2): cada documento le so
 * o que mostra (a cobranca do recibo, os pagamentos do aluno no ano, o
 * relatorio pelo recorte do relatorio). Os argumentos sao os do `*Model` de
 * cada documento; conferidos em `__tests__/documentSlices.test.ts` contra o
 * espaco inteiro.
 */

/** Cobrancas (e o Pix delas) com os alunos que pagam. */
async function chargesWithStudents(load: SliceLoader, charges: Row[], students: Id[] = []): Promise<void> {
  await Promise.all([
    load.where("clients", "id", [...students, ...charges.map((c) => c.studentId as Id)]),
    load.where("onlinePayments", "chargeId", charges.map((c) => c.id as Id)),
  ]);
}

export const documentSlices: Record<string, MethodSlice> = {
  paymentRecord: async ([chargeId], load) => {
    const charges = await load.where("charges", "id", [chargeId as Id]);
    await chargesWithStudents(load, charges);
  },
  paymentsStatement: async ([studentId], load) => {
    const charges = await load.where("charges", "studentId", [studentId as Id]);
    await chargesWithStudents(load, charges, [studentId as Id]);
  },
  teacherStatement: async (args, load) => teacherPaySlices.getPayoutPreview(args, load),
  minorConsent: async ([studentId], load) => {
    await load.where("clients", "id", [studentId as Id]);
  },
  reportCard: async (args, load) => {
    await gradeSlices.getReportCard(args, load);
    await oneStudent(args[0] as Id, load);
  },
  onlineStatement: async (_args, load) => {
    const payments = await load.all("onlinePayments");
    const charges = await load.where("charges", "id", payments.map((p) => p.chargeId as Id));
    await load.where("clients", "id", charges.map((c) => c.studentId as Id));
  },
  report: async ([type, filter], load) => {
    await reportSlices.generateReport([type as ReportType, filter as ReportFilter], load);
    await load.all("categories");
  },
  // O mesmo recorte de `turmas.getCourseCertificate` (conferido em certificates.test.ts).
  certificate: async (args, load) => classSlices.getCourseCertificate(args, load),
  certificates: async (args, load) => classSlices.issueCourseCertificates(args, load),
};
