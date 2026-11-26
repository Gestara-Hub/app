import type { Charge, Client } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billing";
import { cancelOpenMembershipCharges } from "@/services/billing/membershipCharges";
import { clientsService } from "@/services/clients";
import { financeService } from "@/services/finance";
import { applyRecurringAutoPayments, onlinePaymentsService } from "@/services/onlinePayments";
import { subscriptionService } from "@/services/subscription/subscriptionService";
import { createPlan, enrollStudent, resetAcademy } from "@/test/academy";

const plain = (text: string) => text.replace(/ /g, " ");
const chargeById = (id: string): Charge => store.charges.find((c) => c.id === id)!;
const paymentById = (id: string) => store.onlinePayments.find((p) => p.id === id)!;

/** Academia Pro com cobrança online ligada. */
async function proAcademy(): Promise<void> {
  resetAcademy();
  await subscriptionService.setTier("pro");
  await onlinePaymentsService.updateSettings({ enabled: true });
}

/** Aluno com uma mensalidade de R$ 150 vencendo em 01/09 (em aberto). */
async function studentWithCharge(name = "Aluno"): Promise<{ student: Client; charge: Charge }> {
  const plan = await createPlan("monthly", 15000, `Plano ${name}`);
  const student = await enrollStudent({ plan, name, startDate: "2026-09-01", strategy: "full_cycle" });
  const charge = store.charges.find((c) => c.studentId === student.id)!;
  return { student, charge };
}

describe("cobrança online: gerar Pix ou link", () => {
  beforeEach(proAcademy);

  it("funciona no plano Grátis (doc 13: pagamento online liberado com taxa por transação)", async () => {
    const { charge } = await studentWithCharge();
    await subscriptionService.setTier("free");
    const payment = await onlinePaymentsService.createForCharge(charge.id, "pix");
    expect(payment.chargeId).toBe(charge.id);
    expect(store.onlinePayments).toHaveLength(1);
  });

  it("carrega última notificação de WhatsApp no getCheckout e na lista de cobranças", async () => {
    const { student, charge } = await studentWithCharge();
    const initialCheckout = await onlinePaymentsService.getCheckout(charge.id);
    expect(initialCheckout.lastMessage).toBeUndefined();

    const chargesBefore = await billingService.listCharges();
    const chgBefore = chargesBefore.find((c) => c.id === charge.id);
    expect(chgBefore?.lastMessageSentAt).toBeUndefined();

    store.messageLogs.push({
      id: "msg-1",
      organizationId: store.organization.id,
      recipientName: student.name,
      recipientPhone: student.phone ?? "5511999999999",
      trigger: "billing_due_date",
      category: "billing",
      content: "Olá! Sua mensalidade vence hoje.",
      status: "delivered",
      clientId: student.id,
      chargeId: charge.id,
      sentAt: "2026-09-01T12:00:00.000Z",
    });

    const checkout = await onlinePaymentsService.getCheckout(charge.id);
    expect(checkout.lastMessage).toMatchObject({
      trigger: "billing_due_date",
      status: "delivered",
      sentAt: "2026-09-01T12:00:00.000Z",
    });

    const chargesAfter = await billingService.listCharges();
    const chgAfter = chargesAfter.find((c) => c.id === charge.id);
    expect(chgAfter?.lastMessageSentAt).toBe("2026-09-01T12:00:00.000Z");
    expect(chgAfter?.lastMessageTrigger).toBe("billing_due_date");
    expect(chgAfter?.lastMessageStatus).toBe("delivered");
  });

  it("grava tarifa do Asaas, taxa GestaraHub e líquido (doc 19 §4, decisão A)", async () => {
    // proAcademy: taxa de 1% (R$ 0,69 a R$ 6,90, doc 13 de 26/11/2026). Cobrança de R$ 150,00: R$ 1,50.
    const { charge } = await studentWithCharge();
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix", false);
    expect(pix.amountCents).toBe(15000);
    expect(pix.gatewayFeeCents).toBe(199);
    expect(pix.splitAmountCents).toBe(150);
    expect(pix.netAmountCents).toBe(15000 - 199 - 150);
    expect(pix.feePassedToCustomer).toBe(false);
    // Sem Asaas no teste, o provedor gravado e o de demonstracao, nunca "asaas".
    expect(pix.gatewayProvider).toBe("mock");

    const passed = await onlinePaymentsService.createForCharge(charge.id, "pix", true);
    expect(passed.amountCents).toBe(15000 + 199 + 150);
    expect(passed.netAmountCents).toBe(15000);
    expect(passed.feePassedToCustomer).toBe(true);

    // Link = cartão: sem tabela da subconta, a reserva usa o crédito cheio (2,99% + R$ 0,49).
    const link = await onlinePaymentsService.createForCharge(charge.id, "link", false);
    expect(link.gatewayFeeCents).toBe(Math.floor(15000 * 0.0299) + 49);
    expect(link.netAmountCents).toBe(15000 - link.gatewayFeeCents! - 150);
  });

  it("usa as tarifas da subconta, com a promoção só até a data de fim", async () => {
    const { charge } = await studentWithCharge();
    const online = store.organization.settings!.onlinePayments!;
    online.gatewayFees = {
      pix: { percent: 0, fixedCents: 199, promo: { percent: 0, fixedCents: 99 }, promoUntil: "2027-01-20" },
      creditCard: { percent: 0.0299, fixedCents: 49, promo: { percent: 0.0199, fixedCents: 49 }, promoUntil: "2027-01-20" },
      debitCard: { percent: 0.0189, fixedCents: 35 },
      boleto: { percent: 0, fixedCents: 199 },
      syncedAt: "2026-09-22T12:00:00.000Z",
    };
    const promo = await onlinePaymentsService.createForCharge(charge.id, "pix", false);
    expect(promo.gatewayFeeCents).toBe(99);
    const card = await onlinePaymentsService.createForCharge(charge.id, "link", false);
    expect(card.gatewayFeeCents).toBe(Math.floor(15000 * 0.0199) + 49);

    // Depois do fim da promoção vale o valor cheio, sem buscar nada.
    vi.setSystemTime(new Date("2027-01-20T12:00:00"));
    const full = await onlinePaymentsService.createForCharge(charge.id, "pix", false);
    expect(full.gatewayFeeCents).toBe(199);
  });

  it("formas aceitas: boleto desligado por padrão; 'o aluno escolhe' só com as três", async () => {
    const { charge } = await studentWithCharge();
    await expect(onlinePaymentsService.createForCharge(charge.id, "boleto")).rejects.toMatchObject({
      httpStatus: 422,
      message: "Esta forma de pagamento está desligada em Recebimentos online.",
    });
    await expect(onlinePaymentsService.createForCharge(charge.id, "choice")).rejects.toMatchObject({
      httpStatus: 422,
    });

    await onlinePaymentsService.updateSettings({ acceptedMethods: { pix: true, card: true, boleto: true } });
    const boleto = await onlinePaymentsService.createForCharge(charge.id, "boleto", false);
    expect(boleto.method).toBe("boleto");
    expect(boleto.linkUrl).toBeTruthy();
    const choice = await onlinePaymentsService.createForCharge(charge.id, "choice", true);
    expect(choice.method).toBe("choice");
    // Com repasse, o espaço recebe ao menos o valor mesmo no meio mais caro (cartão de crédito).
    expect(choice.netAmountCents).toBeGreaterThanOrEqual(15000);

    await onlinePaymentsService.updateSettings({ acceptedMethods: { pix: true, card: false, boleto: true } });
    await expect(onlinePaymentsService.createForCharge(charge.id, "link")).rejects.toMatchObject({ httpStatus: 422 });
  });

  it("não deixa desligar todas as formas", async () => {
    await expect(
      onlinePaymentsService.updateSettings({ acceptedMethods: { pix: false, card: false, boleto: false } }),
    ).rejects.toMatchObject({
      fields: [{ field: "acceptedMethods", message: "Deixe ao menos uma forma de pagamento ligada." }],
    });
  });

  it("repasse padrão por forma, com o geral como reserva", async () => {
    const { charge } = await studentWithCharge();
    await onlinePaymentsService.updateSettings({
      acceptedMethods: { pix: true, card: true, boleto: true },
      passFeeToCustomer: true,
      passFeeBoleto: false,
    });
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix");
    expect(pix.feePassedToCustomer).toBe(true);
    const boleto = await onlinePaymentsService.createForCharge(charge.id, "boleto");
    expect(boleto.feePassedToCustomer).toBe(false);
  });

  it("recusa com a cobrança online desligada", async () => {
    const { charge } = await studentWithCharge();
    await onlinePaymentsService.updateSettings({ enabled: false });
    await expect(onlinePaymentsService.createForCharge(charge.id, "pix")).rejects.toMatchObject({
      httpStatus: 409,
      message: "A cobrança online está desligada. Ligue em Recebimentos online, na aba Configurações.",
    });
  });

  it("recusa cobrança paga, cancelada ou isenta", async () => {
    const paid = await studentWithCharge("Pago");
    const canceled = await studentWithCharge("Cancelado");
    const waived = await studentWithCharge("Isento");
    await billingService.markPaid(paid.charge.id, "cash");
    await billingService.cancelCharge(canceled.charge.id);
    // Bolsa integral: a cobrança vira "Isento" (forçado no store para isolar a regra).
    chargeById(waived.charge.id).status = "waived";
    for (const id of [paid.charge.id, canceled.charge.id, waived.charge.id]) {
      await expect(onlinePaymentsService.createForCharge(id, "pix")).rejects.toMatchObject({
        httpStatus: 409,
        message: "Só é possível cobrar online uma cobrança pendente ou atrasada.",
      });
    }
    expect(store.onlinePayments).toHaveLength(0);
  });

  it("Pix tem copia-e-cola inválido de propósito; gera auditoria", async () => {
    const { charge } = await studentWithCharge();
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix");
    expect(pix).toMatchObject({ status: "awaiting", method: "pix", amountCents: 15000, chargeId: charge.id });
    expect(pix.pixCopyPaste).toMatch(/6304DEMO$/);
    expect(pix.expiresAt).toBe(new Date(Date.now() + 1440 * 60_000).toISOString());
    expect(plain(store.auditLog.at(-1)!.summary)).toBe(
      "Ana Ribeiro gerou a cobrança online por Pix da mensalidade de Aluno (R$ 150,00)",
    );
  });

  it("gerar um novo código cancela o anterior em aberto", async () => {
    const { charge } = await studentWithCharge();
    const first = await onlinePaymentsService.createForCharge(charge.id, "pix");
    const second = await onlinePaymentsService.createForCharge(charge.id, "link");
    expect(paymentById(first.id).status).toBe("canceled");
    expect(paymentById(second.id)).toMatchObject({ status: "awaiting", method: "link" });
    expect(second.linkUrl).toMatch(/^https:\/\/pagar\.gestarahub\.demo\/c\//);
    await expect(onlinePaymentsService.simulatePaid(first.id)).rejects.toMatchObject({
      message: "Este pagamento online não está mais em aberto.",
    });
  });

  it("código vencido expira na leitura e não pode ser pago", async () => {
    const { charge } = await studentWithCharge();
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix");
    vi.setSystemTime(new Date("2026-09-23T12:01:00"));
    const [listed] = await onlinePaymentsService.listForCharge(charge.id);
    expect(listed.status).toBe("expired");
    await expect(onlinePaymentsService.simulatePaid(pix.id)).rejects.toMatchObject({
      httpStatus: 409,
      message: "Este código expirou. Gere um novo para cobrar.",
    });
    expect(chargeById(charge.id).status).not.toBe("paid");
  });

  it("validade da configuração é usada no código", async () => {
    await onlinePaymentsService.updateSettings({ defaultExpiresInMinutes: 30 });
    const { charge } = await studentWithCharge();
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix");
    expect(pix.expiresAt).toBe(new Date(Date.now() + 30 * 60_000).toISOString());
  });
});

describe("cobrança online: pagamento", () => {
  beforeEach(proAcademy);

  it("pago por Pix: cobrança paga via online com forma Pix e entra no Resumo", async () => {
    const { charge } = await studentWithCharge();
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix");
    const paid = await onlinePaymentsService.simulatePaid(pix.id);
    expect(paid.status).toBe("paid");
    expect(chargeById(charge.id)).toMatchObject({ status: "paid", method: "pix", paidVia: "online" });
    expect((await financeService.getSummary("2026-09")).incomePaidCents).toBe(15000);
  });

  it("taxas que ficaram com o espaço saem no Financeiro; repassadas ao aluno, não (01/11/2026)", async () => {
    const { charge } = await studentWithCharge();
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix", false);
    const paid = await onlinePaymentsService.simulatePaid(pix.id);
    const competence = paid.paidAt!.slice(0, 7);
    const feeCents = 15000 - paid.netAmountCents!;
    expect(feeCents).toBeGreaterThan(0);
    // A cobranca entra cheia; tarifa do parceiro + taxa GestaraHub saem.
    const summary = await financeService.getSummary(competence);
    expect(summary.incomePaidCents).toBe(15000);
    expect(summary.expensePaidCents).toBe(feeCents);
    expect(summary.onlineFeesPaidCents).toBe(feeCents);
    const row = (await financeService.listEntries({ competence })).find((r) => r.source === "online_fee");
    expect(row).toMatchObject({
      type: "expense",
      status: "paid",
      amountCents: feeCents,
      onlinePaymentCount: 1,
      categoryName: "Taxas de pagamento online",
    });
    // Taxa repassada: o aluno pagou a mais e o espaco recebeu o valor cheio.
    const other = await studentWithCharge("Outro");
    const passed = await onlinePaymentsService.createForCharge(other.charge.id, "pix", true);
    await onlinePaymentsService.simulatePaid(passed.id);
    expect((await financeService.getSummary(competence)).expensePaidCents).toBe(feeCents);
  });

  it("pago por link: forma cartão, via online", async () => {
    const { charge } = await studentWithCharge();
    const link = await onlinePaymentsService.createForCharge(charge.id, "link");
    await onlinePaymentsService.simulatePaid(link.id);
    expect(chargeById(charge.id)).toMatchObject({ status: "paid", method: "card", paidVia: "online" });
  });

  it("pago online não se desfaz nem se cancela (seria estorno)", async () => {
    const { charge } = await studentWithCharge();
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix");
    await onlinePaymentsService.simulatePaid(pix.id);
    await expect(billingService.markPending(charge.id)).rejects.toMatchObject({ httpStatus: 409 });
    await expect(billingService.cancelCharge(charge.id)).rejects.toMatchObject({ httpStatus: 409 });
    expect(chargeById(charge.id)).toMatchObject({ status: "paid", paidVia: "online" });
  });

  it("cobrança já paga não aceita novo pagamento (não apaga o recebimento online)", async () => {
    const { charge } = await studentWithCharge();
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix");
    await onlinePaymentsService.simulatePaid(pix.id);
    const before = chargeById(charge.id);
    await expect(billingService.markPaid(charge.id, "cash")).rejects.toMatchObject({
      httpStatus: 409,
      message: "Esta cobrança já está paga.",
    });
    expect(chargeById(charge.id)).toEqual(before);
    await expect(billingService.markPending(charge.id)).rejects.toMatchObject({ httpStatus: 409 });

    const manual = (await studentWithCharge("Bia")).charge;
    await billingService.markPaid(manual.id, "cash");
    await expect(billingService.markPaid(manual.id, "pix")).rejects.toMatchObject({ httpStatus: 409 });
    expect(chargeById(manual.id).method).toBe("cash");
  });

  it("pago manual pode ser desfeito e cancelado", async () => {
    const { charge } = await studentWithCharge();
    await billingService.markPaid(charge.id, "cash");
    await billingService.markPending(charge.id);
    expect(chargeById(charge.id).paidVia).toBeUndefined();
    await billingService.markPaid(charge.id, "cash");
    await billingService.cancelCharge(charge.id);
    expect(chargeById(charge.id).status).toBe("canceled");
  });

  it("pagar manual cancela o código em aberto e grava via manual", async () => {
    const { charge } = await studentWithCharge();
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix");
    await billingService.markPaid(charge.id, "cash");
    expect(chargeById(charge.id)).toMatchObject({ status: "paid", method: "cash", paidVia: "manual" });
    expect(paymentById(pix.id).status).toBe("canceled");
    await expect(onlinePaymentsService.simulatePaid(pix.id)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("cancelar a cobrança cancela o código em aberto", async () => {
    const { charge } = await studentWithCharge();
    const link = await onlinePaymentsService.createForCharge(charge.id, "link");
    await billingService.cancelCharge(charge.id);
    expect(paymentById(link.id).status).toBe("canceled");
  });

  // 30/10/2026: o sistema cancelava a mensalidade (troca de plano, desconto,
  // inativacao) e o Pix ja enviado seguia pagavel; pago, ressuscitava a cancelada.
  it("cancelamento pelo sistema (troca de plano, desconto) cancela o código em aberto", async () => {
    const { student, charge } = await studentWithCharge();
    const pix = await onlinePaymentsService.createForCharge(charge.id, "pix");
    cancelOpenMembershipCharges(student.id, "2026-08-01", "Substituída na troca de plano", { inclusive: true, replaced: true });
    expect(chargeById(charge.id)).toMatchObject({ status: "canceled", canceledBy: "system" });
    expect(paymentById(pix.id)).toMatchObject({ status: "canceled", canceledReason: "Substituída na troca de plano" });
    await expect(onlinePaymentsService.simulatePaid(pix.id)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("inativar cancelando o que está em aberto cancela também o código", async () => {
    const { student, charge } = await studentWithCharge();
    const link = await onlinePaymentsService.createForCharge(charge.id, "link");
    await clientsService.remove(student.id, { cancelOpenCharges: true });
    expect(chargeById(charge.id).status).toBe("canceled");
    expect(paymentById(link.id).status).toBe("canceled");
  });
});

describe("configuração do pagamento online", () => {
  beforeEach(() => resetAcademy());

  it("não exige plano pago", async () => {
    await subscriptionService.setTier("free");
    const settings = await onlinePaymentsService.updateSettings({ enabled: true });
    expect(settings.enabled).toBe(true);
  });

  it("valida validade e chave; ligar entra na auditoria de segurança", async () => {
    await subscriptionService.setTier("pro");
    await expect(onlinePaymentsService.updateSettings({ defaultExpiresInMinutes: 4 })).rejects.toMatchObject({
      fields: [{ field: "defaultExpiresInMinutes", message: "Informe uma validade entre 5 minutos e 30 dias." }],
    });
    await expect(onlinePaymentsService.updateSettings({ pixKey: "x".repeat(78) })).rejects.toMatchObject({
      fields: [{ field: "pixKey" }],
    });
    await onlinePaymentsService.updateSettings({ enabled: true, pixKey: " chave@academia.com " });
    expect(store.auditLog.at(-1)).toMatchObject({
      summary: "Ana Ribeiro ligou a cobrança online",
      security: true,
      changes: [{ field: "enabled", before: "Desligada", after: "Ligada" }],
    });
    expect(await onlinePaymentsService.getSettings()).toEqual({
      enabled: true,
      pixKey: "chave@academia.com",
      defaultExpiresInMinutes: 1440,
    });
  });
});

describe("Pix Automático", () => {
  beforeEach(proAcademy);

  /**
   * Aluno com mensalidades de 01/08, 01/09 (vencidas) e 01/10 (futura).
   */
  async function studentWithThreeCharges(name: string, priceCents: number): Promise<Client> {
    const plan = await createPlan("monthly", priceCents, `Plano ${name}`);
    const student = await enrollStudent({ plan, name, startDate: "2026-08-01", strategy: "full_cycle" });
    await billingService.generateCharges("2026-09");
    await billingService.generateCharges("2026-10");
    return student;
  }

  const chargesOf = (studentId: string) =>
    store.charges
      .filter((c) => c.studentId === studentId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((c) => `${c.dueDate} ${c.status}${c.paidVia ? ` ${c.paidVia}` : ""}`);

  it("autorizar não quita o que venceu antes; debita o que vence depois, dentro do limite", async () => {
    const within = await studentWithThreeCharges("Dentro", 15000);
    const above = await studentWithThreeCharges("Acima", 30000);
    for (const s of [within, above]) {
      const auth = await onlinePaymentsService.requestRecurring(s.id, 20000);
      expect(auth.status).toBe("pending");
      await onlinePaymentsService.simulateAuthorize(auth.id);
    }
    // Agosto e setembro venceram antes da autorização: seguem em aberto.
    expect(chargesOf(within.id)).toEqual(["2026-08-01 pending", "2026-09-01 pending", "2026-10-01 pending"]);

    vi.setSystemTime(new Date("2026-10-01T12:00:00"));
    applyRecurringAutoPayments();
    expect(chargesOf(within.id)).toEqual(["2026-08-01 pending", "2026-09-01 pending", "2026-10-01 paid recurring"]);
    expect(store.charges.filter((c) => c.studentId === within.id && c.status === "paid").every((c) => c.method === "pix")).toBe(true);
    expect(chargesOf(above.id)).toEqual(["2026-08-01 pending", "2026-09-01 pending", "2026-10-01 pending"]);
    expect(store.auditLog.filter((l) => l.summary.includes("débito do Pix Automático"))).toHaveLength(1);
  });

  it("é idempotente: ler de novo não paga nem audita outra vez", async () => {
    const s = await studentWithThreeCharges("Aluno", 15000);
    const auth = await onlinePaymentsService.requestRecurring(s.id, 20000);
    await onlinePaymentsService.simulateAuthorize(auth.id);
    const audits = store.auditLog.length;
    expect(applyRecurringAutoPayments()).toBe(0);
    await financeService.getSummary("2026-09");
    await billingService.listCharges({ competence: "2026-09" });
    expect(store.auditLog.length).toBe(audits);
  });

  it("paga a próxima quando vence; pago pelo Pix Automático não se desfaz", async () => {
    const s = await studentWithThreeCharges("Aluno", 15000);
    const auth = await onlinePaymentsService.requestRecurring(s.id, 20000);
    await onlinePaymentsService.simulateAuthorize(auth.id);
    vi.setSystemTime(new Date("2026-10-01T12:00:00"));
    expect(applyRecurringAutoPayments()).toBe(1);
    expect(chargesOf(s.id).at(-1)).toBe("2026-10-01 paid recurring");
    const oct = store.charges.find((c) => c.studentId === s.id && c.dueDate === "2026-10-01")!;
    await expect(billingService.markPending(oct.id)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("revogar interrompe os débitos", async () => {
    const s = await studentWithThreeCharges("Aluno", 15000);
    const auth = await onlinePaymentsService.requestRecurring(s.id, 20000);
    await onlinePaymentsService.simulateAuthorize(auth.id);
    const revoked = await onlinePaymentsService.revokeRecurring(auth.id);
    expect(revoked.status).toBe("revoked");
    expect(store.auditLog.at(-1)?.summary).toBe("Ana Ribeiro revogou o Pix Automático de Aluno");
    vi.setSystemTime(new Date("2026-10-02T12:00:00"));
    expect(applyRecurringAutoPayments()).toBe(0);
    expect(chargesOf(s.id).at(-1)).toBe("2026-10-01 pending");
    await expect(onlinePaymentsService.revokeRecurring(auth.id)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("com a opção desligada não debita; no plano Grátis debita", async () => {
    const s = await studentWithThreeCharges("Aluno", 15000);
    const auth = await onlinePaymentsService.requestRecurring(s.id, 20000);
    await onlinePaymentsService.simulateAuthorize(auth.id);
    vi.setSystemTime(new Date("2026-10-01T12:00:00"));
    await onlinePaymentsService.updateSettings({ enabled: false });
    expect(applyRecurringAutoPayments()).toBe(0);
    expect(chargesOf(s.id).at(-1)).toBe("2026-10-01 pending");
    await onlinePaymentsService.updateSettings({ enabled: true });
    await subscriptionService.setTier("free");
    expect(applyRecurringAutoPayments()).toBe(1);
    expect(chargesOf(s.id).at(-1)).toBe("2026-10-01 paid recurring");
  });

  it("uma solicitação aberta por aluno; exige plano e limite válido", async () => {
    const s = await studentWithThreeCharges("Aluno", 15000);
    const auth = await onlinePaymentsService.requestRecurring(s.id, 20000);
    await expect(onlinePaymentsService.requestRecurring(s.id, 20000)).rejects.toMatchObject({
      message: "Já existe uma solicitação aguardando a autorização do aluno.",
    });
    await onlinePaymentsService.simulateAuthorize(auth.id);
    await expect(onlinePaymentsService.requestRecurring(s.id, 20000)).rejects.toMatchObject({
      message: "Este aluno já tem Pix Automático ativo.",
    });
    await expect(onlinePaymentsService.simulateAuthorize(auth.id)).rejects.toMatchObject({ httpStatus: 409 });

    const other = await studentWithThreeCharges("Outro", 15000);
    await expect(onlinePaymentsService.requestRecurring(other.id, 0)).rejects.toMatchObject({
      fields: [{ field: "maxAmountCents", message: "Informe um limite maior que zero." }],
    });
    const noPlan = store.clients.find((c) => c.id === other.id)!;
    noPlan.planId = undefined;
    await expect(onlinePaymentsService.requestRecurring(other.id, 20000)).rejects.toMatchObject({
      message: "O Pix Automático é para alunos com plano de mensalidade.",
    });
  });

  it("solicitação cancelada antes de autorizar libera um novo pedido", async () => {
    const s = await studentWithThreeCharges("Aluno", 15000);
    const auth = await onlinePaymentsService.requestRecurring(s.id, 20000);
    await onlinePaymentsService.revokeRecurring(auth.id);
    expect(store.auditLog.at(-1)?.summary).toBe("Ana Ribeiro cancelou a solicitação do Pix Automático de Aluno");
    await expect(onlinePaymentsService.requestRecurring(s.id, 20000)).resolves.toMatchObject({ status: "pending" });
  });

  it("Pix Automático cancela o código online em aberto da mensalidade que debita", async () => {
    const s = await studentWithThreeCharges("Aluno", 15000);
    const oct = store.charges.find((c) => c.studentId === s.id && c.dueDate === "2026-10-01")!;
    const pix = await onlinePaymentsService.createForCharge(oct.id, "pix");
    const auth = await onlinePaymentsService.requestRecurring(s.id, 20000);
    await onlinePaymentsService.simulateAuthorize(auth.id);
    expect(paymentById(pix.id).status).not.toBe("canceled");
    vi.setSystemTime(new Date("2026-10-01T12:00:00"));
    applyRecurringAutoPayments();
    expect(paymentById(pix.id).status).toBe("canceled");
  });
});
