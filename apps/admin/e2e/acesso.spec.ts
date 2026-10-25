import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { authAdmin, TEST_PASSWORD } from "./db";
import { E2E_DOMAIN, makeAdmin, signIn } from "./helpers";

mkdirSync("test-results/telas", { recursive: true });

/** Entrada no painel: validação, senha errada, segundo fator, sair e isolamento de quem é cliente. */
test("login valida os campos e recusa a senha errada sem dizer qual está errada", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /^(Continuar|Entrar)/ }).click();
  await expect(page.getByText(/obrigat|informe|preencha|inválid/i).first()).toBeVisible();
  const admin = await makeAdmin("platform_viewer", "E2E Leitor");
  await page.getByLabel("E-mail").fill(admin.email);
  await page.getByLabel("Senha").fill("senha-errada-123");
  await page.getByRole("button", { name: /^(Continuar|Entrar)/ }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});

test("primeiro acesso cadastra o autenticador, sair e entrar de novo pede só o código", async ({ page }) => {
  const admin = await makeAdmin("platform_viewer", "E2E Leitor");
  await signIn(page, admin, { login: "test-results/telas/login-desktop.png", mfa: "test-results/telas/mfa-cadastro-desktop.png" });
  await expect(page.getByRole("heading", { name: /Olá/ })).toBeVisible();
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: /Sair/ }).click();
  await page.waitForURL(/\/login/);
  await signIn(page, admin, { mfa: "test-results/telas/mfa-codigo-desktop.png" });
  await expect(page.getByRole("heading", { name: /Olá/ })).toBeVisible();
});

test("código errado do segundo fator é recusado", async ({ page }) => {
  const admin = await makeAdmin("platform_viewer", "E2E Leitor");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(admin.email);
  await page.getByLabel("Senha").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /^(Continuar|Entrar)/ }).click();
  await page.waitForURL(/\/mfa/);
  await page.getByLabel(/código/i).fill("000000");
  await page.getByRole("button", { name: /Confirmar|Entrar/ }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page).toHaveURL(/\/mfa/);
});

test("quem é cliente (usuário de espaço) não entra no painel", async ({ page }) => {
  const email = `e2e-cliente-${Date.now().toString(36)}@${E2E_DOMAIN}`;
  const { data } = await authAdmin().auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  try {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /^(Continuar|Entrar)/ }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await authAdmin().auth.admin.deleteUser(data.user!.id);
  }
});

test("telas protegidas mandam para o login e guardam o destino", async ({ page }) => {
  await page.goto("/audit");
  await expect(page).toHaveURL(/\/login/);
  expect(page.url()).toContain("next=");
});
