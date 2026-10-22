import type { Locator, Page } from "@playwright/test";
import { editWorld, expect, loginAs, readAcademy } from "./fixtures";

/**
 * Atalhos dos testes "gerais" (agenda do Modelo 1, usuarios e perfis,
 * auditoria, relatorios, turmas e comunicacao). Hoje e terca 22/09/2026.
 */

export const TS = "2026-09-01T12:00:00.000Z";
export const BARBER = "org-corte-nobre";
export const BARBER_UNIT = "unit-matriz";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tenant = Record<string, any>;

const barberBase = { organizationId: BARBER, createdAt: TS, updatedAt: TS };

/** Segunda a sabado das 09h as 19h; domingo fechado. */
export const BARBER_HOURS = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
  weekday === 0
    ? { weekday, closed: true, shifts: [] }
    : { weekday, closed: false, start: "09:00", end: "19:00", shifts: [{ start: "09:00", end: "19:00" }] },
);

export function barberService(id: string, name: string, over: Record<string, unknown> = {}) {
  return { id, name, durationMinutes: 30, priceCents: 5000, status: "active", ...barberBase, ...over };
}

export function barberProfessional(id: string, name: string, over: Record<string, unknown> = {}) {
  return { id, unitId: BARBER_UNIT, name, status: "active", workingHours: [], serviceIds: [], ...barberBase, ...over };
}

export function barberClient(id: string, name: string, over: Record<string, unknown> = {}) {
  return { id, name, phone: "11988887777", status: "active", ...barberBase, ...over };
}

export function appointment(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    unitId: BARBER_UNIT,
    clientId: "cl-pedro",
    professionalId: "pr-joao",
    serviceIds: ["sv-corte"],
    date: "2026-09-22",
    start: "14:00",
    end: "14:30",
    status: "pending",
    origin: "manual",
    ...barberBase,
    ...over,
  };
}

/** Joao atende seg a sex 09h-18h com almoco 12h-13h; Lia ainda sem horario. */
export const JOAO_HOURS = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  start: "09:00",
  end: "18:00",
  breakStart: "12:00",
  breakEnd: "13:00",
}));

/**
 * Barbearia (Modelo 1) pronta para agendar: horario da unidade, categoria
 * Cabelo, servicos Corte (30 min, R$ 50) e Barba (30 min, R$ 35), Joao (com
 * horario e almoco) e Lia (sem horario), cliente Pedro e um agendamento
 * pendente hoje 14h com o Joao.
 */
export async function seedBarber(page: Page, extra?: (t: Tenant) => void): Promise<void> {
  await loginAs(page, "Marcelo Andrade");
  await editWorld(page, BARBER, (t) => {
    t.unit.businessHours = BARBER_HOURS;
    t.categories = [{ id: "cat-cabelo", name: "Cabelo", position: 0, status: "active", ...barberBase }];
    t.services = [
      barberService("sv-corte", "Corte", { categoryId: "cat-cabelo" }),
      barberService("sv-barba", "Barba", { priceCents: 3500 }),
    ];
    t.professionals = [
      barberProfessional("pr-joao", "João Barbeiro", { workingHours: JOAO_HOURS, serviceIds: ["sv-corte", "sv-barba"] }),
      barberProfessional("pr-lia", "Lia Tesoura", { serviceIds: ["sv-corte"] }),
    ];
    t.clients = [barberClient("cl-pedro", "Pedro Cliente")];
    t.appointments = [appointment("ap-1")];
    extra?.(t);
  });
}

/** Le uma colecao de um tenant no mundo gravado. */
export async function worldField<T>(page: Page, org: string, field: string): Promise<T> {
  if (org === "org-academia-x") return (await readAcademy())[field] as T;
  return page.evaluate(
    ([o, key]) => JSON.parse(localStorage.getItem("gestarahub:db") ?? "{}").data?.tenants?.[o]?.[key],
    [org, field] as const,
  );
}

/** Espera uma condicao sobre o mundo gravado (antes de um goto). */
export async function waitWorld(page: Page, org: string, check: (t: Tenant) => boolean): Promise<void> {
  await expect
    .poll(async () => {
      if (org === "org-academia-x") return check((await readAcademy()) as Tenant);
      const raw = await page.evaluate(() => localStorage.getItem("gestarahub:db"));
      if (!raw) return false;
      const tenant = JSON.parse(raw).data?.tenants?.[org];
      return tenant ? check(tenant) : false;
    })
    .toBe(true);
}

/** Escolhe uma opcao num combobox (Combobox/Select/MultiSelect) do escopo. */
export async function pick(page: Page, scope: Locator | Page, label: string | RegExp, option: string | RegExp) {
  await scope.getByRole("combobox", { name: label }).click();
  // Combobox/Select abrem "option"; o SelectField do projeto abre um menu.
  await page.getByRole("option", { name: option }).or(page.getByRole("menuitem", { name: option })).first().click();
}

/** Executa a acao que abre o WhatsApp (envio assistido) e devolve o link aberto. */
export async function openedWhatsApp(page: Page, action: () => Promise<void>) {
  await page.context().route("https://api.whatsapp.com/**", (route) =>
    route.fulfill({ body: "ok", contentType: "text/plain" }),
  );
  const [popup] = await Promise.all([page.waitForEvent("popup"), action()]);
  await popup.waitForLoadState();
  const url = new URL(popup.url());
  await popup.close();
  return {
    phone: url.searchParams.get("phone"),
    text: (url.searchParams.get("text") ?? "").replace(/ /g, " "),
  };
}

/** Sem rolagem lateral na pagina. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
