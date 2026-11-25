import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, signInAs, type TestTenant } from "@/test/db";
import { createOnlinePixPaymentAction } from "../../onlinePayments/checkoutActions";

/**
 * Pix e link de cobranca (auditoria de 30/10/2026): como actions, o navegador
 * chama direto. So vale o que o servidor confere: permissao de cobrar, cobranca
 * do proprio espaco e em aberto, valor nunca abaixo do dela. Provedor de
 * demonstracao ("mock") para nao chamar o parceiro de verdade.
 */

const admin = adminClient();
let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

async function charge(over: Record<string, unknown> = {}, organizationId = tenant.organizationId): Promise<string> {
  const clientId = randomUUID();
  await admin.from("clients").insert({ id: clientId, organization_id: organizationId, name: "Aluno", phone: "11977770000" }).throwOnError();
  const id = randomUUID();
  await admin
    .from("charges")
    .insert({ id, organization_id: organizationId, student_id: clientId, kind: "extra", description: "Kimono", due_date: "2026-11-10", amount_cents: 15000, status: "pending", ...over })
    .throwOnError();
  return id;
}

const pix = (chargeId: string, amountCents = 15000) =>
  createOnlinePixPaymentAction({ chargeId, amountCents, expiresInMinutes: 60, studentName: "Aluno" }, "mock");

describe("Pix da cobrança conferido no servidor", () => {
  it("dono gera o Pix da cobrança em aberto do espaço dele", async () => {
    const result = await pix(await charge());
    expect(result).not.toHaveProperty("error");
  });

  it("conta ainda em análise no Asaas: o Pix nem chega ao parceiro e a mensagem diz o que falta", async () => {
    await admin
      .from("organizations")
      .update({
        gateway_api_key: "chave-da-subconta",
        settings: { onlinePayments: { enabled: true, asaasStatus: { general: "PENDING", checkedAt: new Date().toISOString() } } },
      })
      .eq("id", tenant.organizationId)
      .throwOnError();
    const result = await createOnlinePixPaymentAction(
      { chargeId: await charge(), amountCents: 15000, expiresInMinutes: 60, studentName: "Aluno" },
      "asaas",
    );
    expect(result).toEqual({
      error: "O Pix libera quando o Asaas aprovar a sua conta de recebimento. Veja o que falta em Recebimentos online.",
      reason: "pix_not_ready",
    });
  });

  it("valor abaixo do da cobrança é recusado", async () => {
    expect(await pix(await charge(), 100)).toEqual({ error: "O valor não pode ser menor que o da cobrança." });
  });

  it("cobrança paga ou cancelada é recusada", async () => {
    expect(await pix(await charge({ status: "paid", method: "cash", paid_at: new Date().toISOString() }))).toEqual({
      error: "Esta cobrança não está em aberto.",
    });
    expect(await pix(await charge({ status: "canceled" }))).toEqual({ error: "Esta cobrança não está em aberto." });
  });

  it("cobrança de outro espaço é recusada", async () => {
    const other = await createTestTenant();
    try {
      const foreign = await charge({}, other.organizationId);
      await signInAs(tenant.owner);
      expect(await pix(foreign)).toEqual({ error: "Cobrança de outro espaço." });
    } finally {
      await other.remove();
    }
  });

  it("professor não gera cobrança online", async () => {
    const id = await charge();
    await signInAs(await tenant.addUser("professional"));
    await expect(pix(id)).resolves.toMatchObject({ error: expect.any(String) });
  });
});
