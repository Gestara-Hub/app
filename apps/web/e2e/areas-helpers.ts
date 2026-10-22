import type { Page } from "@playwright/test";
import { editWorld, expect, loginAs, readAcademy, setSessionCookie, skipWelcome } from "./fixtures";

/**
 * Apoio dos testes por area do espaco (areas-setup, areas-settings e o
 * mobile-areas). Nao tem testes: so dados esperados por area e montagem do
 * mundo do mock.
 */

export const ORG = "org-academia-x";
export const TS = "2026-09-01T12:00:00.000Z";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tenant = Record<string, any>;

export type BillingMode = "membership" | "course" | "package" | "free";

/** Trilha esperada de uma modalidade criada no setup (`null` = sem trilha). */
export type ExpectedTrack = { templateKey: string; style: "belt" | "levels" } | null;

export interface AreaSpec {
  id: string;
  label: string;
  /** Linha de confirmacao do passo 2. */
  confirmation: string;
  /** Todas as pilulas do passo 3 (as 2 primeiras ja vem marcadas). */
  modalities: string[];
  /** Trilha das 2 modalidades marcadas por padrao. */
  tracks: Record<string, ExpectedTrack>;
  assessments: boolean;
  billing: BillingMode;
  capacity: number;
  durationMinutes: number;
}

const BELTS = "Seus alunos avançam por faixas e graus. Dá para trocar depois.";
const LEVELS = "Seus alunos avançam por níveis. Dá para trocar depois.";
const MODULES = "Seus alunos avançam por módulos. Dá para trocar depois.";
const STAGES = "Seus alunos avançam por fases. Dá para trocar depois.";
const NONE = "Sem etapas de evolução por enquanto. Dá para ligar depois.";

const levels = { templateKey: "general_levels", style: "levels" } as const;
const modules = { templateKey: "modules", style: "levels" } as const;

/** As 10 areas da lista, na ordem do setup. */
export const AREAS: AreaSpec[] = [
  {
    id: "martial_arts",
    label: "Lutas",
    confirmation: BELTS,
    modalities: ["Jiu-Jitsu", "Muay Thai", "Boxe", "Judô", "No-Gi / Submission"],
    tracks: {
      "Jiu-Jitsu": { templateKey: "bjj_adult", style: "belt" },
      "Muay Thai": { templateKey: "muay_thai", style: "belt" },
    },
    assessments: false,
    billing: "membership",
    capacity: 20,
    durationMinutes: 60,
  },
  {
    id: "pilates_yoga",
    label: "Pilates e yoga",
    confirmation: NONE,
    modalities: ["Pilates Reformer", "Pilates Solo", "Yoga", "Studio VIP"],
    tracks: { "Pilates Reformer": null, "Pilates Solo": null },
    assessments: false,
    billing: "membership",
    capacity: 6,
    durationMinutes: 50,
  },
  {
    id: "functional_training",
    label: "Funcional e crossfit",
    confirmation: NONE,
    modalities: ["CrossFit", "Treino Funcional", "HIIT e cardio", "Calistenia"],
    tracks: { CrossFit: null, "Treino Funcional": null },
    assessments: false,
    billing: "membership",
    capacity: 15,
    durationMinutes: 60,
  },
  {
    id: "dance",
    label: "Dança",
    confirmation: LEVELS,
    modalities: ["Balé clássico", "Dança de Salão", "Ritmos", "Jazz"],
    tracks: { "Balé clássico": levels, "Dança de Salão": levels },
    assessments: false,
    billing: "membership",
    capacity: 15,
    durationMinutes: 60,
  },
  {
    id: "music",
    label: "Música",
    confirmation: MODULES,
    modalities: ["Violão", "Piano e teclado", "Canto", "Bateria"],
    tracks: { Violão: modules, "Piano e teclado": modules },
    assessments: true,
    billing: "membership",
    capacity: 6,
    durationMinutes: 60,
  },
  {
    id: "languages",
    label: "Idiomas e reforço",
    confirmation: LEVELS,
    modalities: ["Inglês", "Espanhol", "Reforço escolar"],
    tracks: { Inglês: levels, Espanhol: levels },
    assessments: true,
    billing: "membership",
    capacity: 10,
    durationMinutes: 60,
  },
  {
    id: "swimming_sports",
    label: "Natação e esportes",
    confirmation: STAGES,
    modalities: ["Natação Infantil", "Natação Adulto", "Hidroginástica", "Beach Tennis"],
    tracks: {
      "Natação Infantil": { templateKey: "swim_stages", style: "levels" },
      "Natação Adulto": { templateKey: "swim_stages", style: "levels" },
    },
    assessments: false,
    billing: "membership",
    capacity: 8,
    durationMinutes: 45,
  },
  {
    id: "gastronomy",
    label: "Gastronomia",
    confirmation: MODULES,
    modalities: ["Confeitaria", "Panificação", "Culinária", "Chocolateria"],
    tracks: { Confeitaria: modules, Panificação: modules },
    assessments: false,
    billing: "course",
    capacity: 12,
    durationMinutes: 120,
  },
  {
    id: "arts_crafts",
    label: "Artes e artesanato",
    confirmation: MODULES,
    modalities: ["Cerâmica", "Desenho e pintura", "Costura", "Crochê e tricô"],
    tracks: { Cerâmica: modules, "Desenho e pintura": modules },
    assessments: false,
    billing: "course",
    capacity: 10,
    durationMinutes: 120,
  },
  {
    id: "beauty_courses",
    label: "Beleza e cursos livres",
    confirmation: MODULES,
    modalities: ["Maquiagem", "Design de sobrancelha", "Manicure", "Oratória"],
    tracks: { Maquiagem: modules, "Design de sobrancelha": modules },
    assessments: true,
    billing: "course",
    capacity: 12,
    durationMinutes: 120,
  },
];

/** "Outra área": as 4 trilhas e as 4 formas de cobrar. */
export const CUSTOM_PROGRESSIONS = [
  { value: "belts", label: "Faixas", track: { templateKey: "judo_karate", style: "belt" } },
  { value: "levels", label: "Níveis", track: levels },
  { value: "modules", label: "Módulos", track: modules },
  { value: "none", label: "Não avançam", track: null },
] as const;

export const CUSTOM_BILLINGS = [
  { value: "membership", label: "Mensalidade" },
  { value: "course", label: "Curso com valor fechado" },
  { value: "package", label: "Pacote de aulas" },
  { value: "free", label: "Não cobro" },
] as const;

/** Opcao "Cobrança" da nova turma para cada forma. */
export const CLASS_BILLING_LABEL: Record<BillingMode, string> = {
  membership: "Mensalidade",
  course: "Curso com valor fechado",
  package: "Pacote de aulas",
  free: "Sem cobrança",
};

/** Passos do checklist de primeiros passos por forma de cobranca da area. */
export const CHECKLIST: Record<BillingMode, { steps: string[]; absent: string[]; phase1: string }> = {
  membership: {
    steps: [
      "Definir horário de funcionamento",
      "Definir regras da mensalidade",
      "Cadastrar modalidades",
      "Criar planos ou pacotes",
      "Cadastrar professores e instrutores",
      "Cadastrar alunos",
      "Criar a primeira turma",
    ],
    absent: ["Criar planos de mensalidade", "Criar o primeiro curso", "Matricular alunos no curso", "Criar um pacote de aulas"],
    phase1: "Horário de funcionamento, regras da mensalidade, modalidades e planos ou pacotes.",
  },
  course: {
    steps: [
      "Definir horário de funcionamento",
      "Cadastrar modalidades",
      "Cadastrar professores e instrutores",
      "Cadastrar alunos",
      "Criar o primeiro curso",
      "Matricular alunos no curso",
    ],
    absent: [
      "Definir regras da mensalidade",
      "Criar planos de mensalidade",
      "Criar planos ou pacotes",
      "Criar um pacote de aulas",
      "Criar a primeira turma",
    ],
    phase1: "Horário de funcionamento e modalidades.",
  },
  package: {
    steps: [
      "Definir horário de funcionamento",
      "Cadastrar modalidades",
      "Criar um pacote de aulas",
      "Cadastrar professores e instrutores",
      "Cadastrar alunos",
      "Criar a primeira turma",
    ],
    absent: [
      "Definir regras da mensalidade",
      "Criar planos de mensalidade",
      "Criar planos ou pacotes",
      "Criar o primeiro curso",
      "Matricular alunos no curso",
    ],
    phase1: "Horário de funcionamento, modalidades e pacotes.",
  },
  free: {
    steps: [
      "Definir horário de funcionamento",
      "Cadastrar modalidades",
      "Cadastrar professores e instrutores",
      "Cadastrar alunos",
      "Criar a primeira turma",
    ],
    absent: [
      "Definir regras da mensalidade",
      "Criar planos de mensalidade",
      "Criar planos ou pacotes",
      "Criar um pacote de aulas",
      "Criar o primeiro curso",
      "Matricular alunos no curso",
    ],
    phase1: "Horário de funcionamento e modalidades.",
  },
};

/** Texto do card "Ir para os primeiros passos" das boas-vindas. */
export const WELCOME_SETUP: Record<BillingMode, string> = {
  membership: "Siga o checklist no seu ritmo para definir horários de funcionamento, planos ou pacotes e turmas.",
  course: "Siga o checklist no seu ritmo para definir horários de funcionamento, cursos e matrículas.",
  package: "Siga o checklist no seu ritmo para definir horários de funcionamento, pacotes e turmas.",
  free: "Siga o checklist no seu ritmo para definir horários de funcionamento, modalidades e turmas.",
};

/** Colecoes do tenant que os testes zeram para partir de um espaco vazio. */
const COLLECTIONS = [
  "clients",
  "professionals",
  "categories",
  "appointments",
  "timeBlocks",
  "series",
  "classGroups",
  "enrollments",
  "attendances",
  "plans",
  "charges",
  "lessonPackages",
  "studentPackages",
  "waitlist",
  "reservations",
  "sessionOverrides",
  "assessments",
  "financialEntries",
  "financialRecurrences",
  "teacherPayRules",
  "teacherPayouts",
  "onlinePayments",
  "recurringAuthorizations",
  "messageLogs",
];

function emptyTenant(t: Tenant) {
  for (const key of COLLECTIONS) t[key] = [];
  delete t.certificateTemplate;
  delete t.organization.classSegment;
  delete t.organization.customSegmentName;
  delete t.organization.customSegmentProgression;
  delete t.organization.customSegmentBilling;
  t.unit.businessHours = [];
}

/** Le o tenant da academia gravado no localStorage. */
export async function readTenant(page: Page): Promise<Tenant> {
  void page;
  return (await readAcademy()) as Tenant;
}

/** Espera o app gravar o mundo (senao o goto seguinte perde a escrita). */
export async function waitForStore(page: Page, predicate: (t: Tenant) => boolean) {
  await expect.poll(async () => predicate(await readTenant(page)), { timeout: 10_000 }).toBe(true);
}

/**
 * Espaco vazio (sem alunos, turmas, modalidades nem horario) que ainda nao fez
 * a configuracao inicial: abre o assistente em /setup.
 */
export async function freshTenant(page: Page): Promise<void> {
  await setSessionCookie(page, "Ana Ribeiro", { onboardingCompleted: false, modalitiesReviewed: false });
  await page.goto("/setup");
  await editWorld(page, ORG, (t) => {
    emptyTenant(t);
    t.organization.settings = {};
  });
  await expect(page.getByRole("heading", { name: "Como se chama o seu espaço?" })).toBeVisible();
}

const openDay = (weekday: number) => ({
  weekday,
  closed: false,
  start: "06:00",
  end: "22:00",
  shifts: [{ start: "06:00", end: "22:00" }],
});

export const OPEN_HOURS = [{ weekday: 0, closed: true, shifts: [] }, ...[1, 2, 3, 4, 5, 6].map(openDay)];

export function modality(id: string, name: string, over: Record<string, unknown> = {}) {
  return { id, organizationId: ORG, name, position: 0, status: "active", createdAt: TS, updatedAt: TS, ...over };
}

export function professional(modalityIds: string[]) {
  return {
    id: "pr-1",
    organizationId: ORG,
    unitId: "unit-academia-x",
    name: "Carlos Silva",
    modalityIds,
    serviceIds: [],
    workingHours: [],
    status: "active",
    createdAt: TS,
    updatedAt: TS,
  };
}

/** Aluno sem plano (curso, pacote ou turma gratuita). */
export function planlessStudent(id: string, name: string) {
  return {
    id,
    organizationId: ORG,
    name,
    phone: "11977770000",
    status: "active",
    createdAt: TS,
    updatedAt: TS,
  };
}

export function lessonPackage(id: string, name: string) {
  return {
    id,
    organizationId: ORG,
    name,
    lessons: 10,
    priceCents: 50000,
    validityDays: 90,
    modalityIds: [],
    absenceConsumes: true,
    status: "active",
    createdAt: TS,
    updatedAt: TS,
  };
}

export function monthlyPlan() {
  return { id: "p-m", organizationId: ORG, name: "Mensal", priceCents: 15000, period: "monthly", status: "active", createdAt: TS, updatedAt: TS };
}

export interface ReadyOptions {
  segment: string;
  customProgression?: string;
  customBilling?: BillingMode;
  /** Ajustes finais do tenant (alunos, planos, pacotes...). */
  extra?: (t: Tenant) => void;
}

/**
 * Espaco ja configurado (setup concluido) numa area, sem dados: so a
 * organizacao e a unidade. `extra` acrescenta o que o cenario precisa.
 */
export async function readyTenant(page: Page, opts: ReadyOptions): Promise<void> {
  await loginAs(page, "Ana Ribeiro");
  await editWorld(page, ORG, (t) => {
    emptyTenant(t);
    t.organization.settings = { onboardingCompleted: true, modalitiesReviewed: true };
    t.organization.classSegment = opts.segment;
    if (opts.segment === "custom") {
      t.organization.customSegmentName = "Xadrez";
      t.organization.segment = "Xadrez";
      t.organization.customSegmentProgression = opts.customProgression ?? "none";
      t.organization.customSegmentBilling = opts.customBilling ?? "membership";
    }
    opts.extra?.(t);
  });
}

/** Marca as boas-vindas como vistas (o modal nao cobre a tela). */
export async function skipWelcomeDialog(page: Page): Promise<void> {
  await skipWelcome(page);
}
