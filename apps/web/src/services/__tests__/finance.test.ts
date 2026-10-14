import type { CreateFinancialEntry, FileAttachment, FinancialEntry } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { financeService } from "@/services/financeService";
import { onlinePaymentsService } from "@/services/onlinePaymentsService";
import { assertFeature, subscriptionService } from "@/services/subscriptionService";
import { teacherPayService } from "@/services/teacherPayService";
import { ACADEMY_ORG, createInstructor, createPlan, enrollStudent, resetAcademy } from "@/test/academy";

// Categorias padrao do seed da academia (ids deterministicos).
const cat = (key: string) => `fcat-${ACADEMY_ORG}-${key}`;
const RENT = cat("rent");
const PRODUCTS = cat("products");
const MEMBERSHIPS = cat("memberships");

function entryPayload(overrides: Partial<CreateFinancialEntry> = {}): CreateFinancialEntry {
  return {
    type: "expense",
    categoryId: RENT,
    description: "Aluguel",
    amountCents: 200000,
    dueDate: "2026-09-25",
    ...overrides,
  };
}

/** Lancamentos de uma recorrencia por competencia: "2026-09 pending 200000". */
function seriesOf(recurrenceId: string | undefined): string[] {
  return store.financialEntries
    .filter((e: FinancialEntry) => e.recurrenceId === recurrenceId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((e) => `${e.dueDate} ${e.status} ${e.amountCents}`);
}

function attachment(name: string): FileAttachment {
  return {
    id: `att-${name}`,
    name,
    contentType: "application/pdf",
    sizeBytes: 1000,
    uploadedAt: "2026-09-22T15:00:00.000Z",
  };
}

const lastAudit = () => store.auditLog.at(-1)?.summary ?? "";

describe("plano GestaraHub (assinatura)", () => {
  beforeEach(() => resetAcademy());

  it("trocar o plano entra na auditoria como evento de segurança", async () => {
    const before = store.auditLog.length;
    const sub = await subscriptionService.setTier("pro");
    expect(sub.tier).toBe("pro");
    expect(sub.changedAt).toBeTruthy();
    expect(store.auditLog.length).toBe(before + 1);
    expect(store.auditLog.at(-1)).toMatchObject({
      summary: "Ana Ribeiro trocou o Plano GestaraHub de Grátis para Pro",
      security: true,
    });
  });

  it("mesmo plano não muda nada nem audita", async () => {
    const first = await subscriptionService.setTier("pro");
    const count = store.auditLog.length;
    vi.setSystemTime(new Date("2026-09-23T12:00:00"));
    const again = await subscriptionService.setTier("pro");
    expect(again.changedAt).toBe(first.changedAt);
    expect(store.auditLog.length).toBe(count);
  });

  it("recusa plano inválido", async () => {
    await expect(subscriptionService.setTier("gold" as never)).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "tier", message: "Plano inválido." }],
    });
  });

  it("recurso pago fora do plano Grátis: FEATURE_NOT_IN_PLAN (403)", async () => {
    await subscriptionService.setTier("free");
    expect(() => assertFeature("online_payments")).toThrow(
      expect.objectContaining({ code: "FEATURE_NOT_IN_PLAN", httpStatus: 403 }),
    );
    await subscriptionService.setTier("pro");
    expect(() => assertFeature("online_payments")).not.toThrow();
  });

  it("financeiro básico funciona no plano Grátis (freemium)", async () => {
    // Desde o modelo freemium (doc 13) lançamentos e professores são grátis.
    await subscriptionService.setTier("free");
    const e = await financeService.createEntry(entryPayload());
    expect(e.status).toBe("pending");
    const teacher = await createInstructor("Carlos");
    await teacherPayService.saveRule(teacher.id, {
      components: [{ kind: "fixed_monthly", amountCents: 100000 }],
      startCompetence: "2026-08",
    });
    const view = await teacherPayService.closePayout(teacher.id, "2026-08");
    expect(view.status).toBe("closed");
  });
});

describe("repetição mensal", () => {
  beforeEach(() => resetAcademy());

  it("materializa o mês atual e o seguinte, sem duplicar em leituras repetidas", async () => {
    const e = await financeService.createEntry(entryPayload({ dueDate: "2026-09-05", repeatMonthly: true }));
    for (let i = 0; i < 3; i++) {
      await financeService.listEntries({ competence: "2026-09" });
      await financeService.getSummary("2026-10");
    }
    expect(seriesOf(e.recurrenceId)).toEqual(["2026-09-05 pending 200000", "2026-10-05 pending 200000"]);
    expect(store.financialRecurrences).toHaveLength(1);
    expect(store.financialRecurrences[0]).toMatchObject({ dayOfMonth: 5, startCompetence: "2026-09" });
  });

  it("começando no passado, cria os meses que faltam até o seguinte ao atual", async () => {
    const e = await financeService.createEntry(entryPayload({ dueDate: "2026-08-05", repeatMonthly: true }));
    expect(seriesOf(e.recurrenceId)).toEqual([
      "2026-08-05 pending 200000",
      "2026-09-05 pending 200000",
      "2026-10-05 pending 200000",
    ]);
  });

  it("quando o mês vira, gera o próximo uma única vez", async () => {
    const e = await financeService.createEntry(entryPayload({ dueDate: "2026-09-05", repeatMonthly: true }));
    vi.setSystemTime(new Date("2026-10-15T12:00:00"));
    await financeService.listEntries();
    await financeService.listEntries();
    expect(seriesOf(e.recurrenceId).map((s) => s.slice(0, 10))).toEqual([
      "2026-09-05",
      "2026-10-05",
      "2026-11-05",
    ]);
  });

  it("vencimento depois do dia 28 não pode repetir", async () => {
    await expect(
      financeService.createEntry(entryPayload({ dueDate: "2026-09-29", repeatMonthly: true })),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "dueDate", message: "Para repetir todo mês, escolha um vencimento entre os dias 1 e 28." }],
    });
    expect(store.financialRecurrences).toHaveLength(0);
    // Sem repetir, o dia 29 é aceito.
    await expect(financeService.createEntry(entryPayload({ dueDate: "2026-09-29" }))).resolves.toBeTruthy();
  });

  it("editar 'este e os próximos' muda a repetição e só os pendentes seguintes", async () => {
    const aug = await financeService.createEntry(entryPayload({ dueDate: "2026-08-05", repeatMonthly: true }));
    const series = () =>
      store.financialEntries
        .filter((x) => x.recurrenceId === aug.recurrenceId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const [, sep, oct] = series();
    await financeService.markEntryPaid(oct.id, "pix");

    await financeService.updateEntry(sep.id, { amountCents: 250000, dueDate: "2026-09-07" }, "following");

    expect(seriesOf(aug.recurrenceId)).toEqual([
      "2026-08-05 pending 200000", // anterior: intocado
      "2026-09-07 pending 250000", // o editado
      "2026-10-05 paid 200000", // seguinte, mas pago: intocado
    ]);
    expect(store.financialRecurrences[0]).toMatchObject({ amountCents: 250000, dayOfMonth: 7 });

    // O mês novo nasce com os valores atualizados.
    vi.setSystemTime(new Date("2026-10-15T12:00:00"));
    await financeService.listEntries();
    expect(seriesOf(aug.recurrenceId).at(-1)).toBe("2026-11-07 pending 250000");
  });

  it("editar 'este e os próximos' atualiza os pendentes seguintes e audita", async () => {
    const sep = await financeService.createEntry(entryPayload({ dueDate: "2026-09-05", repeatMonthly: true }));
    await financeService.updateEntry(sep.id, { description: "Aluguel da sala" }, "following");
    expect(store.financialEntries.filter((x) => x.recurrenceId === sep.recurrenceId).map((x) => x.description)).toEqual([
      "Aluguel da sala",
      "Aluguel da sala",
    ]);
    expect(lastAudit()).toBe("Ana Ribeiro editou a saída Aluguel da sala e 1 lançamento seguinte da repetição");
  });

  it("editar só este não mexe na repetição nem nos outros", async () => {
    const sep = await financeService.createEntry(entryPayload({ dueDate: "2026-09-05", repeatMonthly: true }));
    await financeService.updateEntry(sep.id, { amountCents: 1000 });
    expect(seriesOf(sep.recurrenceId)).toEqual(["2026-09-05 pending 1000", "2026-10-05 pending 200000"]);
    expect(store.financialRecurrences[0].amountCents).toBe(200000);
  });

  it("'este e os próximos' com dia > 28 é recusado", async () => {
    const sep = await financeService.createEntry(entryPayload({ dueDate: "2026-09-05", repeatMonthly: true }));
    await expect(
      financeService.updateEntry(sep.id, { dueDate: "2026-09-30" }, "following"),
    ).rejects.toMatchObject({ fields: [{ field: "dueDate" }] });
  });

  it("encerrar a repetição cancela os pendentes de hoje em diante e para de gerar", async () => {
    const e = await financeService.createEntry(entryPayload({ dueDate: "2026-08-25", repeatMonthly: true }));
    const result = await financeService.endRecurrence(e.recurrenceId!);
    expect(result).toEqual({ canceled: 2 });
    expect(seriesOf(e.recurrenceId)).toEqual([
      "2026-08-25 pending 200000", // vencido antes de hoje: fica em aberto
      "2026-09-25 canceled 200000",
      "2026-10-25 canceled 200000",
    ]);
    expect(store.financialRecurrences[0]).toMatchObject({ status: "inactive", endCompetence: "2026-09" });
    expect(lastAudit()).toBe(
      "Ana Ribeiro encerrou a repetição mensal da saída Aluguel e cancelou 2 lançamentos pendentes",
    );

    vi.setSystemTime(new Date("2026-11-15T12:00:00"));
    await financeService.listEntries();
    expect(seriesOf(e.recurrenceId)).toHaveLength(3);
    await expect(financeService.endRecurrence(e.recurrenceId!)).rejects.toMatchObject({ httpStatus: 409 });
  });
});

describe("resumo do mês", () => {
  beforeEach(() => resetAcademy());

  it("resultado = cobranças pagas + entradas pagas − despesas pagas − professores pagos", async () => {
    const plan = await createPlan("monthly", 15000);
    await enrollStudent({ plan, startDate: "2026-09-01", strategy: "full_cycle" });
    const charge = store.charges[0];
    await billingService.markPaid(charge.id, "pix");

    await financeService.createEntry(
      entryPayload({ type: "income", categoryId: PRODUCTS, description: "Kimonos", amountCents: 5000, paidNow: { method: "cash" } }),
    );
    await financeService.createEntry(entryPayload({ amountCents: 3000, description: "Luz", paidNow: { method: "pix" } }));

    const teacher = await createInstructor("Carlos");
    await teacherPayService.saveRule(teacher.id, {
      components: [{ kind: "fixed_monthly", amountCents: 100000 }],
      startCompetence: "2026-08",
    });
    const closed = await teacherPayService.closePayout(teacher.id, "2026-08");
    await teacherPayService.markPayoutPaid(closed.payout!.id, "pix");

    // Em aberto na competência: um vencido (atrasado) e um a vencer.
    await financeService.createEntry(entryPayload({ amountCents: 2000, description: "Internet", dueDate: "2026-09-10" }));
    await financeService.createEntry(entryPayload({ amountCents: 1000, description: "Água", dueDate: "2026-09-30" }));
    // Atrasado de outro mês não entra no atrasado de setembro.
    await financeService.createEntry(entryPayload({ amountCents: 700, description: "Gás", dueDate: "2026-08-10" }));
    // Cancelado sai dos totais.
    const canceled = await financeService.createEntry(entryPayload({ amountCents: 9999, description: "Cancelado" }));
    await financeService.cancelEntry(canceled.id);

    const summary = await financeService.getSummary("2026-09");
    expect(summary).toMatchObject({
      competence: "2026-09",
      incomePaidCents: 15000 + 5000,
      expensePaidCents: 3000 + 100000,
      resultCents: 20000 - 103000,
      incomeForecastCents: 0,
      expenseForecastCents: 2000 + 1000,
      incomeOverdueCents: 0,
      expenseOverdueCents: 2000,
    });
  });

  it("prévia aberta do professor entra no 'A pagar' e nos próximos vencimentos", async () => {
    const teacher = await createInstructor("Carlos");
    await teacherPayService.saveRule(teacher.id, {
      components: [{ kind: "fixed_monthly", amountCents: 100000 }],
      startCompetence: "2026-08",
    });
    // Agosto aberto vence 05/09 (já atrasado); setembro vence 05/10.
    const sep = await financeService.getSummary("2026-09");
    expect(sep).toMatchObject({ expenseForecastCents: 100000, expenseOverdueCents: 100000 });
    const oct = await financeService.getSummary("2026-10");
    expect(oct.expenseForecastCents).toBe(100000);

    const upcoming = await financeService.getUpcoming(7);
    expect(upcoming).toEqual([
      {
        id: `preview:${teacher.id}:2026-08`,
        source: "teacher_payout",
        description: "Pagamento de Carlos (agosto, prévia)",
        amountCents: 100000,
        dueDate: "2026-09-05",
        overdue: true,
      },
    ]);

    // Fechado vem do registro (não duplica com a prévia).
    await teacherPayService.closePayout(teacher.id, "2026-08");
    const after = await financeService.getUpcoming(7);
    expect(after.map((u) => u.description)).toEqual(["Pagamento de Carlos (agosto)"]);
  });

  it("Pix Automático é processado antes de ler o Resumo", async () => {
    await subscriptionService.setTier("pro");
    await onlinePaymentsService.updateSettings({ enabled: true });
    const plan = await createPlan("monthly", 15000);
    const s = await enrollStudent({ plan, startDate: "2026-09-25", strategy: "full_cycle" });
    const auth = await onlinePaymentsService.requestRecurring(s.id, 20000);
    await onlinePaymentsService.simulateAuthorize(auth.id);
    const charge = store.charges.find((c) => c.studentId === s.id)!;
    expect(charge.status).toBe("pending"); // ainda não venceu

    vi.setSystemTime(new Date("2026-09-26T12:00:00"));
    const summary = await financeService.getSummary("2026-09");
    expect(store.charges.find((c) => c.id === charge.id)).toMatchObject({ status: "paid", paidVia: "recurring" });
    expect(summary.incomePaidCents).toBe(15000);
  });
});

describe("lista de lançamentos", () => {
  beforeEach(() => resetAcademy());

  async function seedMonth() {
    const plan = await createPlan("monthly", 15000);
    await enrollStudent({ plan, name: "Paga", startDate: "2026-09-01", strategy: "full_cycle" });
    await enrollStudent({ plan, name: "Atrasada", startDate: "2026-09-02", strategy: "full_cycle" });
    await enrollStudent({ plan, name: "A vencer", startDate: "2026-09-28", strategy: "full_cycle" });
    await billingService.markPaid(store.charges.find((c) => c.dueDate === "2026-09-01")!.id, "pix");
    await financeService.createEntry(entryPayload({ description: "Internet", amountCents: 2000, dueDate: "2026-09-10" }));
    await financeService.createEntry(
      entryPayload({ type: "income", categoryId: PRODUCTS, description: "Kimonos", amountCents: 5000, paidNow: { method: "cash" } }),
    );
    await financeService.createEntry(entryPayload({ description: "Outro mês", dueDate: "2026-10-10" }));
  }

  it("agrega as cobranças do mês numa linha com contagens", async () => {
    await seedMonth();
    const rows = await financeService.listEntries({ competence: "2026-09" });
    expect(rows.map((r) => `${r.source} ${r.description} ${r.status}`)).toEqual([
      "charge Mensalidades de setembro overdue",
      "entry Internet overdue",
      "entry Kimonos paid",
    ]);
    expect(rows[0]).toMatchObject({
      amountCents: 45000,
      categoryId: MEMBERSHIPS,
      chargeCounts: { paid: 1, pending: 1, overdue: 1 },
      dueDate: "2026-09-02", // o vencimento em aberto mais antigo
    });
  });

  it("filtra por status (incluindo atrasado), tipo, categoria e busca", async () => {
    await seedMonth();
    const names = async (filter: Parameters<typeof financeService.listEntries>[0]) =>
      (await financeService.listEntries({ competence: "2026-09", ...filter })).map((r) => r.description);

    expect(await names({ status: "overdue" })).toEqual(["Mensalidades de setembro", "Internet"]);
    expect(await names({ status: "paid" })).toEqual(["Mensalidades de setembro", "Kimonos"]);
    expect(await names({ status: "pending" })).toEqual(["Mensalidades de setembro"]);
    expect(await names({ type: "expense" })).toEqual(["Internet"]);
    expect(await names({ categoryId: MEMBERSHIPS })).toEqual(["Mensalidades de setembro"]);
    expect(await names({ categoryId: PRODUCTS })).toEqual(["Kimonos"]);
    expect(await names({ search: "kimono" })).toEqual(["Kimonos"]);
    expect(await names({ search: "venda de produtos" })).toEqual(["Kimonos"]);
  });

  it("isento e cancelado não entram no agregado", async () => {
    const plan = await createPlan("monthly", 15000);
    await enrollStudent({ plan, name: "Cancelada", startDate: "2026-09-01", strategy: "full_cycle" });
    await enrollStudent({ plan, name: "Bolsista", startDate: "2026-09-02", strategy: "full_cycle" });
    await billingService.cancelCharge(store.charges[0].id);
    // Bolsa integral: mensalidade "Isento" (forçada no store para isolar a regra).
    store.charges[1].status = "waived";
    const rows = await financeService.listEntries({ competence: "2026-09" });
    expect(rows.filter((r) => r.source === "charge")).toEqual([]);
    expect((await financeService.getSummary("2026-09")).incomeForecastCents).toBe(0);
  });
});

describe("lançamentos manuais", () => {
  beforeEach(() => resetAcademy());

  it("'já foi pago' grava pago agora com a forma e audita", async () => {
    const e = await financeService.createEntry(entryPayload({ paidNow: { method: "pix" } }));
    expect(e).toMatchObject({ status: "paid", method: "pix", paidAt: new Date().toISOString() });
    expect(store.auditLog.at(-1)?.changes).toEqual([{ field: "status", label: "Status", before: "", after: "Pago" }]);
    expect(lastAudit()).toContain("Ana Ribeiro lançou a saída Aluguel");
  });

  it("valida descrição, valor, data e forma de pagamento", async () => {
    await expect(
      financeService.createEntry(
        entryPayload({ description: " ", amountCents: 0, dueDate: "2026-02-30", paidNow: { method: "bitcoin" as never } }),
      ),
    ).rejects.toMatchObject({
      fields: [
        { field: "description", message: "Informe a descrição." },
        { field: "amountCents", message: "Informe um valor maior que zero." },
        { field: "dueDate", message: "Informe uma data de vencimento válida." },
        { field: "method", message: "Selecione a forma de pagamento." },
      ],
    });
  });

  it("recusa categoria de sistema e categoria do outro tipo", async () => {
    await expect(
      financeService.createEntry(entryPayload({ type: "income", categoryId: MEMBERSHIPS })),
    ).rejects.toMatchObject({
      fields: [{ field: "categoryId", message: "Esta categoria é automática e não pode ser usada num lançamento manual." }],
    });
    await expect(
      financeService.createEntry(entryPayload({ type: "income", categoryId: RENT })),
    ).rejects.toMatchObject({ fields: [{ field: "categoryId", message: "Escolha uma categoria de entrada." }] });
    await expect(financeService.createEntry(entryPayload({ categoryId: cat("teachers") }))).rejects.toMatchObject({
      fields: [{ field: "categoryId" }],
    });
  });

  it("recusa categoria inativa", async () => {
    await financeService.updateCategory(RENT, { status: "inactive" });
    await expect(financeService.createEntry(entryPayload())).rejects.toMatchObject({
      fields: [{ field: "categoryId", message: "Esta categoria está inativa." }],
    });
  });

  it("exclui lançamento nunca pago e audita", async () => {
    const e = await financeService.createEntry(entryPayload());
    await financeService.deleteEntry(e.id);
    expect(store.financialEntries.find((x) => x.id === e.id)).toBeUndefined();
    expect(lastAudit()).toContain("Ana Ribeiro excluiu a saída Aluguel");
  });

  it("não exclui lançamento pago", async () => {
    const e = await financeService.createEntry(entryPayload({ paidNow: { method: "pix" } }));
    await expect(financeService.deleteEntry(e.id)).rejects.toMatchObject({
      httpStatus: 409,
      message: "Lançamento que já foi pago não pode ser excluído. Cancele em vez disso.",
    });
  });

  it("não exclui lançamento que foi pago e depois desfeito", async () => {
    const e = await financeService.createEntry(entryPayload());
    await financeService.markEntryPaid(e.id, "pix");
    await financeService.markEntryPending(e.id);
    expect(store.financialEntries.find((x) => x.id === e.id)).toMatchObject({ status: "pending", paidAt: undefined });
    await expect(financeService.deleteEntry(e.id)).rejects.toMatchObject({ httpStatus: 409 });
    const [view] = await financeService.listEntries({ competence: "2026-09" });
    expect(view.everPaid).toBe(true);
  });

  it("não exclui lançamento de repetição", async () => {
    const e = await financeService.createEntry(entryPayload({ repeatMonthly: true }));
    await expect(financeService.deleteEntry(e.id)).rejects.toMatchObject({
      httpStatus: 409,
      message: "Lançamento de repetição não pode ser excluído. Cancele ou encerre a repetição.",
    });
  });

  it("cancelar pago pede para desfazer antes; cancelado não edita nem paga", async () => {
    const e = await financeService.createEntry(entryPayload({ paidNow: { method: "pix" } }));
    await expect(financeService.cancelEntry(e.id)).rejects.toMatchObject({
      httpStatus: 409,
      message: "Desfaça o pagamento antes de cancelar o lançamento.",
    });
    await financeService.markEntryPending(e.id);
    await financeService.cancelEntry(e.id);
    await expect(financeService.updateEntry(e.id, { amountCents: 1 })).rejects.toMatchObject({ httpStatus: 409 });
    await expect(financeService.markEntryPaid(e.id, "pix")).rejects.toMatchObject({ httpStatus: 409 });
    await expect(financeService.cancelEntry(e.id)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("pagar duas vezes é recusado; desfazer exige pago", async () => {
    const e = await financeService.createEntry(entryPayload());
    await expect(financeService.markEntryPending(e.id)).rejects.toMatchObject({ httpStatus: 409 });
    await financeService.markEntryPaid(e.id, "pix");
    await expect(financeService.markEntryPaid(e.id, "cash")).rejects.toMatchObject({
      message: "Este lançamento já está pago.",
    });
  });

  it("guarda os comprovantes e soma os do pagamento", async () => {
    const e = await financeService.createEntry(entryPayload({ attachments: [attachment("boleto.pdf")] }));
    expect(e.attachments?.map((a) => a.name)).toEqual(["boleto.pdf"]);
    await financeService.markEntryPaid(e.id, "pix", [attachment("recibo.pdf")]);
    expect(store.financialEntries.find((x) => x.id === e.id)?.attachments?.map((a) => a.name)).toEqual([
      "boleto.pdf",
      "recibo.pdf",
    ]);
    expect(lastAudit()).toContain("com 1 comprovante");
  });

  it("recusa mais de 10 anexos por lançamento", async () => {
    const many = Array.from({ length: 11 }, (_, i) => attachment(`f${i}.pdf`));
    await expect(financeService.createEntry(entryPayload({ attachments: many }))).rejects.toMatchObject({
      fields: [{ field: "receipts", message: "Anexe no máximo 10 arquivos por lançamento." }],
    });
    const e = await financeService.createEntry(entryPayload({ attachments: many.slice(0, 10) }));
    await expect(financeService.markEntryPaid(e.id, "pix", [attachment("extra.pdf")])).rejects.toMatchObject({
      fields: [{ field: "receipts" }],
    });
    expect(store.financialEntries.find((x) => x.id === e.id)?.status).toBe("pending");
  });

  it("remover todos os anexos na edição limpa o campo e audita", async () => {
    const e = await financeService.createEntry(entryPayload({ attachments: [attachment("boleto.pdf")] }));
    await financeService.updateEntry(e.id, { attachments: [] });
    expect(store.financialEntries.find((x) => x.id === e.id)?.attachments).toBeUndefined();
    expect(store.auditLog.at(-1)?.changes).toEqual([
      { field: "attachments", label: "Comprovantes", before: "boleto.pdf", after: "" },
    ]);
  });
});

describe("categorias financeiras", () => {
  beforeEach(() => resetAcademy());

  it("categoria de sistema não renomeia nem inativa", async () => {
    await expect(financeService.updateCategory(MEMBERSHIPS, { name: "Mensais" })).rejects.toMatchObject({
      httpStatus: 409,
      message: "Categoria do sistema não pode ser renomeada nem inativada.",
    });
    await expect(financeService.updateCategory(cat("teachers"), { status: "inactive" })).rejects.toMatchObject({
      httpStatus: 409,
    });
  });

  it("nome duplicado no mesmo tipo é recusado (sem acento e caixa)", async () => {
    await expect(financeService.createCategory({ type: "expense", name: " aluguel " })).rejects.toMatchObject({
      fields: [{ field: "name", message: "Já existe uma categoria com esse nome." }],
    });
    await expect(financeService.createCategory({ type: "income", name: "Aluguel" })).resolves.toMatchObject({
      type: "income",
      name: "Aluguel",
    });
    const mine = await financeService.createCategory({ type: "expense", name: "Limpeza" });
    await expect(financeService.updateCategory(mine.id, { name: "MARKETING" })).rejects.toMatchObject({
      fields: [{ field: "name" }],
    });
  });

  it("inativar e reativar entram na auditoria", async () => {
    await financeService.updateCategory(RENT, { status: "inactive" });
    expect(lastAudit()).toBe("Ana Ribeiro inativou a categoria financeira Aluguel");
    await financeService.updateCategory(RENT, { status: "active" });
    expect(lastAudit()).toBe("Ana Ribeiro reativou a categoria financeira Aluguel");
  });

  it("lista só as escolhíveis sem as de sistema", async () => {
    const list = await financeService.listCategories({ type: "income", includeSystem: false });
    expect(list.some((c) => c.system)).toBe(false);
    expect(list.map((c) => c.name)).toContain("Venda de produtos");
  });
});
