import type { Charge, ClassGroupView, CreateClassGroup, ProfessionalView } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billing";
import { clientsService } from "@/services/clients";
import { financeService } from "@/services/finance";
import { teacherPayService } from "@/services/finance";
import { turmasService } from "@/services/classes";
import {
  ACADEMY_ORG,
  createInstructor,
  createPlan,
  createStudent,
  enrollStudent,
  resetAcademy,
} from "@/test/academy";

/**
 * Regras do dinheiro da rodada de testes de 18/10/2026 (Prioridade 1): meses
 * pulados, desconto do valor todo, data e comprovante do pagamento, pausa e
 * volta do aluno, pagamento atrasado no repasse e rematricula no curso.
 * Hoje congelado em 22/09/2026 (terca); academia antecipada, proporcional, dia 10.
 */

const memberships = (studentId: string, opts: { includeCanceled?: boolean } = {}): Charge[] =>
  store.charges
    .filter(
      (c) =>
        c.studentId === studentId &&
        c.kind === "membership" &&
        (opts.includeCanceled || c.status !== "canceled"),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
const brief = (c: Charge) => `${c.periodStart} ${c.amountCents} ${c.status}`;
const localDate = (iso?: string) => {
  const d = new Date(iso ?? "");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const at = (date: string) => vi.setSystemTime(new Date(`${date}T12:00:00`));

let slotHour = 6;
const nextSlot = () => {
  const start = `${String(slotHour).padStart(2, "0")}:00`;
  const end = `${String(slotHour + 1).padStart(2, "0")}:00`;
  slotHour += 1;
  return [{ weekday: 1 as const, start, end }];
};

function classOf(teacher: ProfessionalView, over: Partial<CreateClassGroup> = {}): Promise<ClassGroupView> {
  return turmasService.create({
    name: "Turma",
    modalityId: teacher.modalityIds?.[0] ?? "",
    instructorId: teacher.id,
    capacity: 10,
    allowDropin: false,
    meetingSlots: nextSlot(),
    startDate: "2026-09-01",
    status: "active",
    ...over,
  });
}

beforeEach(() => {
  resetAcademy();
  slotHour = 6;
});

describe("desconto do valor todo", () => {
  it("desconto acima do plano é recusado; percentual acima de 100% também", async () => {
    const plan = await createPlan("monthly", 15000);
    await expect(
      clientsService.create({
        name: "Aluno",
        phone: "11977770000",
        status: "active",
        planId: plan.id,
        planStartDate: "2026-09-01",
        discount: { type: "fixed", value: 20000 },
      }),
    ).rejects.toMatchObject({ fields: [{ field: "discountValue" }] });
    await expect(
      clientsService.create({
        name: "Aluno",
        phone: "11977770000",
        status: "active",
        planId: plan.id,
        planStartDate: "2026-09-01",
        discount: { type: "percentage", value: 120 },
      }),
    ).rejects.toMatchObject({ fields: [{ field: "discountValue" }] });
  });

  it("desconto de 100% ou do preço do plano gera mensalidade isenta, nunca R$ 0 a cobrar", async () => {
    const plan = await createPlan("monthly", 15000);
    const percent = await clientsService.create({
      name: "Cem por cento",
      phone: "11977770000",
      status: "active",
      planId: plan.id,
      planStartDate: "2026-09-01",
      discount: { type: "percentage", value: 100 },
    });
    const fixed = await clientsService.create({
      name: "Valor todo",
      phone: "11977770001",
      status: "active",
      planId: plan.id,
      planStartDate: "2026-09-01",
      discount: { type: "fixed", value: 15000 },
    });
    await billingService.listCharges();
    expect(memberships(percent.id).map(brief)).toEqual(["2026-09-01 0 waived"]);
    expect(memberships(fixed.id).map(brief)).toEqual(["2026-09-01 0 waived"]);
    const overdue = await billingService.listCharges({ status: "overdue" });
    expect(overdue.filter((c) => c.amountCents === 0)).toEqual([]);
  });
});

describe("data e comprovante do pagamento", () => {
  it("guarda o dia informado e os comprovantes; desfazer limpa os dois", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-01" });
    const [sept] = memberships(s.id);
    const receipt = {
      id: "file-1",
      name: "pix.png",
      contentType: "image/png",
      sizeBytes: 100,
      uploadedAt: "2026-09-22T12:00:00.000Z",
    };
    const paid = await billingService.markPaid(sept.id, "pix", { paidOn: "2026-09-05", receipts: [receipt] });
    expect(localDate(paid.paidAt)).toBe("2026-09-05");
    expect(paid.attachments).toEqual([receipt]);
    expect(store.auditLog.at(-1)?.summary).toContain("em 05/09/2026");

    const undone = await billingService.markPending(sept.id);
    expect(undone.attachments).toBeUndefined();
    expect(undone.paidAt).toBeUndefined();
  });

  it("data no futuro é recusada, na cobrança e no lançamento", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-01" });
    const [sept] = memberships(s.id);
    await expect(billingService.markPaid(sept.id, "pix", { paidOn: "2026-09-23" })).rejects.toMatchObject({
      fields: [{ field: "paidOn", message: "A data do pagamento não pode ser futura." }],
    });
    expect(memberships(s.id)[0].status).toBe("pending");

    const entry = await financeService.createEntry({
      type: "expense",
      categoryId: `fcat-${ACADEMY_ORG}-rent`,
      description: "Aluguel",
      amountCents: 100000,
      dueDate: "2026-09-10",
    });
    await expect(financeService.markEntryPaid(entry.id, "pix", [], "2026-10-01")).rejects.toMatchObject({
      fields: [{ field: "paidOn" }],
    });
    const paidEntry = await financeService.markEntryPaid(entry.id, "pix", [], "2026-09-10");
    expect(localDate(paidEntry.paidAt)).toBe("2026-09-10");
  });
});

describe("pausa e volta do aluno", () => {
  it("pausar cancela os períodos que não começaram; retomar cobra proporcional a partir da volta", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-01" });
    await billingService.generateCharges("2026-10");
    expect(memberships(s.id).map(brief)).toEqual(["2026-09-01 15000 pending", "2026-10-01 15000 pending"]);

    await clientsService.update(s.id, { membershipStatus: "paused" });
    // Outubro ainda nao comecou: sai. Setembro (em uso) segue como divida.
    expect(memberships(s.id).map(brief)).toEqual(["2026-09-01 15000 pending"]);

    at("2026-11-20");
    await clientsService.update(s.id, { membershipStatus: "active" });
    await billingService.listCharges({ studentId: s.id });
    const after = memberships(s.id);
    // Sem outubro nem novembro cheio: so de 20/11 ate o fim do mes.
    expect(after.map((c) => c.periodStart)).toEqual(["2026-09-01", "2026-11-20"]);
    expect(after[1]).toMatchObject({ isProrated: true, amountCents: 5500 });
  });

  it("pausar mantém a mensalidade do mês em curso em aberto, a não ser que o dono escolha cancelar", async () => {
    const plan = await createPlan("monthly", 15000);
    const kept = await enrollStudent({ plan, startDate: "2026-09-01" });
    await clientsService.update(kept.id, { membershipStatus: "paused" });
    expect(memberships(kept.id).map(brief)).toEqual(["2026-09-01 15000 pending"]);

    const canceled = await enrollStudent({ plan, startDate: "2026-09-01" });
    await billingService.generateCharges("2026-10");
    await clientsService.update(canceled.id, { membershipStatus: "paused", cancelCurrentMembershipCharge: true });
    // Setembro (em curso) sai a pedido; outubro ainda nao comecou e sai sozinho.
    expect(memberships(canceled.id)).toEqual([]);
    expect(memberships(canceled.id, { includeCanceled: true }).map(brief)).toEqual([
      "2026-09-01 15000 canceled",
      "2026-10-01 15000 canceled",
    ]);
    // A escolha nao fica gravada no cadastro.
    expect(store.clients.find((c) => c.id === canceled.id)).not.toHaveProperty("cancelCurrentMembershipCharge");
  });

  it("a escolha de cancelar o mês não mexe no que já foi pago", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-01" });
    const [charge] = memberships(s.id);
    await billingService.markPaid(charge.id, "pix");
    await clientsService.update(s.id, { membershipStatus: "paused", cancelCurrentMembershipCharge: true });
    expect(memberships(s.id, { includeCanceled: true }).map((c) => c.status)).toEqual(["paid"]);
  });

  it("reativar o aluno recomeça a cobrança na data da volta", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-01" });
    await clientsService.remove(s.id);

    at("2026-11-05");
    const back = await clientsService.update(s.id, { status: "active" });
    expect(back.planStartDate).toBe("2026-11-05");
    await billingService.listCharges({ studentId: s.id });
    expect(memberships(s.id).map((c) => c.periodStart)).toEqual(["2026-09-01", "2026-11-05"]);
  });
});

describe("volta do aluno no Mês cheio (revisão de valores, 30/10/2026)", () => {
  it("reativar recomeça o ciclo na data da volta, sem uma segunda mensalidade cheia duas semanas depois", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-05", strategy: "full_cycle" });
    await clientsService.remove(s.id);

    at("2026-11-20");
    const back = await clientsService.update(s.id, { status: "active" });
    expect(back.planStartDate).toBe("2026-11-20");
    expect(back.dueDay).toBe(20);
    at("2026-12-25");
    await billingService.listCharges({ studentId: s.id });
    const after = memberships(s.id).filter((c) => c.periodStart! >= "2026-11-20");
    expect(after.map((c) => [c.periodStart, c.periodEnd])).toEqual([
      ["2026-11-20", "2026-12-19"],
      ["2026-12-20", "2027-01-19"],
    ]);
  });

  it("dia de cobrança diferente do início no Mês cheio vira o dia do início (sem dias sem cobrança)", async () => {
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-05", strategy: "full_cycle" });
    const edited = await clientsService.update(s.id, { dueDay: 20 });
    expect(edited.dueDay).toBe(5);
  });
});

describe("pagamento atrasado no repasse do professor", () => {
  it("paga depois do fechamento entra uma vez, no próximo mês aberto", async () => {
    const teacher = await createInstructor("Carlos");
    const plan = await createPlan("monthly", 15000);
    const g = await classOf(teacher, { planId: plan.id });
    await teacherPayService.saveRule(teacher.id, {
      components: [{ kind: "percent_of_memberships", percent: 50 }],
      startCompetence: "2026-09",
    });
    const s = await enrollStudent({ plan, startDate: "2026-09-01" });
    await turmasService.enroll({ classGroupId: g.id, studentId: s.id });

    await teacherPayService.closePayout(teacher.id, "2026-09");
    const [sept] = memberships(s.id);
    await billingService.markPaid(sept.id, "pix");

    // Setembro fechado nao muda; a mensalidade entra em outubro.
    const [septView] = await teacherPayService.listPayouts("2026-09");
    expect(septView.totalCents).toBe(0);
    const [octView] = await teacherPayService.listPayouts("2026-10");
    expect(octView.lines.find((l) => l.label.startsWith("Pagos com atraso de 09/2026"))?.amountCents).toBe(7500);

    // Fechado outubro, ela nao conta de novo em novembro.
    at("2026-11-02");
    await teacherPayService.closePayout(teacher.id, "2026-10");
    const [novView] = await teacherPayService.listPayouts("2026-11");
    expect(novView.lines.some((l) => l.label.startsWith("Pagos com atraso"))).toBe(false);

    // Desfazer avisa: ja entrou no fechamento de outubro.
    const view = (await billingService.listCharges({ studentId: s.id })).find((c) => c.id === sept.id);
    expect(view?.teacherPayClosedIn).toBe("2026-10");
  });
});

describe("rematrícula no curso", () => {
  async function courseClass(): Promise<ClassGroupView> {
    const teacher = await createInstructor("Chef");
    return classOf(teacher, {
      name: "Confeitaria",
      startDate: "2026-09-14",
      endDate: "2026-12-15",
      billingMode: "course",
      coursePriceCents: 80000,
      courseMaxInstallments: 4,
    });
  }
  const courseCharges = (studentId: string) =>
    store.charges
      .filter((c) => c.kind === "course" && c.studentId === studentId)
      .map((c) => `${c.dueDate} ${c.amountCents} ${c.status}`)
      .sort();

  it("pode cancelar as parcelas em aberto da matrícula anterior", async () => {
    const g = await courseClass();
    const s = await createStudent("Bia");
    const first = await turmasService.enroll({
      classGroupId: g.id,
      studentId: s.id,
      course: { priceCents: 80000, installments: 1, firstDueDate: "2026-09-15" },
    });
    await turmasService.cancelEnrollment(first.id);
    // A parcela vencida segue como divida depois de cancelar.
    expect(courseCharges(s.id)).toEqual(["2026-09-15 80000 pending"]);

    await turmasService.enroll({
      classGroupId: g.id,
      studentId: s.id,
      course: { priceCents: 80000, installments: 1, firstDueDate: "2026-09-22" },
      cancelOpenCourseCharges: true,
    });
    expect(courseCharges(s.id)).toEqual(["2026-09-15 80000 canceled", "2026-09-22 80000 pending"]);
    const old = store.charges.find((c) => c.kind === "course" && c.dueDate === "2026-09-15")!;
    expect(old).toMatchObject({ canceledBy: "user", cancelReason: "Rematrícula no curso" });
  });

  it("sem a escolha, a dívida anterior continua", async () => {
    const g = await courseClass();
    const s = await createStudent("Caio");
    const first = await turmasService.enroll({
      classGroupId: g.id,
      studentId: s.id,
      course: { priceCents: 80000, installments: 1, firstDueDate: "2026-09-15" },
    });
    await turmasService.cancelEnrollment(first.id);
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: s.id,
      course: { priceCents: 80000, installments: 1, firstDueDate: "2026-09-22" },
    });
    expect(courseCharges(s.id)).toEqual(["2026-09-15 80000 pending", "2026-09-22 80000 pending"]);
  });
});
