import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Subscription } from "@gestarahub/contracts";
import { adminClient, createTestTenant, signInAs, type TestTenant } from "@/test/db";

/**
 * Nota fiscal do Plano GestaraHub (doc technical/24 §7.1, 22/11/2026): uma
 * nota por pagamento confirmado, pedida uma vez mesmo com o polling e o
 * webhook juntos; aviso INVOICE_* reconsultado no Asaas; estorno cancela.
 */

const asaas = vi.hoisted(() => ({
  createInvoice: vi.fn(),
  getInvoice: vi.fn(),
  listPaymentInvoices: vi.fn(),
  cancelInvoice: vi.fn(),
  getSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  getSubscriptionPayments: vi.fn(),
  listSubscriptionPixAutomaticAuthorizations: vi.fn(),
}));
const email = vi.hoisted(() => ({ sendPlanNoticeEmail: vi.fn() }));

vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  ...asaas,
  getAsaasConfig: () => ({ apiUrl: "https://sandbox.asaas.com/api/v3", masterApiKey: "chave-de-teste" }),
}));
vi.mock("@/lib/email/ses", () => email);

const invoices = await import("@/services/server/subscriptionInvoices");
const plan = await import("@/services/server/subscriptionPlan");
const { asaasToday } = await import("@/lib/asaas");

const admin = adminClient();
let tenant: TestTenant;

const paidPlan: Subscription = {
  tier: "pro",
  interval: "monthly",
  status: "active",
  paymentMethod: "pix",
  priceCents: 7990,
  asaasSubscriptionId: "sub_teste",
  asaasCustomerId: "cus_teste",
  renewsOn: "2026-12-01",
};

function request(paymentId = "pay_1") {
  return {
    organizationId: tenant.organizationId,
    kind: "subscription" as const,
    payment: { id: paymentId, value: 79.9 },
    serviceDescription: invoices.subscriptionInvoiceDescription(paidPlan, "2026-11-22"),
  };
}

async function rows() {
  const { data } = await admin
    .from("platform_invoices")
    .select("*")
    .eq("organization_id", tenant.organizationId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("ASAAS_NFSE_SERVICE_CODE", "01.03.01");
  vi.stubEnv("ASAAS_NFSE_SERVICE_NAME", "Processamento e hospedagem de sistemas");
  vi.stubEnv("ASAAS_NFSE_ISS", "2,01");
  vi.stubEnv("ASAAS_NFSE_NOTIFY_EMAIL", "contas@gestarahub.test");
  asaas.listPaymentInvoices.mockResolvedValue([]);
  asaas.createInvoice.mockResolvedValue({ id: "inv_1", status: "SCHEDULED", value: 79.9, effectiveDate: asaasToday() });
  asaas.listSubscriptionPixAutomaticAuthorizations.mockResolvedValue([]);
  email.sendPlanNoticeEmail.mockResolvedValue({ ok: true });
  tenant = await createTestTenant();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await tenant.remove();
});

describe("nota fiscal do plano", () => {
  it("sem as variáveis da nota: não pede nada", async () => {
    vi.stubEnv("ASAAS_NFSE_ISS", "");
    await invoices.ensurePlanInvoice(admin, request());
    expect(asaas.createInvoice).not.toHaveBeenCalled();
    expect(await rows()).toHaveLength(0);
  });

  it("polling e webhook juntos: uma nota só, com período, ISS e demais zerados", async () => {
    await Promise.all([invoices.ensurePlanInvoice(admin, request()), invoices.ensurePlanInvoice(admin, request())]);

    expect(asaas.createInvoice).toHaveBeenCalledTimes(1);
    expect(asaas.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: "pay_1",
        value: 79.9,
        municipalServiceCode: "01.03.01",
        serviceDescription: "Assinatura do sistema GestaraHub, plano Profissional mensal, período 22/11/2026 a 21/12/2026.",
        taxes: expect.objectContaining({ retainIss: false, iss: 2.01, pis: 0, cofins: 0, csll: 0, inss: 0, ir: 0 }),
      }),
    );
    expect(await rows()).toMatchObject([{ asaas_invoice_id: "inv_1", status: "scheduled", amount_cents: 7990 }]);
  });

  it("nota já criada no Asaas (resposta perdida): reaproveita sem criar outra", async () => {
    asaas.listPaymentInvoices.mockResolvedValue([{ id: "inv_antiga", status: "AUTHORIZED", value: 79.9, number: "12" }]);
    await invoices.ensurePlanInvoice(admin, request());
    expect(asaas.createInvoice).not.toHaveBeenCalled();
    expect(await rows()).toMatchObject([{ asaas_invoice_id: "inv_antiga", status: "authorized", invoice_number: "12" }]);
  });

  it("Asaas recusa ao criar: fica a falha, e a rotina diária pede de novo", async () => {
    const { AsaasApiError } = await import("@/lib/asaas");
    asaas.createInvoice.mockRejectedValueOnce(new AsaasApiError("Endereço do cliente incompleto.", 400));
    await invoices.ensurePlanInvoice(admin, request());
    expect(await rows()).toMatchObject([{ status: "error", status_description: "Endereço do cliente incompleto.", attempts: 1 }]);

    // A rotina so pega pedidos parados ha 10 minutos.
    await admin.from("platform_invoices").update({ updated_at: "2026-01-01T00:00:00Z" }).eq("organization_id", tenant.organizationId);
    expect(await invoices.retryFailedPlanInvoices(admin)).toBeGreaterThanOrEqual(1);
    expect(await rows()).toMatchObject([{ asaas_invoice_id: "inv_1", status: "scheduled", status_description: null }]);
  });

  it("renovação paga: pede a nota do período pago", async () => {
    await admin.from("organizations").update({ subscription: paidPlan }).eq("id", tenant.organizationId);
    asaas.getSubscription.mockResolvedValue({ id: "sub_teste", customer: "cus_teste" });
    await plan.recordSubscriptionPaymentPaid(admin, { id: "pay_renova", dueDate: "2026-12-01", subscription: "sub_teste", value: 79.9 });
    expect(asaas.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: "pay_renova",
        serviceDescription: "Assinatura do sistema GestaraHub, plano Profissional mensal, período 01/12/2026 a 31/12/2026.",
      }),
    );
  });
});

describe("aviso INVOICE_* do Asaas", () => {
  it("emitida: grava número e PDF da consulta ao Asaas, registra na Auditoria e manda o e-mail uma vez", async () => {
    const owner = await tenant.addUser("owner");
    await invoices.ensurePlanInvoice(admin, request());
    asaas.getInvoice.mockResolvedValue({
      id: "inv_1",
      status: "AUTHORIZED",
      value: 79.9,
      payment: "pay_1",
      number: "345",
      pdfUrl: "https://asaas.test/nota.pdf",
      xmlUrl: "https://asaas.test/nota.xml",
    });

    // O corpo do aviso diz outra coisa: vale a consulta.
    expect(await invoices.syncPlanInvoiceFromWebhook(admin, { id: "inv_1", payment: "pay_1" })).toBe(tenant.organizationId);
    expect(asaas.getInvoice).toHaveBeenCalledWith("inv_1");
    expect(await rows()).toMatchObject([{ status: "authorized", invoice_number: "345", pdf_url: "https://asaas.test/nota.pdf" }]);
    const { data: audits } = await admin.from("audit_logs").select("summary").eq("organization_id", tenant.organizationId);
    expect(audits?.map((a) => a.summary).join("\n")).toContain("emitiu a nota fiscal nº 345");
    expect(email.sendPlanNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: owner.email,
        title: "Nota fiscal do plano emitida",
        actionUrl: "https://asaas.test/nota.pdf",
        text: expect.stringContaining("nº 345"),
      }),
    );

    // Aviso repetido do Asaas: nada de segundo e-mail.
    email.sendPlanNoticeEmail.mockClear();
    await invoices.syncPlanInvoiceFromWebhook(admin, { id: "inv_1", payment: "pay_1" });
    expect(email.sendPlanNoticeEmail).not.toHaveBeenCalled();
  });

  it("nota cancelada à mão: o segundo aviso do cartão não emite outra", async () => {
    await invoices.ensurePlanInvoice(admin, request());
    asaas.getInvoice.mockResolvedValue({ id: "inv_1", status: "CANCELED", value: 79.9, payment: "pay_1" });
    await invoices.syncPlanInvoiceFromWebhook(admin, { id: "inv_1", payment: "pay_1" });

    // "Recebido" do cartão semanas depois.
    await invoices.ensurePlanInvoice(admin, request());
    expect(asaas.createInvoice).toHaveBeenCalledTimes(1);
    expect(await rows()).toMatchObject([{ asaas_invoice_id: "inv_1", status: "canceled" }]);
  });

  it("só nota cancelada no Asaas para a cobrança: não emite outra", async () => {
    asaas.listPaymentInvoices.mockResolvedValue([{ id: "inv_manual", status: "CANCELED", value: 79.9, payment: "pay_1" }]);
    await invoices.ensurePlanInvoice(admin, request());
    expect(asaas.createInvoice).not.toHaveBeenCalled();
    expect(await rows()).toMatchObject([{ status: "canceled", asaas_invoice_id: null }]);
    await invoices.ensurePlanInvoice(admin, request());
    expect(asaas.createInvoice).not.toHaveBeenCalled();
    expect(await rows()).toHaveLength(1);
  });

  it("nota refeita à mão pela cobrança depois de cancelada: passa a ser a nota do pagamento", async () => {
    await invoices.ensurePlanInvoice(admin, request());
    asaas.getInvoice.mockResolvedValue({ id: "inv_1", status: "CANCELED", value: 79.9, payment: "pay_1" });
    await invoices.syncPlanInvoiceFromWebhook(admin, { id: "inv_1", payment: "pay_1" });

    asaas.getInvoice.mockResolvedValue({ id: "inv_2", status: "AUTHORIZED", value: 79.9, payment: "pay_1", number: "9", pdfUrl: "https://asaas.test/9.pdf" });
    expect(await invoices.syncPlanInvoiceFromWebhook(admin, { id: "inv_2", payment: "pay_1" })).toBe(tenant.organizationId);
    expect(await rows()).toMatchObject([
      { asaas_invoice_id: "inv_1", status: "canceled" },
      { asaas_invoice_id: "inv_2", status: "authorized", invoice_number: "9", pdf_url: "https://asaas.test/9.pdf" },
    ]);
    expect(email.sendPlanNoticeEmail).toHaveBeenCalledWith(expect.objectContaining({ title: "Nota fiscal do plano emitida" }));
  });

  it("rotina diária: confere no Asaas só a nota parada há mais de 6 horas", async () => {
    await invoices.ensurePlanInvoice(admin, request("pay_parada"));
    asaas.createInvoice.mockResolvedValueOnce({ id: "inv_nova", status: "SCHEDULED", value: 79.9, effectiveDate: asaasToday() });
    await invoices.ensurePlanInvoice(admin, request("pay_nova"));
    await admin
      .from("platform_invoices")
      .update({ updated_at: new Date(Date.now() - 7 * 60 * 60_000).toISOString() })
      .eq("asaas_payment_id", "pay_parada");
    asaas.getInvoice.mockResolvedValue({ id: "inv_1", status: "AUTHORIZED", value: 79.9, payment: "pay_parada", number: "50" });

    expect(await invoices.syncStalePlanInvoices(admin)).toBe(1);
    expect(asaas.getInvoice).toHaveBeenCalledTimes(1);
    expect(asaas.getInvoice).toHaveBeenCalledWith("inv_1");
    const byPayment = Object.fromEntries((await rows()).map((r) => [r.asaas_payment_id, r.status]));
    expect(byPayment).toEqual({ pay_parada: "authorized", pay_nova: "scheduled" });
  });

  it("nota que não é do plano (feita à mão no painel): ignora", async () => {
    asaas.getInvoice.mockResolvedValue({ id: "inv_manual", status: "AUTHORIZED", value: 10, payment: "pay_outro" });
    expect(await invoices.syncPlanInvoiceFromWebhook(admin, { id: "inv_manual" })).toBeNull();
  });
});

describe("estorno com nota", () => {
  it("cancela a nota; emitida em outro mês, avisa a equipe para a contabilidade", async () => {
    await invoices.ensurePlanInvoice(admin, request());
    await admin
      .from("platform_invoices")
      .update({ status: "authorized", effective_date: "2026-01-30", invoice_number: "77" })
      .eq("organization_id", tenant.organizationId);
    asaas.cancelInvoice.mockResolvedValue({ id: "inv_1", status: "PROCESSING_CANCELLATION", value: 79.9 });

    await invoices.cancelPlanInvoiceOfPayment(admin, tenant.organizationId, "pay_1");

    expect(asaas.cancelInvoice).toHaveBeenCalledWith("inv_1");
    expect(await rows()).toMatchObject([{ status: "processing_cancellation" }]);
    expect(email.sendPlanNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: "contas@gestarahub.test", title: "Nota fiscal de outro mês cancelada" }),
    );
  });

  it("estorno do plano pelo webhook cancela a nota do pagamento", async () => {
    await admin.from("organizations").update({ subscription: paidPlan }).eq("id", tenant.organizationId);
    await invoices.ensurePlanInvoice(admin, request());
    asaas.getSubscription.mockResolvedValue({ id: "sub_teste", customer: "cus_teste" });
    asaas.cancelSubscription.mockResolvedValue({});
    asaas.cancelInvoice.mockResolvedValue({ id: "inv_1", status: "CANCELED", value: 79.9 });

    await plan.recordPlanPaymentRefunded(admin, { id: "pay_1", subscription: "sub_teste" }, "refund");

    expect(asaas.cancelInvoice).toHaveBeenCalledWith("inv_1");
    expect(await rows()).toMatchObject([{ status: "canceled" }]);
  });
});

describe("lista de notas na tela", () => {
  it("só quem gerencia o plano vê, e só as do próprio espaço", async () => {
    await invoices.ensurePlanInvoice(admin, request());
    const { listPlatformInvoicesAction } = await import("../planChangeActions");

    await signInAs(tenant.owner);
    const own = await listPlatformInvoicesAction();
    expect(own).toMatchObject({ ok: true, data: [{ amountCents: 7990, status: "scheduled" }] });

    await signInAs(await tenant.addUser("professional"));
    expect((await listPlatformInvoicesAction()).ok).toBe(false);
  });
});
