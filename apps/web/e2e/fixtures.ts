import { expect, test as base, type Locator, type Page } from "@playwright/test";
import {
  ACADEMY_ALIAS,
  addUser,
  linkAuthUser,
  createAcademy,
  editTenant,
  readTenant,
  removeCreatedTenants,
  signInBrowser,
  type E2ETenant,
} from "./db";
import { sessionCookieValue } from "./session-cookie";

/** Origem do app nos testes (ver E2E_PORT no playwright.config). */
export const BASE_URL = `http://localhost:${process.env.E2E_PORT ?? 3100}`;

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

/**
 * Espaco da academia do teste atual no banco (doc 15, fatia 5). Um teste por
 * vez (workers: 1), entao basta um por processo; e apagado no fim do teste.
 */
let academy: E2ETenant | undefined;

export function hasAcademy(): boolean {
  return academy !== undefined;
}

export function currentAcademy(): E2ETenant {
  if (!academy) throw new Error("Sem academia neste teste: chame loginAs(page, \"Ana Ribeiro\") antes.");
  return academy;
}

/** O espaco da academia como esta no banco (no lugar de ler o localStorage). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readAcademy(): Promise<Record<string, any>> {
  return (await readTenant(currentAcademy())) as unknown as Record<string, unknown>;
}

/** O espaco da academia em texto (para conferir se algo foi gravado). */
export async function academyJson(): Promise<string> {
  return JSON.stringify(await readAcademy());
}

export const test = base.extend<{
  pageErrors: string[];
  viewModeTipsSeen: boolean;
  viewModeTips: void;
  dbCleanup: void;
}>({
  dbCleanup: [
    async ({}, use) => {
      await use();
      academy = undefined;
      await removeCreatedTenants();
    },
    { auto: true },
  ],
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
            // Tour de Recebimentos online (logo depois de ativar a conta).
            localStorage.setItem("gestarahub_tour_online_payments", "1");
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
  await setSessionCookie(page, name, { onboardingCompleted: true, modalitiesReviewed: true });
  await page.goto("/dashboard");
  if (name !== "Ana Ribeiro") await completeOnboarding(page);
  await page.goto("/dashboard");
}

/**
 * So entra (sem navegar). A academia e um espaco de verdade no banco, criado
 * para o teste (configuracao inicial ja concluida; `settings` sobrepoe); a
 * barbearia segue no mock (modelo de agenda), pelo cookie de sessao.
 */
export async function setSessionCookie(
  page: Page,
  name: keyof typeof DEMO_USERS,
  settings: Record<string, unknown> = {},
): Promise<void> {
  if (name === "Ana Ribeiro") {
    // Como no mock: so com o cookie, a configuracao inicial ainda nao foi feita.
    academy ??= await createAcademy({ defaultDueDay: 10, ...settings });
    await signInBrowser(page, academy, academy.owner, BASE_URL);
    return;
  }
  const claims = { ...DEMO_USERS[name], name, profile: "owner", status: "active", createdAt: TS, updatedAt: TS };
  await page.context().addCookies([
    {
      name: "gestarahub_session",
      value: sessionCookieValue(claims),
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Mexe na academia do teste sem recarregar a pagina. */
export async function editAcademy(mutate: (t: Tenant) => void): Promise<void> {
  await editTenant(currentAcademy(), mutate);
}

/**
 * Entra na academia do teste como outro perfil (professor, recepcao, gerente):
 * cria o usuario de verdade no banco e entra com ele.
 */
export async function loginAsAcademyUser(
  page: Page,
  profile: "owner" | "manager" | "attendant" | "professional",
  name: string,
  professionalId?: string,
  userId?: string,
): Promise<void> {
  const tenant = currentAcademy();
  const user = userId
    ? await linkAuthUser(tenant, userId, name, profile, professionalId)
    : await addUser(tenant, profile, name, professionalId);
  // Sai da pagina do usuario anterior antes de trocar os cookies: o que ela ainda
  // buscasse sairia sem sessao (401 "sessao expirou" no console; doc 20).
  await page.goto("about:blank");
  await page.context().clearCookies();
  await signInBrowser(page, tenant, user, BASE_URL);
}

/**
 * Entra pela tela de login (e-mail e senha da dona da academia do teste),
 * para os cenarios que testam o proprio login. A pagina ja deve estar no /login.
 */
export async function signInWithForm(page: Page): Promise<void> {
  academy ??= await createAcademy();
  await page.getByLabel("E-mail").fill(academy.owner.email);
  await page.getByRole("textbox", { name: "Senha", exact: true }).fill(academy.owner.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

/**
 * Marca a configuracao inicial como concluida (e as modalidades revisadas) em
 * todos os espacos do mundo do mock. Espera o app gravar o mundo e recarrega.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  if (academy) {
    await editTenant(academy, (t) => {
      t.organization.settings = { ...(t.organization.settings ?? {}), onboardingCompleted: true, modalitiesReviewed: true };
    });
    await page.reload();
    return;
  }
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
  if (org === ACADEMY_ALIAS) {
    await editTenant(currentAcademy(), mutate);
    await page.reload();
    return;
  }
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
    // Autorizou o WhatsApp do espaco (doc product/27 M1): os cenarios do envio oficial dependem disso.
    whatsappConsentStatus: "granted",
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

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Linha do aluno na chamada da aula: um botao "{Aluno}: {marcacao}" ("sem
 * marcação", "Presente", "Faltou" ou "Justificada"). Tocar marca presenca.
 * A marcacao vem num trecho `sr-only`: o Chrome do sistema (157) poe um espaco antes dos
 * dois pontos no nome acessivel ("Aluno Sete : Presente"), por isso a regex.
 */
export function rollCallRow(page: Page, name: string): Locator {
  return page.getByRole("button", { name: new RegExp(`^${escapeRegExp(name)}\\s?: `) });
}

/** Nome acessivel da linha da chamada com a marcacao (aceita o espaco antes dos dois pontos). */
export function rollCallName(name: string, mark: string): RegExp {
  return new RegExp(`^${escapeRegExp(name)}\\s?: ${escapeRegExp(mark)}$`);
}

/**
 * A chamada guarda os toques na tela ate o "Salvar" (12/11/2026): grava e espera
 * a confirmacao (saldo do pacote e frequencia so mudam depois).
 */
export async function saveRollCall(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Chamada salva.").last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar", exact: true })).toHaveCount(0);
}

/** Falta, justificativa e desmarcar ficam no menu ⋮ do aluno na chamada. */
export async function attendanceAction(
  page: Page,
  name: string,
  action: "Marcar falta" | "Justificar falta" | "Desmarcar",
): Promise<void> {
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

/**
 * Abre o menu ⋮ do cabecalho ("Mais ações da aula", "da turma", "do aluno" ou,
 * no modelo de agenda, "do cliente") e escolhe a acao.
 */
export async function pageAction(
  page: Page,
  menu: "Mais ações da aula" | "Mais ações da turma" | "Mais ações do aluno" | "Mais ações do cliente",
  action: string,
): Promise<void> {
  await page.getByRole("button", { name: menu, exact: true }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

/** Secoes da ficha do aluno (sanfona). "Pacotes" so aparece com pacote ativo. */
export type ProfileSectionTitle = "Turmas" | "Plano e pacotes" | "Cobranças" | "Evolução" | "Mensagens" | "Cadastro";

/**
 * Botao de uma secao da ficha do aluno (`aria-expanded`). O nome acessivel e o
 * titulo seguido do resumo de uma linha ("Cobranças 1 em aberto · R$ 55,00"):
 * o resumo se confere com `toContainText` no proprio botao.
 */
export function profileSection(page: Page, title: ProfileSectionTitle): Locator {
  return page.getByRole("main").getByRole("button", { name: new RegExp(`^${title}`) });
}

/**
 * Abre uma secao da ficha (todas comecam fechadas; `?tab=<id>` abre uma no
 * carregamento) e devolve o conteudo dela. Ja aberta, nao fecha.
 */
export async function openProfileSection(page: Page, title: ProfileSectionTitle): Promise<Locator> {
  const button = profileSection(page, title);
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const panelId = await button.getAttribute("aria-controls");
  return page.locator(`[id="${panelId}"]`);
}

/** Cartao de aviso no topo da ficha (atraso, faltas seguidas, pacote acabando, aniversario) pelo titulo. */
export function profileAlert(page: Page, title: string): Locator {
  return page.locator("div.rounded-xl").filter({ has: page.getByText(title, { exact: true }) });
}

/** Marca as boas-vindas do onboarding como respondidas (o modal nao cobre o dashboard). */
export async function skipWelcome(page: Page, org = "org-academia-x"): Promise<void> {
  // A academia do teste tem id real no banco.
  if (org === ACADEMY_ALIAS && academy) org = academy.organizationId;
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ seen: true, dismissed: false, tours: {} })),
    `gestarahub:onboarding:${org}`,
  );
}

/**
 * Botao do seletor de mes ("Escolher mês (Setembro de 2026)"). O leitor de tela
 * junta os trechos com espaco ("Escolher mês ( Setembro de 2026 )"), por isso a regex.
 */
export function monthPicker(page: Page, label: string): Locator {
  return page.getByRole("button", { name: new RegExp(`^Escolher mês \\(\\s*${label}\\s*\\)`) });
}

/**
 * Cobranca em atraso numa linha de Cobrancas: o selo "Atrasado" saiu da lista
 * (10/11/2026) e a data vencida "venceu DD/MM · N dias" fica em vermelho.
 */
export async function expectOverdueRow(row: Locator, due?: string): Promise<void> {
  await expect(row.locator(".text-overdue").filter({ hasText: due ? `venceu ${due}` : "venceu" }).first()).toBeVisible();
}

/**
 * Aba de situacao da lista de Cobrancas ("A receber", "Em atraso", "Pagas",
 * "Isentas e encerradas", "Todas"); o nome traz a contagem ao lado. Substituiu o
 * seletor "Filtrar por situação" (11/11/2026); filtro fino so por `?status=`.
 */
export function statusTab(page: Page, label: string): Locator {
  return page.getByRole("button", { name: new RegExp(`^${label} \\d+$`) });
}

/** A aba de situacao marcada (fundo claro com sombra). */
export async function expectActiveTab(page: Page, label: string): Promise<void> {
  await expect(statusTab(page, label)).toHaveClass(/bg-background/);
}

/** Cartao de indicador do topo (StatCard, 11/11/2026) pelo rotulo. */
export function statCard(page: Page, title: string): Locator {
  return page.locator("div.rounded-xl.shadow-2xs").filter({ has: page.getByText(title, { exact: true }) });
}

/**
 * Abre o menu ⋮ de uma linha ("Ações de {nome}"). Com `followUp`, abre tambem
 * o submenu "Acompanhamento ›" (09/11/2026: registros, graduacao, notas e
 * testes saem da primeira camada nas listas de Alunos, da turma e da chamada;
 * doc 07 §1.4). Submenu com um item so vira o proprio item, sem seta.
 */
export async function openRowMenu(page: Page, name: string, opts: { followUp?: boolean } = {}): Promise<void> {
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  await expect(page.getByRole("menu").first()).toBeVisible();
  if (!opts.followUp) return;
  const trigger = page.getByRole("menuitem", { name: "Acompanhamento", exact: true });
  if ((await trigger.count()) === 0) return;
  await trigger.click();
  await expect(page.getByRole("menu")).toHaveCount(2);
}

/**
 * Escolhe uma acao no menu ⋮ da linha; se ela nao esta na primeira camada,
 * procura dentro de "Acompanhamento ›".
 */
export async function rowMenuAction(page: Page, name: string, item: string | RegExp): Promise<void> {
  await openRowMenu(page, name);
  const target = page.getByRole("menuitem", typeof item === "string" ? { name: item, exact: true } : { name: item });
  if ((await target.count()) === 0) {
    await page.getByRole("menuitem", { name: "Acompanhamento", exact: true }).click();
  }
  await target.click();
}
