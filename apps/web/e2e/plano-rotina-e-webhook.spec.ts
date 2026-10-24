import { admin } from "./db";
import { currentAcademy, expect, seedAcademy, skipWelcome, test } from "./fixtures";

/**
 * Plano GestaraHub sem pessoa (doc technical/23, product/13 §6): a rotina
 * diaria (`POST /api/cron/daily`, com o CRON_SECRET) e o aviso do parceiro
 * (`POST /api/webhooks/asaas`). O servidor do e2e roda sem chave do Asaas nem do
 * e-mail, e o relogio dele e 22/09/2026: tudo acontece no banco local.
 */

const CRON_SECRET = process.env.CRON_SECRET?.trim();
const WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET?.trim();

const PRO = {
  tier: "pro",
  interval: "monthly",
  status: "active",
  paymentMethod: "pix",
  priceCents: 7990,
  asaasSubscriptionId: "sub_mock_e2e",
  renewsOn: "2026-10-12",
  nextDueDate: "2026-10-12",
  changedAt: "2026-08-12T12:00:00.000Z",
};

async function seedPlan(page: Parameters<typeof seedAcademy>[0], subscription: Record<string, unknown>) {
  await seedAcademy(page, {
    extra: (t) => {
      t.organization.subscription = subscription;
    },
  });
  await skipWelcome(page);
}

async function subscriptionInDb(): Promise<Record<string, unknown>> {
  const { data } = await admin()
    .from("organizations")
    .select("subscription")
    .eq("id", currentAcademy().organizationId)
    .single();
  return (data?.subscription ?? {}) as Record<string, unknown>;
}

async function historyKinds(): Promise<string[]> {
  const { data } = await admin()
    .from("subscription_events")
    .select("kind")
    .eq("organization_id", currentAcademy().organizationId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((row) => String(row.kind));
}

test.describe("rotina diária do plano", () => {
  test.skip(!CRON_SECRET, "CRON_SECRET ausente no .env.local");

  test("sem o segredo, a rotina recusa", async ({ request }) => {
    const response = await request.post("/api/cron/daily");
    expect(response.status()).toBe(401);
  });

  test("renovação vencida há 6 dias: volta ao Grátis, avisa na tela e não repete no segundo chamado", async ({
    page,
    request,
  }) => {
    // Hoje e 22/09: a renovacao de 16/09 passou dos 5 dias de tolerancia sem pagamento.
    await seedPlan(page, { ...PRO, renewsOn: "2026-09-16", nextDueDate: "2026-09-16" });

    const first = await request.post("/api/cron/daily", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    expect(first.status()).toBe(200);
    await expect.poll(async () => (await subscriptionInDb()).tier).toBe("free");
    expect(await historyKinds()).toContain("reverted_to_free");
    const afterFirst = (await historyKinds()).length;

    // Idempotente: o mesmo dia de novo nao volta nem registra de novo.
    const second = await request.post("/api/cron/daily", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    expect(second.status()).toBe(200);
    expect((await historyKinds()).length).toBe(afterFirst);

    // O dono ve o aviso no topo e o passo no histórico, marcado como automático.
    await page.goto("/dashboard");
    await expect(page.getByRole("status").filter({ hasText: "Seu plano voltou ao Grátis" })).toBeVisible();
    await page.goto("/settings?tab=plano");
    const panel = page.locator("#settings-panel-plano");
    await expect(panel.getByText("Histórico do plano")).toBeVisible();
    await expect(panel).toContainText("Voltou ao Grátis");
    await expect(panel).toContainText("Automático");

    // Na Auditoria, o passo sai como feito pelo sistema.
    await page.goto("/audit");
    await page.getByRole("combobox", { name: "Filtrar por responsável" }).click();
    await page.getByRole("option", { name: "Sistema (rotinas e pagamentos)", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Detalhes:.*Grátis/ }).first()).toBeVisible();
  });

  test("troca marcada para hoje é aplicada pela rotina", async ({ page, request }) => {
    await seedPlan(page, {
      ...PRO,
      renewsOn: "2026-09-22",
      nextDueDate: "2026-09-22",
      scheduledChange: { tier: "free", effectiveOn: "2026-09-22" },
    });
    const response = await request.post("/api/cron/daily", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    expect(response.status()).toBe(200);
    await expect.poll(async () => (await subscriptionInDb()).tier).toBe("free");
    expect(await historyKinds()).toContain("change_applied");
  });
});

test.describe("aviso do Asaas sobre a assinatura", () => {
  const headers: Record<string, string> = WEBHOOK_SECRET ? { "asaas-access-token": WEBHOOK_SECRET } : {};

  test("sem o token do parceiro, recusa", async ({ request }) => {
    test.skip(!WEBHOOK_SECRET, "ASAAS_WEBHOOK_SECRET ausente no .env.local");
    const response = await request.post("/api/webhooks/asaas", {
      data: { id: "evt_sem_token", event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_x" } },
    });
    expect(response.status()).toBe(401);
  });

  test("assinatura removida no parceiro: volta ao Grátis, e o mesmo aviso repetido é só reconhecido", async ({
    page,
    request,
  }) => {
    await seedPlan(page, { ...PRO, asaasSubscriptionId: "sub_mock_hook_e2e" });
    const eventId = `evt_e2e_${Date.now()}`;
    const payload = { id: eventId, event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_mock_hook_e2e" } };

    const first = await request.post("/api/webhooks/asaas", { headers, data: payload });
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ success: true, processed: true });
    await expect.poll(async () => (await subscriptionInDb()).tier).toBe("free");
    expect(await historyKinds()).toContain("removed_at_partner");

    // Mesmo id de evento: reconhecido sem tratar de novo.
    const again = await request.post("/api/webhooks/asaas", { headers, data: payload });
    expect(again.status()).toBe(200);
    expect(await again.json()).toMatchObject({ success: true, duplicate: true });
    expect((await historyKinds()).filter((kind) => kind === "removed_at_partner")).toHaveLength(1);

    const { data } = await admin().from("webhook_events").select("status, outcome").eq("event_id", eventId);
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ status: "processed" });
  });

  test("cobrança de aluno desconhecida é ignorada, sem erro", async ({ request }) => {
    const response = await request.post("/api/webhooks/asaas", {
      headers,
      data: {
        id: `evt_e2e_ignorado_${Date.now()}`,
        event: "PAYMENT_RECEIVED",
        payment: { id: "pay_que_nao_existe", status: "RECEIVED", value: 10, dueDate: "2026-09-22" },
      },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, processed: false });
  });
});
