import type { Page } from "@playwright/test";
import { BASE_URL, classGroup, expect, student } from "./fixtures";

/**
 * Ajudantes dos testes de dinheiro (dinheiro-*.spec.ts): cobrancas de todos os
 * tipos, pacotes de aulas, WhatsApp e leitura do mundo do mock. Relogio fixo em
 * 22/09/2026 (terca).
 */

export const ORG = "org-academia-x";
export const UNIT = "unit-academia-x";
export const TS = "2026-09-01T12:00:00.000Z";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tenant = Record<string, any>;

/** A linha inteira (texto + valor + acoes) de um aluno numa lista (ListRow e `div.group`). */
export const rowOf = (page: Page, text: string) => page.locator("div.group").filter({ hasText: text });

/** Abre o menu ⋮ "Ações de {nome}" e escolhe a acao. */
export async function menuAction(page: Page, name: string, action: string | RegExp) {
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

/** Itens do menu ⋮ aberto (texto de cada menuitem). */
export async function openMenuItems(page: Page, name: string): Promise<string[]> {
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  const items = page.getByRole("menuitem");
  await expect(items.first()).toBeVisible();
  const texts = (await items.allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  return texts;
}

/** Itens do menu de clique direito da linha (vazio quando a linha nao tem menu). */
export async function contextMenuItems(page: Page, row: ReturnType<Page["locator"]>): Promise<string[]> {
  await row.click({ button: "right" });
  const menu = page.getByRole("menu");
  if ((await menu.count()) === 0) return [];
  const texts = (await menu.getByRole("menuitem").allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  return texts;
}

/** Escolhe uma opcao num Select (Radix) pelo nome acessivel do gatilho. */
export async function pickSelect(page: Page, trigger: string, option: string | RegExp) {
  await page.getByRole("combobox", { name: trigger }).click();
  await page.getByRole("option", { name: option }).click();
}

/** Le o tenant da academia gravado no localStorage. */
export async function tenantOf(page: Page, org = ORG): Promise<Tenant> {
  const raw = await page.evaluate(() => localStorage.getItem("gestarahub:db"));
  return JSON.parse(raw ?? "{}").data.tenants[org] as Tenant;
}

/** Espera o app gravar o mundo (senao o goto seguinte perde a escrita). */
export async function waitForTenant(page: Page, predicate: (t: Tenant) => boolean, org = ORG) {
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem("gestarahub:db"));
      if (!raw) return false;
      return predicate(JSON.parse(raw).data.tenants[org] as Tenant);
    })
    .toBe(true);
}

/** Aluno sem plano (sem mensalidade). */
export const noPlan = (id: string, name: string, over: Record<string, unknown> = {}) =>
  student(id, name, { planId: undefined, ...over });

/** Cobranca gravada direto no mundo (padrao: avulsa "Kimono" de R$ 250 em aberto, vence 25/09). */
export function charge(id: string, studentId: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: ORG,
    unitId: UNIT,
    studentId,
    kind: "extra",
    description: "Kimono",
    competence: "2026-09",
    dueDate: "2026-09-25",
    amountCents: 25000,
    status: "pending",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

/** Mensalidade do plano mensal de R$ 150 (setembro, vence 10/09). */
export function membership(id: string, studentId: string, over: Record<string, unknown> = {}) {
  return charge(id, studentId, {
    kind: "membership",
    description: undefined,
    planId: "p-m",
    dueDate: "2026-09-10",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    amountCents: 15000,
    ...over,
  });
}

/** Pacote do catalogo (padrao: "10 aulas", R$ 500, sem validade, todas as modalidades). */
export function lessonPackage(id: string, name: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: ORG,
    name,
    lessons: 10,
    priceCents: 50000,
    modalityIds: [],
    absenceConsumes: true,
    status: "active",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

/** Pacote vendido ao aluno (padrao: 10 aulas, nenhuma usada, comprado em 01/09). */
export function studentPackage(id: string, studentId: string, packageId: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: ORG,
    unitId: UNIT,
    studentId,
    packageId,
    name: "10 aulas",
    lessonsTotal: 10,
    lessonsUsed: 0,
    purchasedAt: "2026-09-01",
    modalityIds: [],
    absenceConsumes: true,
    status: "active",
    chargeIds: [],
    usages: [],
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

/** Aula gasta do pacote (presenca, por padrao). */
export function usage(classGroupId: string, date: string, over: Record<string, unknown> = {}) {
  return {
    sessionId: `${classGroupId}~${date}~17:00`,
    classGroupId,
    date,
    reason: "present",
    ...over,
  };
}

/** Turma paga por pacote (seg/ter/qua 17h, sem avulso). */
export const packageClass = (id: string, name: string, over: Record<string, unknown> = {}) =>
  classGroup(id, name, { billingMode: "package", allowDropin: false, sessionPriceCents: undefined, ...over });

/** Curso de confeitaria (seg 19h), R$ 800 em ate 4x, termina 30/11. */
export const courseClass = (id: string, name = "Confeitaria", over: Record<string, unknown> = {}) =>
  classGroup(id, name, {
    allowDropin: false,
    sessionPriceCents: undefined,
    meetingSlots: [{ weekday: 1, start: "19:00", end: "21:00" }],
    billingMode: "course",
    coursePriceCents: 80000,
    courseMaxInstallments: 4,
    endDate: "2026-11-30",
    ...over,
  });

/** Plano Pro com o pagamento online ligado (o tier tambem vai no cookie que o servidor le). */
export async function makePro(page: Page, opts: { online?: boolean } = {}) {
  await page.context().addCookies([
    { name: "gestarahub_tier", value: `${ORG}:pro`, url: BASE_URL, sameSite: "Lax" },
  ]);
  return (t: Tenant) => {
    t.organization.subscription = { tier: "pro" };
    if (opts.online !== false) {
      t.organization.settings = { ...t.organization.settings, onlinePayments: { enabled: true, defaultExpiresInMinutes: 1440 } };
    }
  };
}

/** Executa a acao que abre o WhatsApp (envio assistido) e devolve o link aberto na aba nova. */
export async function openedWhatsApp(page: Page, action: () => Promise<void>) {
  await page.context().route("https://api.whatsapp.com/**", (route) =>
    route.fulfill({ body: "ok", contentType: "text/plain" }),
  );
  const [popup] = await Promise.all([page.waitForEvent("popup"), action()]);
  await popup.waitForLoadState();
  const raw = popup.url();
  await popup.close();
  const url = new URL(raw);
  return {
    raw,
    origin: `${url.origin}${url.pathname}`,
    phone: url.searchParams.get("phone"),
    // O valor em reais vem do Intl com espaco fino (U+00A0) depois do "R$".
    text: (url.searchParams.get("text") ?? "").replace(/ /g, " "),
  };
}

/** Escolhe a opcao de um Combobox de formulario (Popover + cmdk). */
export async function pickCombobox(page: Page, scope: ReturnType<Page["locator"]>, label: string | RegExp, option: string | RegExp) {
  await scope.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

/** Escolhe a opcao de um SelectField de formulario (DropdownMenu: itens sao menuitem). */
export async function pickField(page: Page, scope: ReturnType<Page["locator"]>, label: string | RegExp, option: string) {
  await scope.getByRole("combobox", { name: label }).click();
  await page.getByRole("menuitem", { name: option, exact: true }).click();
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * Troca o mes pelo seletor (Proximo/Mes anterior) e espera a tela chegar nele:
 * cliques seguidos antes do re-render contam como um so.
 */
export async function stepMonth(page: Page, dir: "next" | "prev", target: string) {
  const [y, m] = target.split("-").map(Number);
  await page.getByRole("button", { name: dir === "next" ? "Próximo mês" : "Mês anterior" }).click();
  await expect(page.getByRole("button", { name: `Escolher mês (${MONTHS[m - 1]} de ${y})` })).toBeVisible();
}
