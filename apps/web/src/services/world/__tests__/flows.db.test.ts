import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  AttendanceSummary,
  Charge,
  ClassGroupView,
  Client,
  FinancialCategory,
  FinancialEntry,
  FinanceEntryView,
  StudentPackageView,
} from "@gestarahub/contracts";
import type { ActionResult } from "@/services/server/action";
import { createCategoryAction, updateCategoryAction } from "@/services/catalog/categoriesActions";
import { createProfessionalAction } from "@/services/catalog/teamActions";
import { createPackageAction, createPlanAction } from "@/services/billing/catalogActions";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { serviceAction } from "../serviceActions";

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant({
    settings: { defaultDueDay: 10, billingTiming: "prepaid", midMonthStrategy: "full_cycle" },
    subscription: { tier: "pro" },
  });
  // Unidade aberta todos os dias (a turma confere o horario de funcionamento).
  await adminClient()
    .from("units")
    .update({
      business_hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        closed: false,
        start: "06:00",
        end: "22:00",
        shifts: [{ start: "06:00", end: "22:00" }],
      })),
    })
    .eq("id", tenant.unitId)
    .throwOnError();
});

afterEach(async () => {
  await tenant.remove();
});

async function unwrap<T>(pending: Promise<ActionResult<T>>): Promise<T> {
  const result = await pending;
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

async function call<T>(method: string, ...args: unknown[]): Promise<T> {
  const result = await serviceAction(method, args);
  if (!result.ok) throw new Error(`${method}: ${JSON.stringify(result.error)}`);
  return result.data as T;
}

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

describe("fluxos de turmas no servidor (doc 15, fatia 2)", () => {
  it("turma, matrícula, chamada, mensalidade, baixa, pacote, nota, mensagem e financeiro", async () => {
    const admin = adminClient();
    const modality = await unwrap(
      createCategoryAction({
        name: "Inglês",
        assessments: { enabled: true, scale: "zero_ten", passingGrade: 6 },
        measurements: { enabled: true, measures: [{ id: "", name: "Peso", unit: "kg", better: "lower" }] },
      }),
    );
    const teacher = await unwrap(
      createProfessionalAction({
        name: "Prof Ana",
        status: "active",
        workingHours: [],
        serviceIds: [],
        modalityIds: [modality.id],
      }),
    );
    const plan = await unwrap(createPlanAction({ name: "Mensal", priceCents: 20000, period: "monthly", status: "active" }));
    const weekday = new Date(`${today()}T12:00:00`).getDay();

    const group = await call<ClassGroupView>("turmas.create", {
      name: "Inglês A1",
      modalityId: modality.id,
      instructorId: teacher.id,
      capacity: 10,
      allowDropin: true,
      sessionPriceCents: 4000,
      planId: plan.id,
      billingMode: "membership",
      meetingSlots: [{ weekday, start: "19:00", end: "20:00" }],
      startDate: "2026-01-05",
      status: "active",
    });
    expect(group.name).toBe("Inglês A1");

    const student = await call<Client>("clients.create", {
      name: "Bia",
      phone: "11977771111",
      status: "active",
      membershipStatus: "active",
      planId: plan.id,
      planStartDate: `${today().slice(0, 7)}-01`,
    });
    await call("turmas.enroll", { classGroupId: group.id, studentId: student.id });
    const { data: enrollment } = await admin.from("enrollments").select("status").eq("student_id", student.id).single();
    expect(enrollment?.status).toBe("active");

    // Chamada na aula de hoje.
    const sessionId = `${group.id}~${today()}~19:00`;
    await call("turmas.markAttendance", { sessionId, studentId: student.id, status: "present" });
    const summary = await call<AttendanceSummary>("turmas.getAttendanceSummary", group.id);
    expect(summary).toBeTruthy();
    const { data: attendance } = await admin.from("attendances").select("status").eq("session_id", sessionId).single();
    expect(attendance?.status).toBe("present");

    // Mensalidade do mes gerada no servidor e baixa manual.
    const charges = await call<Charge[]>("billing.listCharges", { competence: today().slice(0, 7) });
    const membership = charges.find((c) => c.studentId === student.id && c.kind === "membership");
    expect(membership).toBeTruthy();
    await call("billing.markPaid", membership!.id, "pix");
    const { data: paid } = await admin.from("charges").select("status, method").eq("id", membership!.id).single();
    expect(paid).toEqual({ status: "paid", method: "pix" });

    // Pacote vendido gera o pacote do aluno e a parcela.
    const pkg = await unwrap(
      createPackageAction({
        name: "10 aulas",
        lessons: 10,
        priceCents: 30000,
        classGroupIds: [],
        modalityIds: [],
        absenceConsumes: true,
        status: "active",
      }),
    );
    const sold = await call<StudentPackageView>("packages.sellPackage", {
      studentId: student.id,
      packageId: pkg.id,
      priceCents: 30000,
      installments: 2,
      firstDueDate: today(),
    });
    expect(sold.studentId).toBe(student.id);
    const { data: installments } = await admin.from("charges").select("id").eq("student_package_id", sold.id);
    expect(installments).toHaveLength(2);
    // Vender o mesmo pacote de novo renova: o antigo aponta para o novo na mesma gravacao.
    const renewal = await call<StudentPackageView>("packages.sellPackage", {
      studentId: student.id,
      packageId: pkg.id,
      priceCents: 30000,
      installments: 1,
      firstDueDate: today(),
    });
    const { data: renewed } = await admin
      .from("student_packages")
      .select("status, renewed_into_id")
      .eq("id", sold.id)
      .single();
    expect(renewed).toEqual({ status: "renewed", renewed_into_id: renewal.id });

    // Nota da turma.
    const assessment = await call<{ id: string }>("grades.create", { classGroupId: group.id, name: "Prova 1", date: today() });
    await call("grades.setGrades", assessment.id, [{ studentId: student.id, status: "graded", value: 9 }]);
    const { data: grades } = await admin.from("assessments").select("grades").eq("id", assessment.id).single();
    expect(grades?.grades).toEqual([expect.objectContaining({ studentId: student.id, value: 9 })]);
    // Com nota lancada, a modalidade nao troca de escala nem para a soma (achado V5).
    const switched = await updateCategoryAction(modality.id, {
      assessments: { enabled: true, scale: "zero_ten", passingGrade: 6, resultMode: "sum" },
    });
    expect(switched.ok).toBe(false);
    // Recuperacao (fase A, 31/10/2026): a coluna recovery_of e a exclusao junto com a recuperada.
    const recovery = await call<{ id: string }>("grades.create", {
      classGroupId: group.id,
      name: "Recuperação",
      date: today(),
      recoveryOf: assessment.id,
    });
    const { data: recoveryRow } = await admin.from("assessments").select("recovery_of").eq("id", recovery.id).single();
    expect(recoveryRow).toEqual({ recovery_of: assessment.id });
    await call("grades.remove", assessment.id);
    const { data: left } = await admin.from("assessments").select("id").in("id", [assessment.id, recovery.id]);
    expect(left).toEqual([]);

    // Testes e medidas (fase B, 31/10/2026): medidas na modalidade e a avaliacao do aluno.
    const weight = modality.measurements!.measures[0];
    const measurement = await call<{ id: string }>("measurements.create", {
      studentId: student.id,
      modalityId: modality.id,
      date: today(),
      values: { [weight.id]: 72.5 },
    });
    const { data: measured } = await admin
      .from("student_measurements")
      .select("values, student_id")
      .eq("id", measurement.id)
      .single();
    expect(measured).toEqual({ values: { [weight.id]: 72.5 }, student_id: student.id });
    const view = await call<{ modalities: { progress: { latest?: { value: number } }[] }[] }>(
      "measurements.getStudentMeasurements",
      student.id,
    );
    expect(view.modalities[0].progress[0].latest?.value).toBe(72.5);

    // Mensagem assistida (WhatsApp do aparelho).
    await call("communication.registerAssistedMessage", {
      recipientName: "Bia",
      recipientPhone: "(11) 97777-1111",
      content: "Oi, Bia!",
      clientId: student.id,
    });
    const { data: logs } = await admin.from("message_logs").select("status").eq("organization_id", tenant.organizationId);
    expect(logs).toEqual([{ status: "opened" }]);

    // Lançamento no financeiro.
    const categories = await call<FinancialCategory[]>("finance.listCategories");
    const expense = categories.find((c) => c.type === "expense" && !c.system)!;
    const entry = await call<FinancialEntry>("finance.createEntry", {
      type: "expense",
      categoryId: expense.id,
      description: "Aluguel",
      amountCents: 150000,
      dueDate: today(),
    });
    const { data: entryRow } = await admin.from("financial_entries").select("amount_cents").eq("id", entry.id).single();
    expect(entryRow?.amount_cents).toBe(150000);
    // Pago e desfeito: segue sem excluir (a auditoria do lancamento e carregada).
    await call("finance.markEntryPaid", entry.id, "pix");
    await call("finance.markEntryPending", entry.id);
    const views = await call<FinanceEntryView[]>("finance.listEntries");
    expect(views.find((v) => v.id === entry.id)?.everPaid).toBe(true);

    // Leituras agregadas rodam sobre o mesmo banco.
    await call("finance.getSummary", today().slice(0, 7));
    await call("studentSummary.getStudentSummary", student.id);
    const milestones = await call<{ hasEnrollment: boolean; hasPaidCharge: boolean; hasMessage: boolean }>(
      "onboarding.getDiscoveryMilestones",
    );
    expect(milestones).toMatchObject({ hasEnrollment: true, hasPaidCharge: true, hasMessage: true });

    // Cancelar a matricula.
    const enrollments = await call<{ id: string }[]>("turmas.listEnrollments", group.id);
    await call("turmas.cancelEnrollment", enrollments[0].id);
    const { data: canceled } = await admin.from("enrollments").select("status").eq("student_id", student.id).single();
    expect(canceled?.status).toBe("canceled");
  });
});
