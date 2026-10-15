import { expect, test as base, type Page } from "@playwright/test";

/** Origem do app nos testes (ver E2E_PORT no playwright.config). */
export const BASE_URL = `http://localhost:${process.env.E2E_PORT ?? 3000}`;

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

/** Telas com alternancia Lista/Cards (chaves do `useViewMode`). */
const VIEW_MODE_TIP_KEYS = ["clients", "turmas", "modalities", "plans", "professionals"] as const;

export const test = base.extend<{ pageErrors: string[]; viewModeTipsSeen: boolean; viewModeTips: void }>({
  /**
   * Dica "Lista ou cards" ja vista em todas as telas (ela aparece com o 1º
   * registro e cobriria cliques). Spec que testa a dica: `test.use({ viewModeTipsSeen: false })`.
   */
  viewModeTipsSeen: [true, { option: true }],
  viewModeTips: [
    async ({ page, viewModeTipsSeen }, use) => {
      if (viewModeTipsSeen) {
        await page.addInitScript((keys) => {
          try {
            for (const key of keys) localStorage.setItem(`gestarahub_coachmark_view_mode_${key}`, "1");
            // Tour das abas de Planos e pacotes (primeiro acesso pela configuracao inicial).
            localStorage.setItem("gestarahub_tour_plans_tabs", "1");
          } catch {
            // about:blank e afins nao tem localStorage
          }
        }, [...VIEW_MODE_TIP_KEYS]);
      }
      await use();
    },
    { auto: true },
  ],
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
const DATE_TEXT =
  /\d{1,2} de [a-zç]+( de \d{4})?|\d{2}\/\d{2}|(segunda|terça|quarta|quinta|sexta)-feira|sábado|domingo|hoje|amanhã|(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)( de \d{4})?/i;

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

const DEMO_USERS = {
  "Ana Ribeiro": { id: "usr-ac-ana", organizationId: "org-academia-x", email: "ana@academiax.com" },
  "Marcelo Andrade": { id: "usr-marcelo", organizationId: "org-corte-nobre", email: "marcelo@cortenobre.com" },
} as const;

/**
 * Entra como um usuario de demonstracao gravando o cookie de sessao (a tela de
 * login hoje so lista a Ana) e marca a configuracao inicial como concluida em
 * todos os espacos (senao o proprietario vai para /setup). Termina no Dashboard.
 */
export async function loginAs(page: Page, name: keyof typeof DEMO_USERS): Promise<void> {
  await setSessionCookie(page, name);
  await page.goto("/dashboard");
  await completeOnboarding(page);
  await page.goto("/dashboard");
}

/** So grava o cookie de sessao (sem concluir a configuracao inicial nem navegar). */
export async function setSessionCookie(page: Page, name: keyof typeof DEMO_USERS): Promise<void> {
  const claims = { ...DEMO_USERS[name], name, profile: "owner", status: "active", createdAt: TS, updatedAt: TS };
  await page.context().addCookies([
    {
      name: "gestarahub_session",
      value: Buffer.from(JSON.stringify(claims), "utf8").toString("base64"),
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Marca a configuracao inicial como concluida (e as modalidades revisadas) em
 * todos os espacos do mundo do mock. Espera o app gravar o mundo e recarrega.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  await page.waitForFunction(() => localStorage.getItem("gestarahub:db") !== null);
  const raw = await page.evaluate(() => localStorage.getItem("gestarahub:db"));
  const world = JSON.parse(raw as string) as World;
  for (const tenant of Object.values(world.data.tenants)) {
    tenant.organization.settings = {
      ...(tenant.organization.settings ?? {}),
      onboardingCompleted: true,
      modalitiesReviewed: true,
    };
  }
  await page.evaluate((json) => localStorage.setItem("gestarahub:db", json), JSON.stringify(world));
  await page.reload();
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
      onboardingCompleted: true,
      modalitiesReviewed: true,
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
