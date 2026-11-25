import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createTestTenant, signOut, type TestTenant } from "@/test/db";
import { confirmMinorConsentAction } from "@/services/legalConsent/minorConsentActions";
import { createPublicChargePaymentAction } from "../chargeInvoiceActions";
import { reportBrowserErrorAction } from "../browserErrors";
import { setErrorSink } from "@/lib/log";
import { recordErrorToDb } from "@/lib/log/server-sink";

/**
 * Paginas publicas (auditoria de 30/10/2026): a autorizacao do menor nao
 * sobrescreve uma ja registrada, e a fatura publica tem limite de pedidos.
 */

// Um IP por execucao: o limite fica gravado no banco por uma hora.
const ip = vi.hoisted(() => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.7`);
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": ip, "user-agent": "teste" }),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const admin = adminClient();
let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

describe("autorização do menor pelo link", () => {
  it("autorização já registrada (termo impresso) não é sobrescrita pelo link", async () => {
    const id = randomUUID();
    await admin
      .from("clients")
      .insert({
        id,
        organization_id: tenant.organizationId,
        name: "Gabi",
        phone: "11977770000",
        birth_date: "2015-05-05",
        minor_consent_status: "confirmed_paper",
        minor_consent_by: "Mãe da Gabi",
      })
      .throwOnError();
    const result = await confirmMinorConsentAction({ studentId: id, guardianName: "Outra pessoa", guardianPhone: "11900000000", relationship: "Tia" });
    expect(result).toEqual({ success: false, error: "A autorização deste aluno já está registrada." });
    const { data } = await admin.from("clients").select("minor_consent_status, minor_consent_by").eq("id", id).single();
    expect(data).toEqual({ minor_consent_status: "confirmed_paper", minor_consent_by: "Mãe da Gabi" });
  });

  it("texto longo demais é recusado", async () => {
    const result = await confirmMinorConsentAction({ studentId: randomUUID(), guardianName: "x".repeat(200) });
    expect(result).toEqual({ success: false, error: "Confira os dados digitados." });
  });
});

describe("fatura pública", () => {
  it("no máximo 6 pedidos em 10 minutos para a mesma cobrança", async () => {
    const chargeId = randomUUID();
    for (let i = 0; i < 6; i++) {
      expect(await createPublicChargePaymentAction({ chargeId, method: "pix" })).toEqual({ ok: false, error: "Cobrança não encontrada." });
    }
    expect(await createPublicChargePaymentAction({ chargeId, method: "pix" })).toEqual({
      ok: false,
      error: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    });
  });
});

describe("erro do navegador sem login (25/11/2026)", () => {
  const event = `browser.teste.publico-${ip}`;
  const rows = async () => (await admin.from("error_logs").select("*").eq("event", event)).data ?? [];

  it("entra sem espaço, com a tela, e o mesmo IP tem limite de 10 a cada 10 minutos", async () => {
    signOut();
    setErrorSink(recordErrorToDb);
    try {
      await reportBrowserErrorAction({ event: `teste.publico-${ip}`, message: "Falha na inscrição", context: { path: "/p/e/ABC123" } });
      const [row] = await rows();
      expect(row).toMatchObject({ source: "browser", organization_id: null, count: 1 });
      expect(row.context).toMatchObject({ path: "/p/e/ABC123" });

      for (let i = 0; i < 12; i++) {
        await reportBrowserErrorAction({ event: `teste.publico-${ip}`, message: "Falha na inscrição" });
      }
      const [after] = await rows();
      expect(after.count).toBe(10);
    } finally {
      setErrorSink(undefined);
      await admin.from("error_logs").delete().eq("event", event);
    }
  });
});
