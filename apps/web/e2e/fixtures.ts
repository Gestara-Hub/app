import { expect, test as base, type Page } from "@playwright/test";

/**
 * Base dos testes de ponta a ponta.
 * - Relogio do navegador fixo em 22/09/2026 (status de atraso e meses previsiveis).
 * - Falha o teste em qualquer erro de pagina ou de console.
 * - Cada teste roda num contexto novo: localStorage (o "banco" do mock) limpo.
 */
export const TODAY = "2026-09-22T12:00:00";

type World = { v: number; data: { tenants: Record<string, Tenant>; activeOrganizationId: string } };
// O mundo do mock visto pelos testes (so os campos que os cenarios mexem).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tenant = Record<string, any>;

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const where = () => new URL(page.url()).pathname;
      page.on("pageerror", (e) => {
        if (!isClockHydrationMismatch(e.message)) errors.push(`pageerror em ${where()}: ${e.message}`);
      });
      page.on("console", (m) => {
        if (m.type() === "error" && !m.text().includes(SCRIPT_TAG_WARNING)) errors.push(`console em ${where()}: ${m.text()}`);
      });
      await page.clock.setFixedTime(new Date(TODAY));
      await use(errors);
      expect(errors, "erros no navegador durante o teste").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Aviso do React 19 sempre que o <script> do next-themes renderiza no cliente
 * (arvore refeita apos hidratacao, Fast Refresh do `pnpm dev`). Ruido de biblioteca.
 */
const SCRIPT_TAG_WARNING = "Encountered a script tag while rendering React component";
const DATE_TEXT = /\d{1,2} de [a-zç]+( de \d{4})?|\d{2}\/\d{2}|(segunda|terça|quarta|quinta|sexta)-feira|sábado|domingo|hoje|amanhã/i;

/**
 * O relogio fixo vale so no navegador: o servidor do `pnpm dev` renderiza com a
 * data real. Se o HTML do servidor difere do cliente APENAS em textos de data, o
 * descasamento e do ambiente de teste, nao do app. Qualquer outra diferenca reprova.
 */
function isClockHydrationMismatch(message: string): boolean {
  if (!message.startsWith("Hydration failed")) return false;
  const tree = message.split("hydration-mismatch")[1] ?? "";
  const diff = tree
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[+-]\s/.test(l))
    .map((l) => l.slice(1).trim());
  return diff.length > 0 && diff.every((l) => DATE_TEXT.test(l));
}

/** Entra pela tela de login com um dos usuarios de demonstracao. */
export async function loginAs(page: Page, name: "Ana Ribeiro" | "Marcelo Andrade"): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/**
 * Ajusta o mundo do mock direto no localStorage e recarrega. O app ja gravou o
 * mundo semeado no primeiro acesso, entao a versao do seed e respeitada.
 */
export async function editWorld(page: Page, org: string, mutate: (t: Tenant) => void): Promise<void> {
  const raw = await page.evaluate(() => localStorage.getItem("gestarahub:db"));
  if (!raw) throw new Error("mundo do mock ainda nao foi gravado");
  const world = JSON.parse(raw) as World;
  mutate(world.data.tenants[org]);
  await page.evaluate((json) => localStorage.setItem("gestarahub:db", json), JSON.stringify(world));
  await page.reload();
}

const TS = "2026-09-01T12:00:00.000Z";
const openDay = (weekday: number) => ({
  weekday,
  closed: false,
  start: "06:00",
  end: "22:00",
  shifts: [{ start: "06:00", end: "22:00" }],
});

/** Academia pronta para cobrar: horario, regra de cobranca e plano mensal de R$ 150. */
export async function seedAcademy(
  page: Page,
  opts: { timing?: "prepaid" | "postpaid"; strategy?: "prorated" | "full_cycle"; extra?: (t: Tenant) => void } = {},
): Promise<void> {
  await loginAs(page, "Ana Ribeiro");
  await editWorld(page, "org-academia-x", (t) => {
    t.organization.settings = {
      defaultDueDay: 10,
      billingTiming: opts.timing ?? "prepaid",
      midMonthStrategy: opts.strategy ?? "prorated",
    };
    t.unit.businessHours = [{ weekday: 0, closed: true, shifts: [] }, ...[1, 2, 3, 4, 5, 6].map(openDay)];
    t.categories = [{ id: "m-jj", organizationId: "org-academia-x", name: "Jiu-Jitsu", position: 0, status: "active", createdAt: TS, updatedAt: TS }];
    t.professionals = [
      { id: "pr-1", organizationId: "org-academia-x", unitId: "unit-academia-x", name: "Carlos Silva", modalityIds: ["m-jj"], serviceIds: [], workingHours: [], status: "active", createdAt: TS, updatedAt: TS },
    ];
    t.plans = [{ id: "p-m", organizationId: "org-academia-x", name: "Mensal Jiu-Jitsu", priceCents: 15000, period: "monthly", status: "active", createdAt: TS, updatedAt: TS }];
    opts.extra?.(t);
  });
}

/** Aluno com plano mensal ja cadastrado (sem cobranca), para os testes de geracao. */
export function student(id: string, name: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: "org-academia-x",
    name,
    phone: "11977770000",
    planId: "p-m",
    planStartDate: "2026-09-20",
    billingStrategy: "prorated",
    cyclePaymentTiming: "prepaid",
    dueDay: 10,
    membershipStatus: "active",
    status: "active",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

/** Turma ativa da academia (Carlos Silva, Jiu-Jitsu). Padrao: seg/ter/qua 17h, 10 vagas, aceita avulso a R$ 40. */
export function classGroup(id: string, name: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: "org-academia-x",
    unitId: "unit-academia-x",
    name,
    modalityId: "m-jj",
    instructorId: "pr-1",
    capacity: 10,
    allowDropin: true,
    sessionPriceCents: 4000,
    meetingSlots: [1, 2, 3].map((weekday) => ({ weekday, start: "17:00", end: "18:00" })),
    startDate: "2026-09-14",
    status: "active",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

/** Matricula ativa de um aluno numa turma. */
export function enrollment(id: string, classGroupId: string, studentId: string) {
  return { id, classGroupId, studentId, status: "active", enrolledAt: TS };
}

/** Marca as boas-vindas do onboarding como respondidas (o modal nao cobre o dashboard). */
export async function skipWelcome(page: Page, org = "org-academia-x"): Promise<void> {
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ seen: true, dismissed: false, tours: {} })),
    `gestarahub:onboarding:${org}`,
  );
}
