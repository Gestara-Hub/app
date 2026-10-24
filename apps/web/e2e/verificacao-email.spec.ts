import type { Page } from "@playwright/test";
import { setKnownTwoFactorEmailCode } from "./db";
import { currentAcademy, expect, seedAcademy, skipWelcome, test } from "./fixtures";

/**
 * Verificacao em duas etapas por e-mail (doc technical/17, entrega 2): ligar na
 * janela Seguranca, sair, entrar com o codigo, "lembrar este dispositivo",
 * entrar de novo sem codigo e esquecer o dispositivo. O codigo do e-mail e
 * trocado por um conhecido no banco (o e-mail nao sai no e2e).
 */

const security = (page: Page) => page.getByRole("dialog", { name: "Segurança" });

async function openSecurity(page: Page) {
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Segurança" }).click();
  await expect(security(page)).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function signInWithPassword(page: Page) {
  const owner = currentAcademy().owner;
  await page.getByLabel("E-mail").fill(owner.email);
  await page.getByLabel("Senha", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("liga pelo e-mail, entra com o código, lembra o dispositivo e esquece", async ({ page }) => {
  await seedAcademy(page);
  await skipWelcome(page);
  await page.goto("/dashboard");
  const ownerAuthId = currentAcademy().owner.id;

  // Ligar: a janela mostra os dois metodos.
  await openSecurity(page);
  await expect(security(page).getByText("Aplicativo autenticador")).toBeVisible();
  await security(page).getByRole("button", { name: "Usar e-mail" }).click();
  await security(page).getByRole("button", { name: "Enviar código" }).click();
  await expect(security(page).getByText(/Enviamos um código para e2\*\*\*@gestarahub\.test/)).toBeVisible();
  await setKnownTwoFactorEmailCode(ownerAuthId, "enable", "246810");
  await security(page).getByLabel("Código do e-mail").fill("246810");
  await security(page).getByRole("button", { name: "Ligar" }).click();
  await expect(page.getByText("Verificação em duas etapas ligada.")).toBeVisible();
  await expect(security(page).getByText("Nenhum dispositivo lembrado.")).toBeVisible();
  await page.keyboard.press("Escape");

  // Sair e entrar: pede o codigo do e-mail.
  await signOut(page);
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/two-factor/);
  await expect(page.getByText(/Enviamos um código para/)).toBeVisible();
  await setKnownTwoFactorEmailCode(ownerAuthId, "login", "135790");
  await page.getByLabel("Código do e-mail").fill("135790");
  await page.getByLabel("Lembrar este dispositivo por 30 dias").check();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Dispositivo lembrado: o proximo login entra direto.
  await signOut(page);
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/dashboard/);

  // Esquecer: volta a pedir o codigo.
  await openSecurity(page);
  await expect(security(page).getByText("Este dispositivo")).toBeVisible();
  await security(page).getByRole("button", { name: "Esquecer", exact: true }).click();
  await expect(security(page).getByText("Nenhum dispositivo lembrado.")).toBeVisible();
  await page.keyboard.press("Escape");
  await signOut(page);
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/two-factor/);
});
