import type { Page } from "@playwright/test";
import { admin } from "./db";
import { classGroup, currentAcademy, expect, seedAcademy, skipWelcome, test } from "./fixtures";

/**
 * Aviso da verificacao em duas etapas (doc product/25, secao 5): depois de 7
 * dias de uso, no acesso; "Agora não" nao repete; "Ativar agora" abre a escolha
 * entre o app e o e-mail. Hoje (relogio fixo) e 22/09/2026.
 */

async function openWithUsage(page: Page, firstSeenAt: string) {
  // A primeira tela grava "primeiro dia = hoje" e manda ao sair da pagina: chegando
  // depois do ajuste abaixo, apagava os 7 dias de uso (teste instavel). O app
  // segue lendo as preferencias do servidor; so as gravacoes ficam de fora.
  await page.route("**/api/preferences", (route) =>
    route.request().method() === "POST" ? route.fulfill({ json: { success: true } }) : route.continue(),
  );
  await seedAcademy(page, { extra: (t) => (t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")]) });
  await skipWelcome(page);
  // As preferencias do servidor valem sobre as do navegador: o primeiro dia vai no banco.
  const ownerId = currentAcademy().owner.id;
  await admin()
    .from("user_preferences")
    .upsert({ user_id: ownerId, preferences: { securityPrompt: { firstSeenAt } } })
    .throwOnError();
  await page.evaluate(() => localStorage.removeItem("gestarahub_user_preferences"));
  await page.goto("/dashboard");
}

const prompt = (page: Page) => page.getByRole("dialog", { name: "Ative a verificação em duas etapas" });

test("7 dias de uso: o aviso aparece no acesso; 'Agora não' fecha e não volta na mesma visita", async ({ page }) => {
  await openWithUsage(page, "2026-09-10");
  await expect(prompt(page)).toBeVisible();
  await expect(prompt(page)).toContainText("Proteja sua conta com uma etapa a mais no login.");
  await prompt(page).getByRole("button", { name: "Agora não" }).click();
  await expect(prompt(page)).toBeHidden();
  await page.reload();
  await expect(page.getByText("Lembretes", { exact: true }).or(page.getByRole("heading").first())).toBeVisible();
  await expect(prompt(page)).toHaveCount(0);
});

test("menos de 7 dias de uso: sem aviso", async ({ page }) => {
  await openWithUsage(page, "2026-09-20");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(prompt(page)).toHaveCount(0);
});

test("'Ativar agora' abre a escolha entre o aplicativo e o e-mail", async ({ page }) => {
  await openWithUsage(page, "2026-09-10");
  await prompt(page).getByRole("button", { name: "Ativar agora" }).click();
  const security = page.getByRole("dialog", { name: "Segurança" });
  await expect(security.getByRole("button", { name: "Usar aplicativo" })).toBeVisible();
  await expect(security.getByRole("button", { name: "Usar e-mail" })).toBeVisible();
  await security.getByRole("button", { name: "Usar aplicativo" }).click();
  await expect(page.getByRole("img", { name: "QR code para o aplicativo autenticador" })).toBeVisible();
});
