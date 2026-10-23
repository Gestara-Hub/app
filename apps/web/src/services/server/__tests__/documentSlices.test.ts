import type { ReportType } from "@gestarahub/contracts";
import { beforeEach, describe, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billing";
import { turmasService } from "@/services/classes";
import { checkSlice } from "@/services/world/sliceCheck";
import { createClass, createInstructor, createPlan, enrollStudent, resetAcademy, sessionIdOf } from "@/test/academy";
import { documentSlices } from "../documentSlices";
import { paymentRecordModel, paymentsStatementModel, teacherStatementModel } from "../paymentDocuments";
import { reportDocumentModel } from "../reportDocument";
import { minorConsentModel, onlineStatementModel, reportCardModel } from "../studentDocuments";

/**
 * Recortes dos documentos (doc 19, fase 2): cada documento montado so com o
 * recorte tem de sair igual ao montado com o espaco inteiro (e falhar igual).
 * Os documentos nao passam pelo `delegate`, por isso a conferencia e chamada
 * aqui direto.
 */

const REPORTS: ReportType[] = [
  "attendance_sheet",
  "students_roster",
  "billing_statement",
  "course_summary",
  "package_summary",
  "monthly_birthdays",
  "financial_income_statement",
  "churn_retention",
];

let studentId = "";
let paidChargeId = "";
let openChargeId = "";
let professionalId = "";

beforeEach(async () => {
  resetAcademy();
  const plan = await createPlan("monthly", 15000);
  const ana = await enrollStudent({ name: "Ana", plan, startDate: "2026-09-01" });
  const bia = await enrollStudent({ name: "Bia", plan, startDate: "2026-09-01" });
  studentId = ana.id;
  paidChargeId = store.charges.find((c) => c.studentId === ana.id)!.id;
  openChargeId = store.charges.find((c) => c.studentId === bia.id)!.id;
  await billingService.markPaid(paidChargeId, "pix");
  const instructor = await createInstructor("Prof Carla");
  professionalId = instructor.id;
  const group = await createClass({ instructorId: instructor.id, slots: [{ weekday: 1, start: "18:00", end: "19:00" }] });
  await turmasService.enroll({ classGroupId: group.id, studentId: ana.id });
  await turmasService.enroll({ classGroupId: group.id, studentId: bia.id });
  await turmasService.markAttendance({ sessionId: sessionIdOf(group.id, "2026-09-14", "18:00"), studentId: ana.id, status: "present" });
  await turmasService.markAttendance({ sessionId: sessionIdOf(group.id, "2026-09-21", "18:00"), studentId: bia.id, status: "absent" });
});

describe("recortes dos documentos", () => {
  it("recibo, declaração e demonstrativo do professor", async () => {
    for (const id of [paidChargeId, openChargeId, "cobranca-que-nao-existe"]) {
      await checkSlice("documents.paymentRecord", documentSlices.paymentRecord, [id], () => paymentRecordModel(id));
    }
    for (const id of [studentId, "aluno-que-nao-existe"]) {
      await checkSlice("documents.paymentsStatement", documentSlices.paymentsStatement, [id, 2026], () => paymentsStatementModel(id, 2026));
    }
    for (const competence of ["2026-09", "2026-08"]) {
      await checkSlice("documents.teacherStatement", documentSlices.teacherStatement, [professionalId, competence], () =>
        teacherStatementModel(professionalId, competence),
      );
    }
  });

  it("termo do responsável, boletim e extrato online", async () => {
    await checkSlice("documents.minorConsent", documentSlices.minorConsent, [studentId], () => minorConsentModel(studentId));
    await checkSlice("documents.reportCard", documentSlices.reportCard, [studentId], () => reportCardModel(studentId));
    await checkSlice("documents.onlineStatement", documentSlices.onlineStatement, ["2026-09"], () => onlineStatementModel("2026-09"));
  });

  it("relatórios em documento", async () => {
    for (const type of REPORTS) {
      for (const filter of [{ competence: "2026-09" }, {}]) {
        await checkSlice("documents.report", documentSlices.report, [type, filter], () => reportDocumentModel(type, filter));
      }
    }
  });
});
