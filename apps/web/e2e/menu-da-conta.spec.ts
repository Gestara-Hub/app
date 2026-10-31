import type { Page } from "@playwright/test";
import { classGroup, expect, seedAcademy, skipWelcome, test } from "./fixtures";

/**
 * Dica do menu da conta no avatar (decisao de 31/10/2026): uma vez por pessoa,
 * no primeiro momento que chegar (segundo dia de uso no Painel, resposta do
 * suporte ou "Agora não" no aviso de seguranca). Hoje (relogio fixo) e 22/09/2026.
 * As preferencias do servidor vem simuladas: o dono do espaco e o mesmo nos
 * outros testes, e o banco nao guarda o que este teste grava.
 */

async function openWithPreferences(page: Page, preferences: Record<string, unknown>) {
  await page.route("**/api/preferences", (route) =>
    route.request().method() === "POST" ? route.fulfill({ json: { success: true } }) : route.fulfill({ json: { preferences } }),
  );
  await seedAcademy(page, { extra: (t) => (t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")]) });
  await skipWelcome(page);
  await page.evaluate(() => localStorage.removeItem("gestarahub_user_preferences"));
  await page.goto("/dashboard");
}

/** Preferencias guardadas no navegador (vao para a conta pelo envio comum das preferencias). */
const localTip = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("gestarahub_user_preferences") ?? "{}").accountMenuTip ?? null);

const tip = (page: Page, title: string) => page.locator("[data-product-tour]").getByRole("dialog", { name: title });

test("segundo dia de uso: a dica aponta o menu da conta uma vez e fica gravada na conta", async ({ page }) => {
  await openWithPreferences(page, { accountMenuTip: { firstSeenAt: "2026-09-21" } });
  await expect(tip(page, "Sua conta fica aqui")).toContainText("Tema, segurança, ajuda e sair, tudo neste menu.");
  await tip(page, "Sua conta fica aqui").getByRole("button", { name: "Entendi" }).click();
  await expect(page.locator("[data-product-tour]")).toHaveCount(0);
  await expect.poll(() => localTip(page)).toEqual({ firstSeenAt: "2026-09-21", shownAt: "2026-09-22" });
});

test("primeiro dia: sem dica", async ({ page }) => {
  await openWithPreferences(page, { accountMenuTip: { firstSeenAt: "2026-09-22" } });
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-product-tour]")).toHaveCount(0);
});

test("'Agora não' no aviso de segurança: a dica mostra onde ativar depois", async ({ page }) => {
  await openWithPreferences(page, { securityPrompt: { firstSeenAt: "2026-09-10" }, accountMenuTip: { firstSeenAt: "2026-09-22" } });
  const prompt = page.getByRole("dialog", { name: "Ative a verificação em duas etapas" });
  await prompt.getByRole("button", { name: "Agora não" }).click();
  await expect(tip(page, "Segurança fica aqui")).toContainText("Quando quiser, ative a verificação em duas etapas neste menu.");
  await tip(page, "Segurança fica aqui").getByRole("button", { name: "Entendi" }).click();
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await expect(page.getByRole("menuitem", { name: "Segurança" })).toBeVisible();
});

test("celular: a dica aparece inteira na tela, apontando o avatar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openWithPreferences(page, { accountMenuTip: { firstSeenAt: "2026-09-21" } });
  const balloon = tip(page, "Sua conta fica aqui");
  await expect(balloon).toBeVisible();
  const box = (await balloon.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  await balloon.getByRole("button", { name: "Entendi" }).click();
  await expect(page.locator("[data-product-tour]")).toHaveCount(0);
});
