import type { Page } from "@playwright/test";
import { admin } from "./db";
import { currentAcademy, expect, seedAcademy, skipWelcome, test } from "./fixtures";

/**
 * Plano GestaraHub (doc product/13 §6, technical/24): troca de plano com a
 * conta antes de cobrar, troca marcada e "Desmarcar", histórico do plano,
 * aviso fixo da renovação no topo e o aviso (toast) fora do rodapé das janelas.
 * Hoje e terca 22/09/2026. O servidor do e2e roda sem chave do Asaas: a
 * cobranca da diferenca e simulada ("Simular pagamento (testes)").
 */

const PRO = {
  tier: "pro",
  interval: "monthly",
  status: "active",
  paymentMethod: "pix",
  priceCents: 7990,
  asaasSubscriptionId: "sub_mock_e2e",
  renewsOn: "2026-10-12",
  nextDueDate: "2026-10-12",
  changedAt: "2026-09-12T12:00:00.000Z",
};

async function seedPlan(page: Page, subscription: Record<string, unknown> = PRO) {
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

// O Expansão saiu da venda em 24/10 (multiunidade ainda não existe): não há botão para
// ele na tela de Planos. A conta da diferença segue coberta nos testes de unidade; este
// fluxo volta quando o Expansão voltar (docs/pendencias.md).
test.fixme("upgrade: janela com a conta, Pix da diferença simulado e plano ligado", async ({ page }) => {
  await seedPlan(page);
  await page.goto("/plans");
  await page.getByRole("button", { name: "Mudar para o Expansão" }).click();

  const dialog = page.getByRole("dialog", { name: "Mudar para o Plano Expansão?" });
  await expect(dialog).toContainText("Confira os valores antes de confirmar.");
  // Diferença de R$ 119,10 por 20 dos 30 dias que sobram; a renovação não muda de data.
  await expect(dialog).toContainText("R$ 79,40");
  await expect(dialog).toContainText("20 dias de diferença");
  await expect(dialog).toContainText("A partir de 12/10/2026");
  await expect(dialog).toContainText("R$ 199,00/mês");

  await dialog.getByRole("button", { name: "Pagar R$ 79,40" }).click();
  // O titulo muda; a janela e a mesma.
  const pay = page.getByRole("dialog", { name: "Pague a diferença" });
  await expect(pay).toContainText("Libera assim que o pagamento cair.");
  await pay.getByRole("button", { name: "Simular pagamento (testes)" }).click();
  await expect(page.getByText("Plano Expansão ativado.")).toBeVisible();

  // O plano novo foi gravado pelo servidor, com a mesma data de renovação.
  await expect.poll(async () => (await subscriptionInDb()).tier).toBe("scale");
  expect((await subscriptionInDb()).renewsOn).toBe("2026-10-12");
});

test("voltar ao Grátis fica marcado para o fim do período e dá para desmarcar", async ({ page }) => {
  await seedPlan(page);
  await page.goto("/settings?tab=plano");
  const panel = page.locator("#settings-panel-plano");
  await expect(panel).toContainText("Renova em 12/10/2026.");

  await panel.getByRole("button", { name: "Voltar ao Grátis" }).click();
  const dialog = page.getByRole("dialog", { name: "Voltar ao Grátis?" });
  await expect(dialog).toContainText("Volta ao Grátis em");
  await expect(dialog).toContainText("12/10/2026");
  await dialog.getByRole("button", { name: "Voltar ao Grátis" }).click();
  await expect(page.getByText("Troca marcada para 12/10/2026.")).toBeVisible();
  // O aviso (toast) sai no topo, não em cima do rodapé das janelas.
  await expect(page.locator("[data-sonner-toaster]")).toHaveAttribute("data-y-position", "top");

  // Até lá nada muda: o plano segue Profissional, com a troca à vista e "Desmarcar".
  await expect(panel).toContainText("Muda para");
  await expect(panel).toContainText("12/10/2026");
  expect((await subscriptionInDb()).tier).toBe("pro");
  await panel.getByRole("button", { name: "Desmarcar" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Desmarcar a troca de plano?" });
  await confirm.getByRole("button", { name: "Desmarcar" }).click();
  await expect(panel.getByRole("button", { name: "Desmarcar" })).toHaveCount(0);
  await expect.poll(async () => (await subscriptionInDb()).scheduledChange).toBeUndefined();

  // O histórico do plano guarda os dois passos.
  await expect(panel.getByText("Histórico do plano")).toBeVisible();
  await expect(panel).toContainText("Troca marcada");
  await expect(panel).toContainText("Troca desmarcada");
});

test("aviso fixo no topo: o plano renova em 24/09 (Pix) para o dono", async ({ page }) => {
  await seedPlan(page, { ...PRO, renewsOn: "2026-09-24", nextDueDate: "2026-09-24" });
  await page.goto("/dashboard");
  const notice = page.getByRole("status").filter({ hasText: "Seu plano renova em 24/09" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Pague o Pix do Plano Profissional até o dia para seguir sem pausa.");
  await expect(notice.getByRole("link", { name: "Ver o plano" })).toHaveAttribute("href", "/settings?tab=plano");
});

test("sem renovação perto, não há aviso no topo", async ({ page }) => {
  await seedPlan(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Menu do usuário" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Seu plano renova" })).toHaveCount(0);
});

test("conta real: o Grátis leva ao checkout, não ao botão de demonstração", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings?tab=plano");
  const panel = page.locator("#settings-panel-plano");
  await expect(panel.getByRole("button", { name: "Ativar Profissional (demonstração)" })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "Assinar o Profissional" })).toHaveAttribute(
    "href",
    "/plans/checkout?tier=pro&interval=monthly",
  );
});
