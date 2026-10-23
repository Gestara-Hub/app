import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { loadPaymentPage } from "../paymentPage";

/** Pagina publica /p/<codigo> (migracao 35): o que mostra em cada estado. */

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

async function payment(over: { status?: string; expiresAt?: string; chargeStatus?: string; method?: string } = {}) {
  const admin = adminClient();
  const clientId = randomUUID();
  await admin
    .from("clients")
    .insert({ id: clientId, organization_id: tenant.organizationId, name: "Aluno Secreto", phone: "11977770000" })
    .throwOnError();
  const chargeId = randomUUID();
  await admin
    .from("charges")
    .insert({
      id: chargeId,
      organization_id: tenant.organizationId,
      student_id: clientId,
      kind: "membership",
      due_date: "2026-10-10",
      amount_cents: 15000,
      status: over.chargeStatus ?? "pending",
    })
    .throwOnError();
  const code = `T${randomUUID().replace(/-/g, "").slice(0, 11)}`;
  await admin
    .from("online_payments")
    .insert({
      organization_id: tenant.organizationId,
      charge_id: chargeId,
      method: over.method ?? "pix",
      amount_cents: 15000,
      status: over.status ?? "awaiting",
      gateway_provider: "mock",
      pix_copy_paste: "00020126PIXDEMO",
      link_url: "https://parceiro.example/fatura/1",
      expires_at: over.expiresAt ?? hoursFromNow(3),
      public_code: code,
    })
    .throwOnError();
  return code;
}

describe("página pública do pagamento online", () => {
  it("em aberto: mostra o Pix, sem dados do aluno, e marca a primeira abertura", async () => {
    const code = await payment();
    const view = await loadPaymentPage(code);
    expect(view).toMatchObject({ state: "open", label: "Mensalidade", amountCents: 15000, pixCopyPaste: "00020126PIXDEMO" });
    expect(JSON.stringify(view)).not.toContain("Aluno Secreto");
    const { data } = await adminClient().from("online_payments").select("opened_at").eq("public_code", code).single();
    expect(data?.opened_at).toBeTruthy();
  });

  it("validade passada ou cobrança cancelada: vencida", async () => {
    expect((await loadPaymentPage(await payment({ expiresAt: hoursFromNow(-1) })))?.state).toBe("expired");
    expect((await loadPaymentPage(await payment({ status: "canceled" })))?.state).toBe("expired");
    expect((await loadPaymentPage(await payment({ chargeStatus: "canceled" })))?.state).toBe("expired");
  });

  it("paga (no pagamento ou na cobrança): já está paga, mesmo vencida", async () => {
    expect((await loadPaymentPage(await payment({ status: "paid", expiresAt: hoursFromNow(-5) })))?.state).toBe("paid");
    expect((await loadPaymentPage(await payment({ chargeStatus: "paid" })))?.state).toBe("paid");
  });

  it("paga por este código: dados do pagamento, comprovante e nada do aluno", async () => {
    const code = await payment({ status: "paid", method: "link" });
    await adminClient()
      .from("online_payments")
      .update({
        paid_at: "2026-10-22T15:00:00.000Z",
        paid_method: "creditCard",
        receipt_url: "https://parceiro.example/comprovante/1",
      })
      .eq("public_code", code)
      .throwOnError();
    const view = await loadPaymentPage(code);
    expect(view?.state).toBe("paid");
    expect(view?.code).toBe(code);
    expect(view?.paid).toMatchObject({
      paidAt: "2026-10-22T15:00:00+00:00",
      methodLabel: "Cartão de crédito",
      receiptUrl: "https://parceiro.example/comprovante/1",
    });
    expect(JSON.stringify(view)).not.toContain("Aluno Secreto");
  });

  it("taxa repassada ao aluno: mostra o valor da cobrança e a taxa", async () => {
    const code = await payment({ status: "paid" });
    await adminClient()
      .from("online_payments")
      .update({ amount_cents: 15496, fee_passed_to_customer: true })
      .eq("public_code", code)
      .throwOnError();
    const view = await loadPaymentPage(code);
    expect(view?.amountCents).toBe(15496);
    expect(view?.paid?.breakdown).toEqual({ baseCents: 15000, feeCents: 496 });
  });

  it("sem repasse: sem divisão do valor", async () => {
    const view = await loadPaymentPage(await payment({ status: "paid" }));
    expect(view?.paid?.breakdown).toBeUndefined();
  });

  it("paga fora deste código: sem comprovante do parceiro", async () => {
    const view = await loadPaymentPage(await payment({ chargeStatus: "paid" }));
    expect(view?.paid?.receiptUrl).toBeUndefined();
    expect(view?.paid?.methodLabel).toBe("Pagamento online");
  });

  it("código desconhecido ou fora do formato: nada", async () => {
    expect(await loadPaymentPage("NaoExiste123")).toBeNull();
    expect(await loadPaymentPage("x';drop")).toBeNull();
  });
});
