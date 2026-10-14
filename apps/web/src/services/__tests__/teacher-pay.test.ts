import type { ClassGroupView, ProfessionalView, TeacherPayoutView } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { professionalsService } from "@/services/professionalsService";
import { teacherPayService } from "@/services/teacherPayService";
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

const perSession = (amountCents: number) => ({ kind: "per_session" as const, amountCents });
const perStudent = (amountCents: number) => ({ kind: "per_student" as const, amountCents });
const percent = (value: number) => ({ kind: "percent_of_memberships" as const, percent: value });

/** Moeda formatada usa espaço não separável; os asserts usam espaço comum. */
const plain = (text: string) => text.replace(/\u00a0/g, " ");

async function payoutOf(professionalId: string, competence: string): Promise<TeacherPayoutView | undefined> {
  const view = (await teacherPayService.listPayouts(competence)).find((p) => p.professionalId === professionalId);
  return view && { ...view, lines: view.lines.map((l) => ({ ...l, label: plain(l.label) })) };
}

const lastAudit = () => plain(store.auditLog.at(-1)?.summary ?? "");

/**
 * Turma seg e qua 17h desde 01/09. Até hoje (ter 22/09, 12h) foram dadas 6
 * aulas: 02, 07, 09, 14, 16 e 21/09.
 */
async function septemberSetup(): Promise<{ teacher: ProfessionalView; group: ClassGroupView }> {
  const teacher = await createInstructor("Carlos");
  const group = await createClass({
    instructorId: teacher.id,
    startDate: "2026-09-01",
    slots: [
      { weekday: 1, start: "17:00", end: "18:00" },
      { weekday: 3, start: "17:00", end: "18:00" },
    ],
  });
  const student = await createStudent("Aluno 1");
  await turmasService.enroll({ classGroupId: group.id, studentId: student.id });
  await teacherPayService.saveRule(teacher.id, {
    components: [perSession(6000), perStudent(1000)],
    startCompetence: "2026-09",
  });
  return { teacher, group };
}

describe("cálculo do pagamento dos professores", () => {
  beforeEach(() => resetAcademy());

  it("R$ 60 por aula: 16 aulas, 1 dada por substituto → 15 para o titular e 1 para o substituto", async () => {
    // Agosto/2026 tem 4 terças, 4 quartas, 4 quintas e 4 sextas = 16 aulas.
    const titular = await createInstructor("Carlos");
    const substitute = await createInstructor("Bruno");
    const group = await createClass({
      instructorId: titular.id,
      startDate: "2026-08-01",
      slots: [2, 3, 4, 5].map((weekday) => ({ weekday: weekday as 2 | 3 | 4 | 5, start: "17:00", end: "18:00" })),
    });
    await turmasService.substituteInstructor(sessionIdOf(group.id, "2026-08-12", "17:00"), {
      instructorId: substitute.id,
    });
    for (const p of [titular, substitute]) {
      await teacherPayService.saveRule(p.id, { components: [perSession(6000)], startCompetence: "2026-08" });
    }

    const t = await payoutOf(titular.id, "2026-08");
    const s = await payoutOf(substitute.id, "2026-08");
    expect(t?.lines).toEqual([{ kind: "per_session", label: "15 aulas × R$ 60,00", quantity: 15, amountCents: 90000 }]);
    expect(t).toMatchObject({ status: "open", totalCents: 90000, dueDate: "2026-09-05" });
    expect(s).toMatchObject({ totalCents: 6000, lines: [{ quantity: 1 }] });

    const detail = await teacherPayService.getPayoutPreview(titular.id, "2026-08");
    expect(detail.sessions).toHaveLength(15);
    expect(detail.substitutedSessions.map((x) => `${x.date} ${x.instructorName}`)).toEqual(["2026-08-12 Bruno"]);
  });

  it("40% das mensalidades: aluno em turmas de dois professores divide igualmente", async () => {
    const a = await createInstructor("Ana");
    const b = await createInstructor("Beto");
    const ga = await createClass({ name: "Manhã", instructorId: a.id, slots: [{ weekday: 1, start: "08:00", end: "09:00" }] });
    const gb = await createClass({ name: "Noite", instructorId: b.id, slots: [{ weekday: 1, start: "19:00", end: "20:00" }] });
    const plan = await createPlan("monthly", 20000);
    const both = await enrollStudent({ plan, name: "Duas turmas", startDate: "2026-09-01", strategy: "full_cycle" });
    const onlyA = await enrollStudent({ plan, name: "Só manhã", startDate: "2026-09-01", strategy: "full_cycle" });
    await turmasService.enroll({ classGroupId: ga.id, studentId: both.id });
    await turmasService.enroll({ classGroupId: gb.id, studentId: both.id });
    await turmasService.enroll({ classGroupId: ga.id, studentId: onlyA.id });
    for (const c of store.charges) await billingService.markPaid(c.id, "pix");
    for (const p of [a, b]) {
      await teacherPayService.saveRule(p.id, { components: [percent(40)], startCompetence: "2026-09" });
    }

    // Ana: 10.000 (metade) + 20.000 = 30.000 de base; Beto: 10.000.
    expect((await payoutOf(a.id, "2026-09"))?.lines).toEqual([
      { kind: "percent_of_memberships", label: "40% de R$ 300,00", baseCents: 30000, amountCents: 12000 },
    ]);
    expect((await payoutOf(b.id, "2026-09"))?.lines).toMatchObject([{ baseCents: 10000, amountCents: 4000 }]);
  });

  it("mensalidade em aberto não entra no %", async () => {
    const a = await createInstructor("Ana");
    const ga = await createClass({ instructorId: a.id, slots: [{ weekday: 1, start: "08:00", end: "09:00" }] });
    const plan = await createPlan("monthly", 20000);
    const s = await enrollStudent({ plan, startDate: "2026-09-01", strategy: "full_cycle" });
    await turmasService.enroll({ classGroupId: ga.id, studentId: s.id });
    await teacherPayService.saveRule(a.id, { components: [percent(40)], startCompetence: "2026-09" });
    expect((await payoutOf(a.id, "2026-09"))?.totalCents).toBe(0);
  });

  it("regra que começa depois não aparece no mês", async () => {
    const { teacher } = await septemberSetup();
    expect(await payoutOf(teacher.id, "2026-08")).toBeUndefined();
    await expect(teacherPayService.getPayoutPreview(teacher.id, "2026-08")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("fechamento do mês", () => {
  beforeEach(() => resetAcademy());

  it("fechar congela o valor; reabrir recalcula mantendo os ajustes", async () => {
    const { teacher, group } = await septemberSetup();
    const open = await payoutOf(teacher.id, "2026-09");
    expect(open).toMatchObject({ status: "open", totalCents: 6 * 6000 + 1000 });

    const closed = await teacherPayService.closePayout(teacher.id, "2026-09", [{ label: "Bônus seminário", amountCents: 5000 }]);
    expect(closed).toMatchObject({ status: "closed", totalCents: 37000 + 5000 });
    expect(lastAudit()).toBe("Ana Ribeiro fechou o pagamento de Carlos de 09/2026 (R$ 420,00)");

    // Correções depois do fechamento não mudam o valor.
    const other = await createInstructor("Bruno");
    await turmasService.substituteInstructor(sessionIdOf(group.id, "2026-09-14", "17:00"), { instructorId: other.id });
    const late = await createStudent("Aluno 2");
    await turmasService.enroll({ classGroupId: group.id, studentId: late.id });
    expect(await payoutOf(teacher.id, "2026-09")).toMatchObject({ status: "closed", totalCents: 42000 });

    await teacherPayService.reopenPayout(closed.payout!.id);
    const reopened = await payoutOf(teacher.id, "2026-09");
    expect(reopened?.status).toBe("open");
    expect(reopened?.lines.map((l) => `${l.kind} ${l.amountCents}`)).toEqual([
      "per_session 30000", // 5 aulas (uma foi do substituto)
      "per_student 2000", // 2 alunos
      "adjustment 5000", // o ajuste ficou
    ]);
    expect(reopened?.totalCents).toBe(37000);
    const record = store.teacherPayouts.find((p) => p.id === closed.payout!.id)!;
    expect(record).toMatchObject({ status: "open", closedAt: undefined, totalCents: 5000 });
    expect(record.lines.every((l) => l.kind === "adjustment")).toBe(true);
  });

  it("fechar de novo depois de reabrir reaproveita o registro", async () => {
    const { teacher } = await septemberSetup();
    const first = await teacherPayService.closePayout(teacher.id, "2026-09");
    await teacherPayService.reopenPayout(first.payout!.id);
    const second = await teacherPayService.closePayout(teacher.id, "2026-09");
    expect(second.payout?.id).toBe(first.payout?.id);
    expect(store.teacherPayouts).toHaveLength(1);
  });

  it("recusa mês que ainda não começou, mês já fechado e total negativo", async () => {
    const { teacher } = await septemberSetup();
    await expect(teacherPayService.closePayout(teacher.id, "2026-10")).rejects.toMatchObject({
      httpStatus: 409,
      message: "Não é possível fechar um mês que ainda não começou.",
    });
    await expect(
      teacherPayService.closePayout(teacher.id, "2026-09", [{ label: "Vale", amountCents: -100000 }]),
    ).rejects.toMatchObject({
      fields: [{ field: "adjustments", message: "Os descontos deixam o total do mês negativo." }],
    });
    expect(store.teacherPayouts).toHaveLength(0);
    await teacherPayService.closePayout(teacher.id, "2026-09");
    await expect(teacherPayService.closePayout(teacher.id, "2026-09")).rejects.toMatchObject({
      httpStatus: 409,
      message: "Este mês já está fechado.",
    });
  });

  it("recusa professor sem regra vigente e ajuste inválido", async () => {
    const { teacher } = await septemberSetup();
    const noRule = await createInstructor("Sem regra");
    await expect(teacherPayService.closePayout(noRule.id, "2026-09")).rejects.toMatchObject({ httpStatus: 409 });
    await expect(teacherPayService.closePayout(teacher.id, "2026-08")).rejects.toMatchObject({ httpStatus: 409 });
    await expect(
      teacherPayService.closePayout(teacher.id, "2026-09", [{ label: " ", amountCents: 0 }]),
    ).rejects.toMatchObject({
      fields: [
        { field: "adjustments.0.label", message: "Descreva o ajuste." },
        { field: "adjustments.0.amountCents", message: "Informe um valor diferente de zero." },
      ],
    });
  });

  it("professor inativado mantém o mês fechado", async () => {
    const { teacher } = await septemberSetup();
    await teacherPayService.closePayout(teacher.id, "2026-09");
    await professionalsService.update(teacher.id, { status: "inactive" });
    expect(await payoutOf(teacher.id, "2026-09")).toMatchObject({
      status: "closed",
      totalCents: 37000,
      professionalStatus: "inactive",
    });
  });
});

describe("pagamento do mês", () => {
  beforeEach(() => resetAcademy());

  it("paga só mês fechado; desfazer volta para fechado; pago não reabre", async () => {
    const { teacher } = await septemberSetup();
    const draft = await teacherPayService.saveAdjustments(teacher.id, "2026-09", [{ label: "Bônus", amountCents: 1000 }]);
    const openId = store.teacherPayouts[0].id;
    expect(draft.status).toBe("open");
    await expect(teacherPayService.markPayoutPaid(openId, "pix")).rejects.toMatchObject({
      httpStatus: 409,
      message: "Feche o mês antes de pagar.",
    });

    const closed = await teacherPayService.closePayout(teacher.id, "2026-09", [{ label: "Bônus", amountCents: 1000 }]);
    const id = closed.payout!.id;
    await expect(teacherPayService.markPayoutPaid(id, "bitcoin" as never)).rejects.toMatchObject({
      fields: [{ field: "method" }],
    });
    const paid = await teacherPayService.markPayoutPaid(id, "pix");
    expect(paid).toMatchObject({ status: "paid", method: "pix", totalCents: 38000 });
    expect(paid.paidAt).toBeTruthy();
    expect(lastAudit()).toBe("Ana Ribeiro registrou o pagamento de Carlos de 09/2026 (R$ 380,00 via Pix)");

    await expect(teacherPayService.markPayoutPaid(id, "pix")).rejects.toMatchObject({
      message: "Este pagamento já foi registrado.",
    });
    await expect(teacherPayService.reopenPayout(id)).rejects.toMatchObject({
      httpStatus: 409,
      message: "Desfaça o pagamento antes de reabrir o mês.",
    });

    const undone = await teacherPayService.markPayoutUnpaid(id);
    expect(undone).toMatchObject({ status: "closed", paidAt: undefined, method: undefined, totalCents: 38000 });
    await expect(teacherPayService.markPayoutUnpaid(id)).rejects.toMatchObject({ httpStatus: 409 });
    expect(id).toBe(openId); // o fechamento reaproveitou o rascunho
  });

  it("reabrir exige mês fechado", async () => {
    const { teacher } = await septemberSetup();
    await teacherPayService.saveAdjustments(teacher.id, "2026-09", [{ label: "Bônus", amountCents: 1000 }]);
    await expect(teacherPayService.reopenPayout(store.teacherPayouts[0].id)).rejects.toMatchObject({
      message: "Este mês não está fechado.",
    });
  });
});

describe("ajustes salvos sem fechar", () => {
  beforeEach(() => resetAcademy());

  it("grava registro aberto só com ajustes; a prévia soma o ajuste; audita incluir e remover", async () => {
    const { teacher } = await septemberSetup();
    const view = await teacherPayService.saveAdjustments(teacher.id, "2026-09", [{ label: "Vale", amountCents: -5000 }]);
    expect(view).toMatchObject({ status: "open", totalCents: 37000 - 5000 });
    expect(store.teacherPayouts).toEqual([
      expect.objectContaining({
        status: "open",
        lines: [{ kind: "adjustment", label: "Vale", amountCents: -5000 }],
      }),
    ]);
    expect(lastAudit()).toBe('Ana Ribeiro adicionou o ajuste "Vale" (− R$ 50,00) no pagamento de Carlos de 09/2026');
    expect((await payoutOf(teacher.id, "2026-09"))?.totalCents).toBe(32000);

    await teacherPayService.saveAdjustments(teacher.id, "2026-09", []);
    expect(lastAudit()).toBe('Ana Ribeiro removeu o ajuste "Vale" (− R$ 50,00) no pagamento de Carlos de 09/2026');
    expect((await payoutOf(teacher.id, "2026-09"))?.totalCents).toBe(37000);
    expect(store.teacherPayouts).toHaveLength(1);
  });

  it("salvar sem mudança não audita", async () => {
    const { teacher } = await septemberSetup();
    await teacherPayService.saveAdjustments(teacher.id, "2026-09", [{ label: "Bônus", amountCents: 1000 }]);
    const count = store.auditLog.length;
    await teacherPayService.saveAdjustments(teacher.id, "2026-09", [{ label: "Bônus", amountCents: 1000 }]);
    expect(store.auditLog.length).toBe(count);
  });

  it("total negativo pode ficar salvo, mas o fechamento recusa", async () => {
    const { teacher } = await septemberSetup();
    const adjustments = [{ label: "Vale", amountCents: -100000 }];
    const view = await teacherPayService.saveAdjustments(teacher.id, "2026-09", adjustments);
    expect(view.totalCents).toBe(0); // total exibido nunca é negativo
    await expect(teacherPayService.closePayout(teacher.id, "2026-09", adjustments)).rejects.toMatchObject({
      fields: [{ field: "adjustments" }],
    });
  });

  it("recusa mês fechado e professor sem regra vigente", async () => {
    const { teacher } = await septemberSetup();
    await expect(
      teacherPayService.saveAdjustments(teacher.id, "2026-08", [{ label: "Bônus", amountCents: 1000 }]),
    ).rejects.toMatchObject({ httpStatus: 409 });
    await teacherPayService.closePayout(teacher.id, "2026-09");
    await expect(
      teacherPayService.saveAdjustments(teacher.id, "2026-09", [{ label: "Bônus", amountCents: 1000 }]),
    ).rejects.toMatchObject({
      httpStatus: 409,
      message: "Este mês já está fechado. Reabra o mês para mudar os ajustes.",
    });
  });

  it("fechar sem mandar ajustes usa os ajustes salvos no mês", async () => {
    const { teacher } = await septemberSetup();
    await teacherPayService.saveAdjustments(teacher.id, "2026-09", [{ label: "Bônus", amountCents: 3000 }]);
    const closed = await teacherPayService.closePayout(teacher.id, "2026-09");
    expect(closed.totalCents).toBe(40000);
    expect(closed.payout?.lines.at(-1)).toEqual({ kind: "adjustment", label: "Bônus", amountCents: 3000 });
  });

  it("fechar mandando lista vazia tira os ajustes salvos", async () => {
    const { teacher } = await septemberSetup();
    await teacherPayService.saveAdjustments(teacher.id, "2026-09", [{ label: "Bônus", amountCents: 3000 }]);
    const closed = await teacherPayService.closePayout(teacher.id, "2026-09", []);
    expect(closed.totalCents).toBe(37000);
  });

  it("fechar com os ajustes salvos congela o valor com eles; reabrir os mantém", async () => {
    const { teacher } = await septemberSetup();
    const adjustments = [{ label: "Bônus", amountCents: 3000 }];
    await teacherPayService.saveAdjustments(teacher.id, "2026-09", adjustments);
    const closed = await teacherPayService.closePayout(teacher.id, "2026-09", adjustments);
    expect(closed.totalCents).toBe(40000);
    await teacherPayService.reopenPayout(closed.payout!.id);
    expect((await payoutOf(teacher.id, "2026-09"))?.lines.at(-1)).toEqual({
      kind: "adjustment",
      label: "Bônus",
      amountCents: 3000,
    });
  });
});

describe("regra de pagamento", () => {
  beforeEach(() => resetAcademy());

  it("valida partes, valores, porcentagem, turmas e dia", async () => {
    const a = await createInstructor("Ana");
    const b = await createInstructor("Beto");
    const gb = await createClass({ instructorId: b.id, slots: [{ weekday: 1, start: "19:00", end: "20:00" }] });
    const save = (payload: Parameters<typeof teacherPayService.saveRule>[1]) => teacherPayService.saveRule(a.id, payload);

    await expect(save({ components: [], startCompetence: "2026-09" })).rejects.toMatchObject({
      fields: [{ field: "components", message: "Adicione ao menos uma parte ao pagamento." }],
    });
    await expect(save({ components: [perSession(0)], startCompetence: "2026-09" })).rejects.toMatchObject({
      fields: [{ field: "components.0.amountCents", message: "Informe um valor maior que zero." }],
    });
    await expect(save({ components: [percent(120)], startCompetence: "2026-09" })).rejects.toMatchObject({
      fields: [{ field: "components.0.percent", message: "Informe uma porcentagem maior que 0 e até 100." }],
    });
    await expect(
      save({ components: [{ ...perSession(6000), classGroupIds: [gb.id] }], startCompetence: "2026-09" }),
    ).rejects.toMatchObject({
      fields: [{ field: "components.0.classGroupIds", message: "Escolha apenas turmas em que o professor é titular." }],
    });
    await expect(save({ components: [perSession(6000)], paymentDay: 29, startCompetence: "2026-09" })).rejects.toMatchObject({
      fields: [{ field: "paymentDay", message: "Informe um dia entre 1 e 28." }],
    });
    await expect(save({ components: [perSession(6000)], startCompetence: "2026-13" })).rejects.toMatchObject({
      fields: [{ field: "startCompetence" }],
    });
    expect(store.teacherPayRules).toHaveLength(0);
  });

  it("uma regra por professor: salvar de novo substitui e audita", async () => {
    const a = await createInstructor("Ana");
    await teacherPayService.saveRule(a.id, { components: [perSession(6000)], startCompetence: "2026-09" });
    expect(lastAudit()).toBe("Ana Ribeiro configurou o pagamento de Ana (R$ 60,00 por aula)");
    await teacherPayService.saveRule(a.id, {
      components: [{ kind: "fixed_monthly", amountCents: 80000 }, percent(30)],
      paymentDay: 10,
      startCompetence: "2026-09",
    });
    expect(store.teacherPayRules).toHaveLength(1);
    expect(store.teacherPayRules[0]).toMatchObject({ paymentDay: 10, status: "active" });
    expect(lastAudit()).toBe("Ana Ribeiro atualizou a regra de pagamento de Ana (Fixo R$ 800,00 + 30% das mensalidades)");
    expect(plain(JSON.stringify(store.auditLog.at(-1)?.changes))).toBe(
      JSON.stringify([
        { field: "components", label: "Regra", before: "R$ 60,00 por aula", after: "Fixo R$ 800,00 + 30% das mensalidades" },
      ]),
    );
    expect((await payoutOf(a.id, "2026-09"))?.dueDate).toBe("2026-10-10");
  });

  it("regra inativa não gera prévia", async () => {
    const a = await createInstructor("Ana");
    await teacherPayService.saveRule(a.id, {
      components: [{ kind: "fixed_monthly", amountCents: 80000 }],
      startCompetence: "2026-09",
      status: "inactive",
    });
    expect(await payoutOf(a.id, "2026-09")).toBeUndefined();
  });
});
