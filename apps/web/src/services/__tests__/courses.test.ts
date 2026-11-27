import type {
  Charge,
  ClassGroupView,
  CreateClassGroup,
  EnrollmentCourseChoice,
} from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService, membershipPeriodTaken } from "@/services/billing";
import { clientsService } from "@/services/clients";
import { financeService } from "@/services/finance";
import { onlinePaymentsService } from "@/services/onlinePayments";
import { reportsService } from "@/services/reports";
import { subscriptionService } from "@/services/subscription/subscriptionService";
import { teacherPayService } from "@/services/finance";
import { turmasService } from "@/services/classes";
import {
  ACADEMY_UNIT,
  createClass,
  createInstructor,
  createPlan,
  createStudent,
  enrollStudent,
  resetAcademy,
} from "@/test/academy";

/**
 * Curso fechado (doc 20, fase B): turma com valor fechado, a matricula gera as
 * parcelas, cancelar cancela so as futuras, curso terminado vira "Concluído".
 * Hoje congelado em 22/09/2026 (terca).
 */

/** Moeda formatada usa espaço não separável; os asserts usam espaço comum. */
const plain = (text: string) => text.replace(/\u00a0/g, " ");
const lastAudit = () => plain(store.auditLog.at(-1)?.summary ?? "");
const courseCharges = (studentId: string): Charge[] =>
  store.charges
    .filter((c) => c.kind === "course" && c.studentId === studentId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
const brief = (c: Charge) => `${c.dueDate} ${c.amountCents} ${c.status}`;

let slotHour = 6;
/** Horario livre por turma (o mesmo professor nao da duas aulas juntas). */
const nextSlot = () => {
  const start = `${String(slotHour).padStart(2, "0")}:00`;
  const end = `${String(slotHour + 1).padStart(2, "0")}:00`;
  slotHour += 1;
  return [{ weekday: 1 as const, start, end }];
};

async function courseClass(over: Partial<CreateClassGroup> = {}): Promise<ClassGroupView> {
  const teacher = store.professionals[0] ?? (await createInstructor("Chef"));
  return turmasService.create({
    name: "Confeitaria",
    modalityId: teacher.modalityIds?.[0] ?? "",
    instructorId: teacher.id,
    capacity: 10,
    allowDropin: false,
    meetingSlots: nextSlot(),
    startDate: "2026-09-14",
    endDate: "2026-12-15",
    billingMode: "course",
    coursePriceCents: 80000,
    courseMaxInstallments: 4,
    status: "active",
    ...over,
  });
}

function choice(over: Partial<EnrollmentCourseChoice> = {}): EnrollmentCourseChoice {
  return { priceCents: 80000, installments: 4, firstDueDate: "2026-10-15", ...over };
}

beforeEach(() => {
  slotHour = 6;
});

describe("curso fechado: turma", () => {
  beforeEach(() => resetAcademy());

  it("curso exige valor, parcelas de 1 a 12 e data de fim", async () => {
    await expect(
      courseClass({ coursePriceCents: undefined, courseMaxInstallments: undefined, endDate: undefined }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [
        { field: "coursePriceCents", message: "Informe o valor do curso." },
        { field: "courseMaxInstallments", message: "Escolha de 1 a 12 parcelas." },
        { field: "endDate", message: "Informe quando o curso termina." },
      ],
    });
    await expect(courseClass({ coursePriceCents: 0 })).rejects.toMatchObject({
      fields: [{ field: "coursePriceCents" }],
    });
    await expect(courseClass({ courseMaxInstallments: 13 })).rejects.toMatchObject({
      fields: [{ field: "courseMaxInstallments" }],
    });
    await expect(courseClass({ courseMaxInstallments: 0 })).rejects.toMatchObject({
      fields: [{ field: "courseMaxInstallments" }],
    });
    await expect(courseClass({ endDate: "2026-09-13" })).rejects.toMatchObject({
      fields: [{ field: "endDate", message: "O curso não pode terminar antes de começar." }],
    });
    expect(store.classGroups).toHaveLength(0);
  });

  it("oficina de um dia: fim no mesmo dia do início vale", async () => {
    const g = await courseClass({ startDate: "2026-10-03", endDate: "2026-10-03", courseMaxInstallments: 1 });
    expect(g).toMatchObject({ billingMode: "course", endDate: "2026-10-03", isEnded: false });
  });

  it("mensalidade e sem cobrança não pedem valor; fim antes do início é recusado em qualquer turma", async () => {
    const g = await courseClass({
      billingMode: "membership",
      coursePriceCents: undefined,
      courseMaxInstallments: undefined,
      endDate: undefined,
    });
    expect(g.billingMode).toBe("membership");
    await expect(
      turmasService.update(g.id, { endDate: "2026-09-01" }),
    ).rejects.toMatchObject({ fields: [{ field: "endDate", message: "A turma não pode terminar antes de começar." }] });
    const free = await courseClass({ billingMode: "free", endDate: undefined });
    expect(free).toMatchObject({ billingMode: "free" });
  });

  it("os campos seguem a forma: curso sem plano da turma; mensalidade sem valor de curso", async () => {
    const plan = await createPlan("monthly", 15000);
    const course = await courseClass({ planId: plan.id });
    expect(course.planId).toBeUndefined();
    const free = await courseClass({ billingMode: "free", planId: plan.id });
    expect(free.planId).toBeUndefined();
    expect(free.coursePriceCents).toBeUndefined();
    const membership = await turmasService.update(course.id, { billingMode: "membership", planId: plan.id });
    expect(membership).toMatchObject({ billingMode: "membership", planId: plan.id });
    expect(membership.coursePriceCents).toBeUndefined();
    expect(membership.courseMaxInstallments).toBeUndefined();
  });

  it("com matrícula, mudar o valor ou deixar de ser curso é recusado e as parcelas ficam (25/11/2026)", async () => {
    const g = await courseClass();
    const student = await createStudent("Bia");
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });
    const before = courseCharges(student.id).map(brief);

    await expect(turmasService.update(g.id, { coursePriceCents: 120000 })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(courseCharges(student.id).map(brief)).toEqual(before);
    await expect(turmasService.update(g.id, { billingMode: "membership" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(courseCharges(student.id).map(brief)).toEqual(before);
    const enrollment = store.enrollments.find((e) => e.studentId === student.id);
    expect(enrollment?.course?.priceCents).toBe(80000);
  });

  it("encerrado é derivado da data de fim, em qualquer turma", async () => {
    const g = await courseClass({ startDate: "2026-08-03", endDate: "2026-09-21" });
    expect(g.isEnded).toBe(true);
    const running = await courseClass({ endDate: "2026-09-22" });
    expect(running.isEnded).toBe(false);
    const list = await turmasService.list();
    expect(list.map((t) => t.isEnded).sort()).toEqual([false, true]);
  });
});

describe("curso fechado: matrícula gera as parcelas", () => {
  beforeEach(() => resetAcademy());

  it("4x: valores, vencimentos mensais, ligação com a matrícula e uma auditoria", async () => {
    const g = await courseClass();
    const student = await createStudent("Bruna");
    const before = store.auditLog.length;
    const view = await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });

    const charges = courseCharges(student.id);
    expect(charges.map(brief)).toEqual([
      "2026-10-15 20000 pending",
      "2026-11-15 20000 pending",
      "2026-12-15 20000 pending",
      "2027-01-15 20000 pending",
    ]);
    const enrollment = store.enrollments.find((e) => e.id === view.id)!;
    expect(enrollment.course).toMatchObject({ priceCents: 80000, installments: 4, firstDueDate: "2026-10-15" });
    const groupId = enrollment.course!.installmentGroupId;
    expect(groupId).toBeTruthy();
    for (const [i, c] of charges.entries()) {
      expect(c).toMatchObject({
        kind: "course",
        classGroupId: g.id,
        enrollmentId: enrollment.id,
        description: "Confeitaria",
        installmentGroupId: groupId,
        cycleIndex: i + 1,
        cycleTotal: 4,
        competence: c.dueDate.slice(0, 7),
        unitId: ACADEMY_UNIT,
        organizationId: store.organization.id,
      });
      expect(c.planId).toBeUndefined();
    }
    expect(view).toMatchObject({
      studentName: "Bruna",
      isCompleted: false,
      courseInstallments: { paid: 0, future: 4, due: 0 },
    });
    expect(store.auditLog.length).toBe(before + 1);
    expect(lastAudit()).toBe("Ana Ribeiro matriculou Bruna no curso Confeitaria (R$ 800,00, em 4 parcelas)");
  });

  it("resto dos centavos na primeira; à vista sem 'parcelas' na auditoria", async () => {
    const g = await courseClass({ coursePriceCents: 10000, courseMaxInstallments: 3 });
    const a = await createStudent("Caio");
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: a.id,
      course: choice({ priceCents: 10000, installments: 3, firstDueDate: "2026-10-31" }),
    });
    expect(courseCharges(a.id).map(brief)).toEqual([
      "2026-10-31 3334 pending",
      "2026-11-30 3333 pending",
      "2026-12-31 3333 pending",
    ]);
    const b = await createStudent("Duda");
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: b.id,
      course: choice({ priceCents: 10000, installments: 1, firstDueDate: "2026-09-22" }),
    });
    expect(courseCharges(b.id).map(brief)).toEqual(["2026-09-22 10000 pending"]);
    expect(lastAudit()).toBe("Ana Ribeiro matriculou Duda no curso Confeitaria (R$ 100,00)");
  });

  it("valor ajustado na matrícula (desconto manual, decisão 8)", async () => {
    const g = await courseClass();
    const student = await createStudent("Eva");
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: student.id,
      course: choice({ priceCents: 60000, installments: 3 }),
    });
    expect(courseCharges(student.id).map((c) => c.amountCents)).toEqual([20000, 20000, 20000]);
    expect(lastAudit()).toBe("Ana Ribeiro matriculou Eva no curso Confeitaria (R$ 600,00, em 3 parcelas)");
  });

  it("validação do pagamento escolhido", async () => {
    const g = await courseClass();
    const student = await createStudent("Fabi");
    const enroll = (course?: EnrollmentCourseChoice) =>
      turmasService.enroll({ classGroupId: g.id, studentId: student.id, course });

    await expect(enroll(undefined)).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "course", message: "Informe o pagamento do curso." }],
    });
    await expect(enroll(choice({ priceCents: 0, installments: 5, firstDueDate: "2026-02-30" }))).rejects.toMatchObject({
      fields: [
        { field: "course.priceCents", message: "Informe o valor do curso." },
        { field: "course.installments", message: "Escolha de 1 a 4 parcelas." },
        { field: "course.firstDueDate", message: "Informe o 1º vencimento." },
      ],
    });
    await expect(enroll(choice({ priceCents: 3, installments: 4 }))).rejects.toMatchObject({
      fields: [{ field: "course.installments", message: "Cada parcela precisa de pelo menos R$ 0,01." }],
    });
    const cash = await courseClass({ name: "Oficina", courseMaxInstallments: 1 });
    await expect(
      turmasService.enroll({ classGroupId: cash.id, studentId: student.id, course: choice({ installments: 2 }) }),
    ).rejects.toMatchObject({ fields: [{ field: "course.installments", message: "Este curso é só à vista." }] });
    expect(courseCharges(student.id)).toHaveLength(0);
    expect(store.enrollments).toHaveLength(0);
  });

  it("entrar com o curso em andamento é permitido (valor cheio por padrão)", async () => {
    const g = await courseClass({ startDate: "2026-09-01" });
    const student = await createStudent("Gil");
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice({ firstDueDate: "2026-09-22" }) });
    expect(courseCharges(student.id).reduce((sum, c) => sum + c.amountCents, 0)).toBe(80000);
  });

  it("curso que já terminou não recebe matrícula", async () => {
    const g = await courseClass({ startDate: "2026-08-03", endDate: "2026-09-20" });
    const student = await createStudent("Hugo");
    await expect(
      turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() }),
    ).rejects.toMatchObject({ message: "Este curso já terminou (20/09/2026)." });
  });

  it("turma de mensalidade ignora o pagamento de curso enviado", async () => {
    const teacher = await createInstructor("Ana");
    const g = await createClass({ instructorId: teacher.id, slots: nextSlot() });
    const student = await createStudent("Iris");
    const view = await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });
    expect(view.course).toBeUndefined();
    expect(view.courseInstallments).toBeUndefined();
    expect(courseCharges(student.id)).toHaveLength(0);
    expect(lastAudit()).toBe(`Ana Ribeiro matriculou Iris na turma ${g.name}`);
  });

  it("matrícula em lote: cada aluno com as próprias parcelas", async () => {
    const g = await courseClass();
    const students = [await createStudent("Jade"), await createStudent("Kaio"), await createStudent("Lia")];
    for (const s of students) {
      await turmasService.enroll({ classGroupId: g.id, studentId: s.id, course: choice() });
    }
    const groups = new Set(store.charges.filter((c) => c.kind === "course").map((c) => c.installmentGroupId));
    expect(groups.size).toBe(3);
    for (const s of students) expect(courseCharges(s.id)).toHaveLength(4);
    const enrollments = await turmasService.listEnrollments(g.id);
    expect(enrollments.map((e) => e.courseInstallments)).toEqual([
      { paid: 0, future: 4, due: 0 },
      { paid: 0, future: 4, due: 0 },
      { paid: 0, future: 4, due: 0 },
    ]);
  });

  it("promover da lista de espera para o curso pede e gera as parcelas", async () => {
    const g = await courseClass({ capacity: 1 });
    const first = await createStudent("Mia");
    await turmasService.enroll({ classGroupId: g.id, studentId: first.id, course: choice() });
    const waiting = await createStudent("Nina");
    const entry = await turmasService.addToWaitlist({ classGroupId: g.id, studentId: waiting.id });

    await expect(turmasService.promoteFromWaitlist(entry.id)).rejects.toMatchObject({
      fields: [{ field: "course" }],
    });
    // Recusado nao tira da fila.
    expect(store.waitlist.find((w) => w.id === entry.id)?.status).toBe("waiting");

    const view = await turmasService.promoteFromWaitlist(
      entry.id,
      choice({ priceCents: 70000, installments: 2, firstDueDate: "2026-09-30" }),
    );
    expect(view.course).toMatchObject({ priceCents: 70000, installments: 2 });
    expect(courseCharges(waiting.id).map(brief)).toEqual(["2026-09-30 35000 pending", "2026-10-30 35000 pending"]);
    expect(lastAudit()).toBe("Ana Ribeiro matriculou Nina no curso Confeitaria (R$ 700,00, em 2 parcelas)");
  });
});

describe("curso fechado: cancelar a matrícula (decisão 1)", () => {
  beforeEach(() => resetAcademy());

  /** 5x a partir de 22/07: paga, vencida, vence hoje, duas futuras. */
  async function enrolledWithHistory() {
    const g = await courseClass({ startDate: "2026-07-06", courseMaxInstallments: 5, coursePriceCents: 100000 });
    const student = await createStudent("Otto");
    const view = await turmasService.enroll({
      classGroupId: g.id,
      studentId: student.id,
      course: choice({ priceCents: 100000, installments: 5, firstDueDate: "2026-07-22" }),
    });
    await billingService.markPaid(courseCharges(student.id)[0].id, "pix");
    return { g, student, enrollmentId: view.id };
  }

  it("pagas ficam, futuras são canceladas pelo sistema com motivo, vencidas continuam", async () => {
    const { g, student, enrollmentId } = await enrolledWithHistory();
    const [before] = await turmasService.listEnrollments(g.id);
    expect(before.courseInstallments).toEqual({ paid: 1, future: 2, due: 2 });

    await turmasService.cancelEnrollment(enrollmentId);

    expect(courseCharges(student.id).map(brief)).toEqual([
      "2026-07-22 20000 paid",
      "2026-08-22 20000 pending",
      "2026-09-22 20000 pending",
      "2026-10-22 20000 canceled",
      "2026-11-22 20000 canceled",
    ]);
    for (const c of courseCharges(student.id).slice(3)) {
      expect(c).toMatchObject({ canceledBy: "system", cancelReason: "Matrícula cancelada" });
    }
    expect(lastAudit()).toBe("Ana Ribeiro cancelou a matrícula de Otto no curso Confeitaria e 2 parcelas futuras");
    // Cancelada pelo sistema nao reabre (cobraria quem saiu).
    await expect(billingService.reopenCharge(courseCharges(student.id)[3].id)).rejects.toMatchObject({
      httpStatus: 409,
    });
    // A vencida aparece como atrasada (dívida), sem multa.
    const views = await billingService.listCharges({ kind: "course", studentId: student.id });
    expect(views.map((c) => c.status)).toEqual(["paid", "overdue", "pending", "canceled", "canceled"]);
    expect(store.charges.filter((c) => c.studentId === student.id)).toHaveLength(5);
  });

  it("não cancela duas vezes", async () => {
    const { enrollmentId } = await enrolledWithHistory();
    await turmasService.cancelEnrollment(enrollmentId);
    await expect(turmasService.cancelEnrollment(enrollmentId)).rejects.toMatchObject({
      httpStatus: 409,
      message: "Esta matrícula já foi cancelada.",
    });
  });

  it("curso já concluído: cancelar a matrícula não mexe nas parcelas", async () => {
    const { g, student, enrollmentId } = await enrolledWithHistory();
    // O fim do curso nao muda pela edicao depois da matricula: o teste pula para o fim.
    store.classGroups.find((x) => x.id === g.id)!.endDate = "2026-09-21";
    await turmasService.cancelEnrollment(enrollmentId);
    expect(courseCharges(student.id).map((c) => c.status)).toEqual([
      "paid",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(lastAudit()).toBe("Ana Ribeiro cancelou a matrícula de Otto no curso Confeitaria");
  });

  it("cancelar só a cobrança do curso não vira \"cancelou a matrícula\" na Auditoria (achado 68)", async () => {
    const g = await courseClass({ courseMaxInstallments: 1, coursePriceCents: 50000 });
    const student = await createStudent("Fábio");
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: student.id,
      course: choice({ priceCents: 50000, installments: 1 }),
    });
    await billingService.cancelCharge(courseCharges(student.id)[0].id, "Lançada por engano");

    expect(lastAudit()).toMatch(/^Ana Ribeiro cancelou a cobrança da matrícula no curso "Confeitaria" de Fábio \(/);
    // A matrícula continua.
    const [enrollment] = await turmasService.listEnrollments(g.id);
    expect(enrollment.status).toBe("active");
  });

  it("matrícula de mensalidade continua sem mexer em cobrança", async () => {
    const teacher = await createInstructor("Ana");
    const g = await createClass({ instructorId: teacher.id, slots: nextSlot() });
    const plan = await createPlan("monthly", 15000);
    const student = await enrollStudent({ plan, name: "Paulo", startDate: "2026-09-01", strategy: "full_cycle" });
    const e = await turmasService.enroll({ classGroupId: g.id, studentId: student.id });
    const charges = store.charges.map(brief);
    await turmasService.cancelEnrollment(e.id);
    expect(store.charges.map(brief)).toEqual(charges);
    expect(lastAudit()).toBe(`Ana Ribeiro cancelou a matrícula de Paulo na turma ${g.name}`);
  });
});

describe("curso fechado: concluído", () => {
  beforeEach(() => resetAcademy());

  it("depois do fim, a matrícula ativa aparece como concluída", async () => {
    const g = await courseClass();
    const student = await createStudent("Rui");
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });
    expect((await turmasService.listEnrollments(g.id))[0].isCompleted).toBe(false);

    // O periodo do curso nao muda pela edicao depois da matricula: o teste pula para o fim.
    Object.assign(store.classGroups.find((x) => x.id === g.id)!, { endDate: "2026-09-21", startDate: "2026-08-03" });
    const [enrollment] = await turmasService.listEnrollments(g.id);
    expect(enrollment).toMatchObject({ status: "active", isCompleted: true });
    expect((await turmasService.getById(g.id)).isEnded).toBe(true);
  });

  it("turma de mensalidade com fim no passado é encerrada, mas a matrícula não vira concluída", async () => {
    const teacher = await createInstructor("Ana");
    const g = await createClass({ instructorId: teacher.id, slots: nextSlot(), startDate: "2026-08-03" });
    const student = await createStudent("Sara");
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id });
    await turmasService.update(g.id, { endDate: "2026-09-21" });
    expect((await turmasService.getById(g.id)).isEnded).toBe(true);
    expect((await turmasService.listEnrollments(g.id))[0].isCompleted).toBe(false);
  });
});

describe("curso fechado: mensalidades não são afetadas", () => {
  beforeEach(() => resetAcademy());

  it("curso e turma sem cobrança nunca geram mensalidade pelo plano da turma (dado legado)", async () => {
    const plan = await createPlan("monthly", 15000);
    const course = await courseClass();
    const free = await courseClass({ name: "Projeto social", billingMode: "free", endDate: undefined });
    const teacher = await createInstructor("Ana");
    const membership = await createClass({ instructorId: teacher.id, slots: nextSlot() });
    // Dado legado: plano gravado na turma (o servico de hoje limpa no curso e no sem cobranca).
    for (const g of store.classGroups) g.planId = plan.id;

    const inCourse = await createStudent("Tom");
    await turmasService.enroll({ classGroupId: course.id, studentId: inCourse.id, course: choice() });
    const inFree = await createStudent("Uma");
    await turmasService.enroll({ classGroupId: free.id, studentId: inFree.id });
    const legacy = await createStudent("Vera");
    await turmasService.enroll({ classGroupId: membership.id, studentId: legacy.id });

    await billingService.generateCharges("2026-09");
    const memberships = store.charges.filter((c) => c.kind === "membership");
    expect(memberships.map((c) => c.studentId)).toEqual([legacy.id]);
  });

  it("aluno com plano próprio num curso segue pagando a mensalidade dele, e a parcela não ocupa o período", async () => {
    const plan = await createPlan("monthly", 15000);
    const student = await enrollStudent({ plan, name: "Wagner", startDate: "2026-09-01", strategy: "full_cycle" });
    store.charges = store.charges.filter((c) => c.kind !== "membership");
    const g = await courseClass();
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: student.id,
      course: choice({ firstDueDate: "2026-09-01" }),
    });
    expect(
      membershipPeriodTaken(student.id, plan.id, {
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
        competence: "2026-09",
        cycleIndex: 1,
      }),
    ).toBe(false);
    expect(await billingService.generateCharges("2026-09")).toEqual({ created: 1 });
  });

  it("troca de plano não cancela as parcelas do curso; inativar encerra a matrícula e tira as futuras", async () => {
    const plan = await createPlan("monthly", 15000, "Básico");
    const other = await createPlan("monthly", 20000, "Pro");
    const student = await enrollStudent({ plan, name: "Xavier", startDate: "2026-09-01", strategy: "full_cycle" });
    const g = await courseClass();
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });
    await clientsService.update(student.id, { planId: other.id, planStartDate: "2026-10-01" });
    expect(courseCharges(student.id).map((c) => c.status)).toEqual(["pending", "pending", "pending", "pending"]);
    await clientsService.remove(student.id, { cancelOpenCharges: true });
    // Como cancelar a matricula: as parcelas que ainda nao venceram saem.
    expect(courseCharges(student.id).map((c) => c.status)).toEqual(["canceled", "canceled", "canceled", "canceled"]);
  });
});

describe("curso fechado: ações de Cobranças", () => {
  beforeEach(() => resetAcademy());

  it("pagar, desfazer, cancelar e reabrir com o rótulo da parcela do curso", async () => {
    const g = await courseClass();
    const student = await createStudent("Yara");
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });
    const second = courseCharges(student.id)[1];

    await billingService.markPaid(second.id, "pix");
    expect(lastAudit()).toBe(
      'Ana Ribeiro registrou o pagamento da parcela 2 de 4 do curso "Confeitaria" de Yara (R$ 200,00, vence 15/11/2026)',
    );
    await billingService.markPending(second.id);
    await billingService.cancelCharge(second.id, "Aluno desistiu");
    expect(lastAudit()).toBe(
      'Ana Ribeiro cancelou a parcela 2 de 4 do curso "Confeitaria" de Yara (R$ 200,00, vence 15/11/2026): Aluno desistiu',
    );
    await billingService.reopenCharge(second.id);
    expect(courseCharges(student.id)[1].status).toBe("pending");
  });

  it("filtro por tipo: só as parcelas do curso, na competência do vencimento", async () => {
    const g = await courseClass();
    const student = await createStudent("Zeca");
    await billingService.createExtraCharge({
      studentId: student.id,
      description: "Avental",
      totalCents: 5000,
      firstDueDate: "2026-10-15",
      installments: 1,
    });
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });
    const october = await billingService.listCharges({ competence: "2026-10", kind: "course" });
    expect(october.map((c) => `${c.description} ${c.cycleIndex}/${c.cycleTotal} ${c.className}`)).toEqual([
      "Confeitaria 1/4 Confeitaria",
    ]);
  });
});

describe("curso fechado: pagamento online (Pro)", () => {
  beforeEach(async () => {
    resetAcademy();
    await subscriptionService.setTier("pro");
    await onlinePaymentsService.updateSettings({ enabled: true });
  });

  it("gera Pix para a parcela e paga pela simulação", async () => {
    const g = await courseClass();
    const student = await createStudent("Ana Clara");
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });
    const [first] = courseCharges(student.id);
    const pix = await onlinePaymentsService.createForCharge(first.id, "pix");
    expect(pix).toMatchObject({ status: "awaiting", amountCents: 20000, chargeId: first.id });
    expect(lastAudit()).toBe(
      'Ana Ribeiro gerou a cobrança online por Pix da parcela 1 de 4 do curso "Confeitaria" de Ana Clara (R$ 200,00)',
    );
    await onlinePaymentsService.simulatePaid(pix.id);
    expect(store.charges.find((c) => c.id === first.id)).toMatchObject({ status: "paid", paidVia: "online" });
  });

  it("cancelar a matrícula cancela o Pix em aberto das parcelas futuras", async () => {
    const g = await courseClass();
    const student = await createStudent("Beto");
    const view = await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });
    const [first] = courseCharges(student.id);
    const pix = await onlinePaymentsService.createForCharge(first.id, "pix");
    await turmasService.cancelEnrollment(view.id);
    expect(store.onlinePayments.find((p) => p.id === pix.id)?.status).toBe("canceled");
  });
});

describe("curso fechado: financeiro e professores", () => {
  beforeEach(() => resetAcademy());

  it("categoria de sistema Cursos, linha agregada e resumo", async () => {
    const g = await courseClass();
    const student = await createStudent("Carla");
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: student.id,
      course: choice({ installments: 2, firstDueDate: "2026-09-10" }),
    });
    const [first] = courseCharges(student.id);
    await billingService.markPaid(first.id, "pix");

    const category = store.financialCategories.find((c) => c.systemKey === "courses");
    expect(category).toMatchObject({ name: "Cursos", type: "income", system: true });

    const rows = await financeService.listEntries({ competence: "2026-09" });
    expect(rows.find((r) => r.id === "charges:course:2026-09")).toMatchObject({
      source: "charge",
      type: "income",
      categoryId: category!.id,
      categoryName: "Cursos",
      amountCents: 40000,
      chargeCounts: { paid: 1, pending: 0, overdue: 0 },
    });
    const october = await financeService.listEntries({ competence: "2026-10" });
    expect(october.find((r) => r.id === "charges:course:2026-10")).toMatchObject({
      amountCents: 40000,
      chargeCounts: { paid: 0, pending: 1, overdue: 0 },
    });

    const summary = await financeService.getSummary("2026-09");
    expect(summary.incomePaidCents).toBe(40000);
    const byCategory = await financeService.getByCategory("2026-09");
    expect(byCategory.find((c) => c.categoryId === category!.id)).toMatchObject({ totalCents: 40000 });
  });

  it("resultado do mês (DRE) mostra a linha Cursos", async () => {
    await subscriptionService.setTier("pro");
    const g = await courseClass();
    const student = await createStudent("Davi");
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: student.id,
      course: choice({ installments: 1, firstDueDate: "2026-09-20" }),
    });
    await billingService.markPaid(courseCharges(student.id)[0].id, "cash");
    const report = await reportsService.generateReport("financial_income_statement", { competence: "2026-09" });
    if (report.type !== "financial_income_statement") throw new Error("relatorio errado");
    expect(report.data.incomeCategories).toEqual([{ name: "Cursos", amountCents: 80000, percent: 100 }]);
  });

  it("o % do professor separa a mensalidade e a parcela de curso paga (decisão 7)", async () => {
    const teacher = await createInstructor("Chef");
    const g = await courseClass({ instructorId: teacher.id, modalityId: teacher.modalityIds?.[0] });
    const plan = await createPlan("monthly", 20000);
    const student = await enrollStudent({ plan, name: "Edu", startDate: "2026-09-01", strategy: "full_cycle" });
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: student.id,
      course: choice({ installments: 1, firstDueDate: "2026-09-01" }),
    });
    for (const c of store.charges) await billingService.markPaid(c.id, "pix");
    await teacherPayService.saveRule(teacher.id, {
      components: [{ kind: "percent_of_memberships", percent: 40 }],
      startCompetence: "2026-09",
    });
    const payout = (await teacherPayService.listPayouts("2026-09")).find((p) => p.professionalId === teacher.id);
    // Mensalidade de R$ 200 (o aluno so tem a turma do curso) e curso de R$ 800
    // em linhas separadas.
    expect(payout?.lines).toMatchObject([
      { kind: "percent_of_memberships", source: "memberships", baseCents: 20000, amountCents: 8000 },
      { kind: "percent_of_memberships", source: "courses", baseCents: 80000, amountCents: 32000 },
    ]);
  });
});

describe("cobrança travada e inativar com alunos (25/11/2026)", () => {
  beforeEach(() => resetAcademy());

  it("antes da 1ª matrícula o valor muda; com aluno ativo trava; sem aluno ativo, só as datas do curso iniciado", async () => {
    const g = await courseClass();
    expect((await turmasService.update(g.id, { coursePriceCents: 25000 })).coursePriceCents).toBe(25000);

    const student = await createStudent("Ana");
    const enrollment = await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice({ priceCents: 25000 }) });
    expect((await turmasService.getById(g.id)).billingLocked).toBe(true);

    await expect(turmasService.update(g.id, { coursePriceCents: 2000 })).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "coursePriceCents", message: "Já há alunos matriculados. Para mudar a cobrança, duplique a turma." }],
    });
    await expect(turmasService.update(g.id, { billingMode: "membership" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(turmasService.update(g.id, { endDate: "2026-12-31" })).rejects.toMatchObject({ code: "VALIDATION" });
    // O que nao mexe na cobranca segue livre.
    expect((await turmasService.update(g.id, { name: "Confeitaria II", capacity: 12 })).name).toBe("Confeitaria II");

    // Sem aluno ativo (27/11/2026): a cobranca libera; o curso ja comecou (14/09)
    // com aluno, entao as datas seguem travadas (as aulas dadas seguem o periodo).
    await turmasService.cancelEnrollment(enrollment.id);
    const unlocked = await turmasService.getById(g.id);
    expect(unlocked).toMatchObject({ billingLocked: false, courseDatesLocked: true });
    expect((await turmasService.update(g.id, { courseMaxInstallments: 2, coursePriceCents: 30000 })).coursePriceCents).toBe(30000);
    await expect(turmasService.update(g.id, { endDate: "2026-12-31" })).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "endDate", message: "O curso já teve aulas. Para uma nova turma, duplique." }],
    });
    // As cobrancas ja geradas guardam o proprio valor.
    expect(courseCharges(student.id).every((c) => c.amountCents <= 25000)).toBe(true);
  });

  it("curso que ainda não começou: sem aluno ativo, as datas também liberam", async () => {
    const g = await courseClass({ startDate: "2026-10-05" });
    const student = await createStudent("Duda");
    const enrollment = await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice({ firstDueDate: "2026-10-05" }) });
    expect((await turmasService.getById(g.id)).courseDatesLocked).toBe(true);
    await turmasService.cancelEnrollment(enrollment.id);
    expect((await turmasService.getById(g.id)).courseDatesLocked).toBe(false);
    expect((await turmasService.update(g.id, { endDate: "2026-12-31" })).endDate).toBe("2026-12-31");
  });

  it("com alunos ativos não inativa; sem alunos, inativa", async () => {
    const g = await courseClass();
    const student = await createStudent("Bia");
    const enrollment = await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });

    await expect(turmasService.deactivate(g.id)).rejects.toMatchObject({
      code: "VALIDATION",
      message: "A turma tem 1 aluno ativo. Mude os alunos de turma ou encerre a matrícula de cada um antes de inativar.",
    });
    expect(store.classGroups.find((x) => x.id === g.id)?.status).toBe("active");

    await turmasService.cancelEnrollment(enrollment.id);
    expect((await turmasService.deactivate(g.id)).status).toBe("inactive");
  });

  it("turma que já teve aula diz quantas no bloqueio", async () => {
    const g = await courseClass();
    const student = await createStudent("Caio");
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id, course: choice() });
    const [slot] = g.meetingSlots;
    await turmasService.markAttendance({ sessionId: `${g.id}~2026-09-21~${slot.start}`, studentId: student.id, status: "present" });

    await expect(turmasService.deactivate(g.id)).rejects.toMatchObject({
      message: "A turma já teve 1 aula e tem 1 aluno ativo. Mude os alunos de turma ou encerre a matrícula de cada um antes de inativar.",
    });
  });
});
