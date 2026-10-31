import type { Page } from "@playwright/test";
import { BASE_URL, academyJson, expect, hasAcademy, loginAsAcademyUser, readAcademy } from "./fixtures";
import { sessionCookieValue } from "./session-cookie";

/**
 * Construtores e atalhos dos testes da ficha do aluno, das notas, da evolucao
 * por area e das permissoes. Hoje e terca 22/09/2026 (relogio fixo).
 */

export const TS = "2026-09-01T12:00:00.000Z";
/** Nascido em 10/05/1990: 36 anos hoje (adulto). */
export const ADULT = "1990-05-10";
export const ORG = "org-academia-x";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tenant = Record<string, any>;

export function modality(id: string, name: string, position: number, over: Record<string, unknown> = {}) {
  return { id, organizationId: ORG, name, position, status: "active", createdAt: TS, updatedAt: TS, ...over };
}

/** Progresso salvo do aluno numa modalidade. */
export function progression(
  modalityId: string,
  modalityName: string,
  levelId: string,
  levelName: string,
  over: Record<string, unknown> = {},
) {
  return {
    modalityId,
    modalityName,
    levelId,
    levelName,
    subLevel: 0,
    maxSubLevels: 0,
    promotedAt: "2026-03-01",
    strengths: [],
    goals: [],
    evaluations: [],
    promotionHistory: [],
    updatedAt: TS,
    ...over,
  };
}

/** Faixa Branca de Jiu-Jitsu (trilha inferida pelo nome). */
export const jjWhite = (over: Record<string, unknown> = {}) =>
  progression("m-jj", "Jiu-Jitsu", "lvl-white", "Faixa Branca", { levelColor: "white", maxSubLevels: 4, ...over });

const track = (templateKey: string, levels: { id: string; name: string }[]) => ({
  enabled: true,
  style: "levels",
  templateKey,
  criteriaType: "attendance",
  targetAttendances: 24,
  targetMonths: 6,
  levels: levels.map((l) => ({ ...l, maxSubLevels: 0 })),
});

/** Niveis gerais (Iniciante, Intermediario, Avancado). */
export const LEVELS_TRACK = track("general_levels", [
  { id: "lvl-gen-beg", name: "Iniciante" },
  { id: "lvl-gen-int", name: "Intermediário" },
  { id: "lvl-gen-adv", name: "Avançado" },
]);

/** Modulos (musica, idiomas). */
export const MODULES_TRACK = track("modules", [
  { id: "lvl-mod-basic", name: "Módulo Básico" },
  { id: "lvl-mod-pre", name: "Módulo Pré-intermediário" },
  { id: "lvl-mod-int", name: "Módulo Intermediário" },
]);

/** Fases (natacao). */
export const STAGES_TRACK = track("swim_stages", [
  { id: "lvl-swim-adapt", name: "Adaptação" },
  { id: "lvl-swim-init", name: "Iniciação" },
  { id: "lvl-swim-improve", name: "Aperfeiçoamento" },
]);

/** Avaliacoes ligadas na modalidade. */
export function gradedSettings(
  scale: "zero_ten" | "zero_hundred" | "concept" | "pass_fail" = "zero_ten",
  passingGrade?: number | string,
) {
  const defaults = { zero_ten: 6, zero_hundred: 60, concept: "C", pass_fail: "pass" } as const;
  return { enabled: true, scale, passingGrade: passingGrade ?? defaults[scale] };
}

/** Avaliacao da turma gravada direto no mundo do mock. */
export function assessment(
  id: string,
  classGroupId: string,
  modalityId: string,
  name: string,
  over: Record<string, unknown> = {},
) {
  return {
    id,
    organizationId: ORG,
    classGroupId,
    modalityId,
    name,
    date: "2026-09-15",
    weight: 1,
    grades: [],
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

/** Nota de um aluno (embutida na avaliacao). */
export function grade(studentId: string, value: number | string | undefined, status = "graded") {
  return {
    studentId,
    status,
    ...(value === undefined ? {} : { value }),
    updatedAt: TS,
    updatedBy: "usr-ac-ana",
  };
}

/** Usuario do espaco (gerente, atendente ou professor). */
export function user(
  id: string,
  name: string,
  profile: "owner" | "manager" | "attendant" | "professional",
  over: Record<string, unknown> = {},
) {
  return {
    id,
    organizationId: ORG,
    name,
    email: `${id}@academiax.com`,
    profile,
    status: "active",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

/**
 * Entra como outro usuario do espaco: grava o cookie com as mesmas claims do
 * registro (o app compara e, se diferirem, regrava a sessao). O mundo ja deve
 * ter esse usuario (`t.users`).
 */
export async function loginAsUser(
  page: Page,
  u: ReturnType<typeof user>,
  professional?: { id: string; name: string },
): Promise<void> {
  if (hasAcademy()) {
    // Academia no banco: o usuario do cenario ganha uma conta de verdade
    // (Supabase Auth), mantendo o id que o cenario usa.
    const professionalId = professional?.id ?? (u as { professionalId?: string }).professionalId;
    await loginAsAcademyUser(page, u.profile, u.name, professionalId, u.id);
    return;
  }
  const claims = {
    ...u,
    ...(professional ? { professional: { ...professional, status: "active" } } : {}),
  };
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

/** Sem o destaque "Lista ou cards" (aparece uma vez com 3+ alunos e cobre a tela). */
export async function skipClientsCoachmark(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
}

/** Espera o app gravar o mundo (senao o goto seguinte perde a escrita). */
export async function waitForStore(page: Page, predicate: (raw: string) => boolean): Promise<void> {
  await expect
    .poll(async () => predicate(await academyJson()))
    .toBe(true);
}

/** Le um campo do tenant da academia no mundo gravado. */
export async function tenantField<T>(page: Page, field: string): Promise<T> {
  void page;
  return (await readAcademy())[field] as T;
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

/** Linha inteira de uma lista (`ListRow`/card) que contem o texto. */
export const rowOf = (page: Page, text: string) => page.locator("div.group").filter({ hasText: text });
