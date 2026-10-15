import { beforeEach, describe, expect, it } from "vitest";
import { resolveModalityTrack } from "@/lib/progression-tracks";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { categoriesService } from "@/services/categoriesService";
import { clientsService } from "@/services/clientsService";
import { communicationService } from "@/services/communicationService";
import { packagesService } from "@/services/packagesService";
import { studentSummaryService } from "@/services/studentSummaryService";
import { turmasService } from "@/services/turmasService";
import {
  createClass,
  createInstructor,
  createPlan,
  createStudent,
  enrollStudent,
  resetAcademy,
  sessionIdOf,
} from "@/test/academy";

/**
 * Resumo do aluno (ficha do aluno, doc 22 item 2): composto do store, sem
 * gravar nada novo. Hoje congelado em 22/09/2026 (terca); as aulas de segunda
 * caem em 14 e 21/09.
 */

const summaryOf = (id: string) => studentSummaryService.getStudentSummary(id);

beforeEach(() => resetAcademy());

describe("resumo do aluno: cadastro e mensalidade", () => {
  it("aluno inexistente responde não encontrado", async () => {
    await expect(summaryOf("nao-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("traz idade, dias até o aniversário, aluno desde e o plano com a bolsa vigente", async () => {
    const plan = await createPlan("monthly", 20000, "Mensal");
    const student = await enrollStudent({ name: "Bia", plan, startDate: "2026-09-01" });
    await clientsService.update(student.id, {
      birthDate: "2010-09-25",
      discount: { type: "percentage", value: 50, scholarship: true, reason: "Atleta" },
    });

    const summary = await summaryOf(student.id);
    expect(summary.student.name).toBe("Bia");
    expect(summary.age).toBe(15);
    expect(summary.daysToBirthday).toBe(3);
    expect(summary.studentSince).toBe("2026-09-22");
    expect(summary.membership).toMatchObject({
      planId: plan.id,
      planName: "Mensal",
      planPeriod: "monthly",
      listPriceCents: 20000,
      priceCents: 10000,
      status: "active",
      scholarship: { percent: 50, full: false, reason: "Atleta" },
      recurringActive: false,
    });
  });

  it("sem plano e sem nascimento: campos vazios, sem bolsa", async () => {
    const student = await createStudent("Caio");
    const summary = await summaryOf(student.id);
    expect(summary.age).toBeNull();
    expect(summary.daysToBirthday).toBeNull();
    expect(summary.membership.planId).toBeUndefined();
    expect(summary.membership.scholarship).toBeUndefined();
    expect(summary.membership.status).toBe("active");
  });
});

describe("resumo do aluno: saldo em aberto", () => {
  it("soma pendentes e atrasadas de todos os tipos; paga e cancelada ficam fora", async () => {
    const student = await createStudent("Duda");
    const [first, second] = await billingService.createExtraCharge({
      studentId: student.id,
      description: "Uniforme",
      totalCents: 10000,
      installments: 2,
      firstDueDate: "2026-09-10",
    });
    const [third] = await billingService.createExtraCharge({
      studentId: student.id,
      description: "Exame",
      totalCents: 3000,
      installments: 1,
      firstDueDate: "2026-10-05",
    });

    expect((await summaryOf(student.id)).openBalance).toEqual({
      totalCents: 13000,
      count: 3,
      overdueCents: 5000,
      overdueCount: 1,
    });

    await billingService.markPaid(first.id, "pix");
    await billingService.cancelCharge(third.id);
    expect((await summaryOf(student.id)).openBalance).toEqual({
      totalCents: second.amountCents,
      count: 1,
      overdueCents: 0,
      overdueCount: 0,
    });
  });

  it("não mistura cobranças de outro aluno", async () => {
    const student = await createStudent("Eva");
    const other = await createStudent("Fábio");
    await billingService.createExtraCharge({
      studentId: other.id,
      description: "Uniforme",
      totalCents: 8000,
      installments: 1,
      firstDueDate: "2026-09-30",
    });
    expect((await summaryOf(student.id)).openBalance.count).toBe(0);
  });
});

describe("resumo do aluno: matrículas, frequência e nível", () => {
  it("lista matrículas ativas, concluídas e canceladas com as parcelas do curso", async () => {
    const teacher = await createInstructor("Paula");
    const regular = await createClass({
      name: "Adulto",
      instructorId: teacher.id,
      slots: [{ weekday: 1, start: "07:00", end: "08:00" }],
    });
    const course = await turmasService.create({
      name: "Oficina",
      modalityId: teacher.modalityIds?.[0] ?? "",
      instructorId: teacher.id,
      capacity: 10,
      allowDropin: false,
      meetingSlots: [{ weekday: 2, start: "09:00", end: "10:00" }],
      startDate: "2026-09-01",
      endDate: "2026-12-15",
      billingMode: "course",
      coursePriceCents: 60000,
      courseMaxInstallments: 3,
      status: "active",
    });
    const other = await createClass({
      name: "Kids",
      instructorId: teacher.id,
      slots: [{ weekday: 3, start: "17:00", end: "18:00" }],
    });
    const student = await createStudent("Gabi");
    await turmasService.enroll({ classGroupId: regular.id, studentId: student.id });
    await turmasService.enroll({
      classGroupId: course.id,
      studentId: student.id,
      course: { priceCents: 60000, installments: 3, firstDueDate: "2026-09-15" },
    });
    const canceled = await turmasService.enroll({ classGroupId: other.id, studentId: student.id });
    await turmasService.cancelEnrollment(canceled.id);

    let summary = await summaryOf(student.id);
    // Ativas primeiro (mesmo dia: pelo nome), canceladas no fim.
    expect(summary.enrollments.map((e) => `${e.className} ${e.state} ${e.billingMode}`)).toEqual([
      "Adulto active membership",
      "Oficina active course",
      "Kids canceled membership",
    ]);
    expect(summary.enrollments[1].course).toEqual({
      priceCents: 60000,
      installments: 3,
      paid: 0,
      paidCents: 0,
      open: 3,
      openCents: 60000,
      overdue: 1,
    });
    expect(summary.enrollments[2].canceledAt).toBeDefined();

    // Curso que terminou com o aluno ate o fim: "Concluído".
    store.classGroups.find((g) => g.id === course.id)!.endDate = "2026-09-20";
    summary = await summaryOf(student.id);
    expect(summary.enrollments.find((e) => e.classGroupId === course.id)?.state).toBe("completed");
  });

  it("frequência dos últimos 30 dias: justificada não conta na taxa", async () => {
    const teacher = await createInstructor("Rafa");
    const g = await createClass({
      instructorId: teacher.id,
      slots: [{ weekday: 1, start: "07:00", end: "08:00" }],
    });
    const student = await createStudent("Hugo");
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id });
    await turmasService.markAttendance({
      sessionId: sessionIdOf(g.id, "2026-09-14", "07:00"),
      studentId: student.id,
      status: "absent",
    });
    await turmasService.markAttendance({
      sessionId: sessionIdOf(g.id, "2026-09-21", "07:00"),
      studentId: student.id,
      status: "present",
    });
    // Fora da janela de 30 dias (aula antiga).
    store.attendances.push({
      id: "att-old",
      sessionId: sessionIdOf(g.id, "2026-08-10", "07:00"),
      studentId: student.id,
      status: "present",
      markedAt: "2026-08-10T08:00:00.000Z",
    });

    const summary = await summaryOf(student.id);
    expect(summary.attendance30d).toEqual({ days: 30, present: 1, absent: 1, justified: 0, rate: 0.5 });
    // Na turma conta tudo o que foi marcado.
    expect(summary.enrollments[0]).toMatchObject({ presentCount: 2, absentCount: 1 });
  });

  it("nível atual por modalidade com as palavras da trilha e os últimos registros", async () => {
    const jiu = await categoriesService.create({ name: "Jiu-Jitsu" });
    const teacher = await createInstructor("Léo", jiu.id);
    const g = await createClass({
      name: "Jiu adulto",
      instructorId: teacher.id,
      slots: [{ weekday: 1, start: "19:00", end: "20:00" }],
    });
    const student = await createStudent("Igor");
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id });

    let summary = await summaryOf(student.id);
    const firstLevel = resolveModalityTrack(store.categories.find((c) => c.id === jiu.id)).levels[0];
    expect(summary.levels).toHaveLength(1);
    expect(summary.levels[0]).toMatchObject({
      modalityId: jiu.id,
      modalityName: "Jiu-Jitsu",
      isEnrolled: true,
      levelName: firstLevel.name,
      trackStyle: "belt",
      recordsCount: 0,
      words: { level: "Faixa" },
    });
    expect(summary.levels[0].promotedAt).toBeUndefined();

    await clientsService.addClassRecord({
      studentId: student.id,
      modalityId: jiu.id,
      date: "2026-09-21",
      tone: "positive",
      note: "Boa guarda",
    });
    summary = await summaryOf(student.id);
    expect(summary.levels[0].recordsCount).toBe(1);
    expect(summary.levels[0].lastRecords[0]).toMatchObject({ note: "Boa guarda", date: "2026-09-21" });
  });
});

describe("resumo do aluno: pacotes e mensagens", () => {
  it("só pacotes em uso, com saldo; cancelados ficam fora", async () => {
    const student = await createStudent("Júlia");
    const catalog = await packagesService.createPackage({
      name: "10 aulas",
      lessons: 10,
      priceCents: 50000,
      validityDays: 60,
      modalityIds: [],
      absenceConsumes: true,
      status: "active",
    });
    const sold = await packagesService.sellPackage({
      studentId: student.id,
      packageId: catalog.id,
      priceCents: 50000,
      installments: 1,
      firstDueDate: "2026-09-22",
    });

    let summary = await summaryOf(student.id);
    expect(summary.packages.map((p) => `${p.name} ${p.remaining}`)).toEqual(["10 aulas 10"]);
    expect(summary.openBalance.totalCents).toBe(50000);

    await packagesService.cancelStudentPackage(sold.id);
    summary = await summaryOf(student.id);
    expect(summary.packages).toEqual([]);
    expect(summary.openBalance.count).toBe(0);
  });

  it("últimas mensagens do aluno, da mais nova", async () => {
    const student = await createStudent("Lia");
    const other = await createStudent("Mauro");
    await communicationService.registerAssistedMessage({
      recipientName: "Mauro",
      recipientPhone: "5511977770000",
      content: "Oi Mauro",
      trigger: "manual_broadcast",
      clientId: other.id,
    });
    await communicationService.registerAssistedMessage({
      recipientName: "Lia",
      recipientPhone: "5511977770000",
      content: "Oi Lia",
      trigger: "manual_broadcast",
      clientId: student.id,
    });

    const summary = await summaryOf(student.id);
    expect(summary.lastMessages.map((m) => m.content)).toEqual(["Oi Lia"]);
    const logs = await communicationService.listLogs({ clientId: student.id });
    expect(logs.map((m) => m.recipientName)).toEqual(["Lia"]);
  });
});
