import { randomUUID } from "node:crypto";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { authAdmin, ownerSql, purgeAudit, TEST_PASSWORD } from "./db";
import { totpNow } from "../src/test/totp";

/** Tudo que os testes criam leva esta marca: a limpeza apaga so isso. */
export const E2E_DOMAIN = "e2e.gestarahub.local";
export const E2E_SPACE_PREFIX = "E2E ";

export interface E2eAdmin {
  adminId: string;
  authUserId: string;
  email: string;
  name: string;
  role: string;
  /** Segredo do aplicativo autenticador (so existe depois do primeiro login). */
  secret?: string;
}

const created: E2eAdmin[] = [];

export async function makeAdmin(role: string, name = `E2E ${role}`): Promise<E2eAdmin> {
  const owner = ownerSql();
  try {
    const email = `e2e-${role}-${randomUUID().slice(0, 8)}@${E2E_DOMAIN}`;
    const { data } = await authAdmin().auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true, app_metadata: { platform: true } });
    const [row] = await owner`insert into platform.admins (auth_user_id, name, email, role) values (${data.user!.id}, ${name}, ${email}, ${role}) returning id`;
    const admin = { adminId: row.id as string, authUserId: data.user!.id, email, name, role };
    created.push(admin);
    return admin;
  } finally {
    await owner.end();
  }
}

/** Entra pela tela (senha e segundo fator); no primeiro acesso cadastra o aplicativo e guarda o segredo. */
export async function signIn(page: Page, admin: E2eAdmin, shots?: { login?: string; mfa?: string }): Promise<void> {
  await page.goto("/login");
  if (shots?.login) await page.screenshot({ path: shots.login });
  await page.getByLabel("E-mail").fill(admin.email);
  await page.getByLabel("Senha").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /^(Continuar|Entrar)/ }).click();
  await page.waitForURL(/\/mfa/);
  if (shots?.mfa) await page.screenshot({ path: shots.mfa });
  if (!admin.secret) {
    const secret = (await page.locator("[data-mfa-secret]").first().innerText()).trim();
    admin.secret = secret;
  }
  await page.getByLabel(/código/i).fill(totpNow(admin.secret));
  await page.getByRole("button", { name: /confirmar|entrar|verificar/i }).click();
  await page.waitForURL((url) => !/\/(login|mfa)/.test(url.pathname));
}

/** Contexto já entrado como esse administrador (guarda o estado para as telas seguintes). */
export async function signedInContext(browser: Browser, admin: E2eAdmin, viewport?: { width: number; height: number }): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo", ...(viewport ? { viewport } : {}) });
  const page = await context.newPage();
  await signIn(page, admin);
  return { context, page };
}

/** Espaço de teste no banco (nome com a marca E2E). */
export async function makeSpace(name: string, extra: { subscription?: Record<string, unknown>; status?: string } = {}): Promise<string> {
  const owner = ownerSql();
  try {
    const [row] = await owner<{ id: string }[]>`
      insert into public.organizations (name, model, class_segment, subscription, status, created_at)
      values (${`${E2E_SPACE_PREFIX}${name}`}, 'classes', 'martial_arts', ${owner.json((extra.subscription ?? { tier: "free" }) as never)}, ${extra.status ?? "active"}, now())
      returning id`;
    return row.id;
  } finally {
    await owner.end();
  }
}

/** Apaga o que os testes deixaram: administradores, espaços e o que pende deles. */
export async function cleanupAll(): Promise<void> {
  const owner = ownerSql();
  try {
    const admins = await owner<{ id: string; auth_user_id: string }[]>`select id, auth_user_id from platform.admins where email like ${`%@${E2E_DOMAIN}`}`;
    const ids = admins.map((a) => a.id);
    if (ids.length > 0) {
      await purgeAudit(owner, ids);
      await owner`delete from platform.admins where id = any(${ids}::uuid[])`;
    }
    for (const admin of admins) await authAdmin().auth.admin.deleteUser(admin.auth_user_id).catch(() => undefined);
    // O que os fluxos criam fora de espaço e administrador: comunicados, pedidos LGPD e respostas prontas.
    await owner`delete from platform.announcements where created_by_name like 'E2E %'`.catch(() => undefined);
    await owner`delete from platform.privacy_requests where requester_email like ${`%@${E2E_DOMAIN}`}`.catch(() => undefined);
    await owner`delete from platform.support_macros where title like 'Resposta %' and body = 'Oi! Pode me contar mais detalhes?'`.catch(() => undefined);
    const spaces = await owner<{ id: string }[]>`select id from public.organizations where name like ${`${E2E_SPACE_PREFIX}%`}`;
    for (const space of spaces) {
      await purgeAudit(owner, [], `organization_id = '${space.id}'`).catch(() => undefined);
      await owner`delete from public.organizations where id = ${space.id}`.catch(() => undefined);
    }
  } finally {
    await owner.end();
  }
}

/** Erros de console, de página e respostas 5xx durante o teste (a tela não pode gerar nenhum). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Falha de rede de recurso externo (fonte, imagem) não é erro da tela.
    if (/Failed to load resource/.test(text) && !/50\d/.test(text)) return;
    errors.push(`console: ${text.slice(0, 400)}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  return errors;
}

/** A página não pode rolar para o lado (nada vaza da tela). */
export async function expectNoHorizontalScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `rolagem horizontal em ${where}`).toBeLessThanOrEqual(1);
}
