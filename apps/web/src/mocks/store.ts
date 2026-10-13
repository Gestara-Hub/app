import type {
  Appointment,
  Attendance,
  AuditLogEntry,
  Category,
  Charge,
  ClassGroup,
  ClassReservation,
  ClassesBusinessSegment,
  ClassSessionOverride,
  Client,
  Enrollment,
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  Id,
  MessageLog,
  MessageTemplate,
  OnlinePayment,
  OperationalModel,
  Organization,
  OrganizationSettings,
  SubscriptionTier,
  Plan,
  Professional,
  RecurrenceSeries,
  RecurringAuthorization,
  Role,
  Service,
  TeacherPayout,
  TeacherPayRule,
  TimeBlock,
  Unit,
  User,
  WaitlistEntry,
  WhatsAppSession,
} from "@gestarahub/contracts";
import { mockConfig } from "./config";
import {
  createInitialWorld,
  defaultFinancialCategories,
  defaultMessageLogs,
  defaultMessageTemplates,
  defaultWhatsAppSession,
} from "./seed";

/**
 * Store em memoria (interno; a UI NUNCA importa o store, so os services tocam).
 *
 * Multi-tenant: cada organizationId tem a sua propria `MockStore` (dados
 * isolados). O `store` exportado e um PROXY que resolve sempre para o tenant
 * ativo (`world.activeOrganizationId`) — assim os services continuam usando
 * `store.clients`, `store.organization` etc. sem saber que ha varios tenants, e
 * dois tenants nunca vazam dados um no outro. "Um modelo por tenant": cada org
 * carrega o seu `model` (scheduling/classes/delivery).
 *
 * Persistencia: para simular um "banco", o MUNDO inteiro e espelhado no
 * localStorage. Hidrata na 1a carga do modulo (client) e re-grava a cada escrita
 * (via simulateWrite). No servidor (SSR) e no Node (testes) e no-op.
 */
export interface MockStore {
  organization: Organization;
  unit: Unit;
  clients: Client[];
  professionals: Professional[];
  users: User[];
  roles: Role[];
  categories: Category[];
  services: Service[];
  appointments: Appointment[];
  timeBlocks: TimeBlock[];
  series: RecurrenceSeries[];
  // Log de auditoria (append-only): registrado pelos services em cada mutacao.
  auditLog: AuditLogEntry[];
  // Modelo 3 (turmas) — presentes em todos os tenants; vazios exceto no de
  // classes. Sessoes sao geradas on-the-fly dos meetingSlots (nao armazenadas);
  // so a presenca e persistida (por sessionId deterministico).
  classGroups: ClassGroup[];
  enrollments: Enrollment[];
  attendances: Attendance[];
  // Financeiro do M3 (planos + cobrancas).
  plans: Plan[];
  charges: Charge[];
  // M3 Fatia 3: lista de espera e reservas (drop-in).
  waitlist: WaitlistEntry[];
  reservations: ClassReservation[];
  sessionOverrides?: ClassSessionOverride[];
  // Financeiro do negocio (plano pago). Presentes em todos os tenants; as
  // categorias padrao so sao semeadas no de classes. Ver docs/technical/05.
  financialCategories: FinancialCategory[];
  financialEntries: FinancialEntry[];
  financialRecurrences: FinancialRecurrence[];
  teacherPayRules: TeacherPayRule[];
  teacherPayouts: TeacherPayout[];
  onlinePayments: OnlinePayment[];
  recurringAuthorizations: RecurringAuthorization[];
  // Comunicacao e gateway WhatsApp (recurso pago "messaging")
  communicationSession?: WhatsAppSession;
  messageTemplates: MessageTemplate[];
  messageLogs: MessageLog[];
  // Deprecated backward compatibility properties
  cobrancas?: Charge[];
  reservas?: ClassReservation[];
}

/** Mundo multi-tenant: um `MockStore` por organizationId + o tenant ativo. */
export interface MockWorld {
  tenants: Record<Id, MockStore>;
  activeOrganizationId: Id;
}

const STORAGE_KEY = "gestarahub:db";

// Versao do seed. Subir quando a forma/conteudo do seed mudar: dados salvos com
// versao diferente sao descartados e re-seedados (migracao/auto-reset do mock).
// v5: cargo (role) virou entidade Role; Professional.role -> roleId.
// v6: agenda semeada (appointments, timeBlocks, series).
// v7: usuarios (multi-user + RBAC simulado).
// v8: almoco no WorkingHours (breakStart/breakEnd); almoco deixou de ser TimeBlock.
// v9: agendamento/serie com multiplos servicos (serviceId -> serviceIds[]).
// v10: log de auditoria (auditLog[]).
// v11: multi-tenant (MockWorld) + Organization.model (2o tenant classes).
// v12: Modelo 3 (turmas) — classGroups/enrollments/attendances.
// v13: Modelo 3 Fatia 2 (financeiro) — plans/cobrancas + ClassGroup.planId.
// v14: Modelo 3 Fatia 3 — waitlist/reposicoes/reservas + ClassGroup.sessionPriceCents.
// v16: seed "ambiente vazio" — cada tenant nasce so com organizacao/unidade/dono.
// v17: seed enriquecido para Modelo 3 (Academia X com modalidades, alunos, planos e matriculas).
// v18: horario de funcionamento nasce vazio no 1o acesso (onboarding pendente) + regra flexivel (soft-confirm).
// v19: Modelo 3 — unificação de turmas regulares (remoção de enrollmentType do formulário e de PlanPeriod "session" nos planos).
// v20: seed vazio para Barbearia e Academia — apenas os proprietários são criados.
// v21: endereço estruturado + planos/vencimento/desconto no aluno (migração suave sem perda de dados).
// v22: Financeiro (plano pago) — colecoes financeiras, categorias padrao no tenant
//      de classes e organization.subscription (free). Migracao suave.
// v23: Comunicacao (recurso messaging) — sessao WhatsApp, templates de regua e logs.
// v24: Onboarding setup — campos de unidade e endereço da Academia limpos para capturar do setup.
// v25: segmento do Modelo 3 vira `organization.classSegment` (chave unica e renomeada);
//      sai `settings.businessSegments`. Migracao suave.
// v26: bolsa de estudo — desconto de 100% vira bolsa integral e mensalidades
//      de R$ 0 em aberto viram "Isento" (`waived`). Migracao suave.
// v27: faixa etaria por nivel; trilhas de Jiu-Jitsu (modelo bjj_adult) ja
//      salvas ganham as idades da IBJJF/CBJJ nos niveis sem idade. Migracao suave.
// v28: cobrancas canceladas pelo sistema por troca (plano, regra, bolsa) viram
//      "Substituída" (`replaced`), fora do total de canceladas. Migracao suave.
// v29: "pontos a melhorar" (`focusAreas`) do progresso viram metas sem
//      quantidade (`goals`). Migracao suave.
const SEED_VERSION = 29;

interface PersistedBlob {
  v: number;
  data: MockWorld;
}

function canPersist(): boolean {
  return mockConfig.persistence && typeof window !== "undefined";
}

function migrateWorld(data: MockWorld, fromVersion: number): MockWorld {
  if (fromVersion < 21) {
    for (const tenant of Object.values(data.tenants)) {
      if (!tenant.organization.settings) {
        tenant.organization.settings = { defaultDueDay: 10 };
      } else if (!tenant.organization.settings.defaultDueDay) {
        tenant.organization.settings.defaultDueDay = 10;
      }
      for (const client of tenant.clients) {
        if (!client.membershipStatus) {
          client.membershipStatus = client.status === "active" ? "active" : "paused";
        }
        if (!client.dueDay) {
          client.dueDay = 10;
        }
      }
    }
  }
  if (fromVersion < 22) {
    for (const tenant of Object.values(data.tenants)) {
      const t = tenant as Partial<MockStore> & MockStore;
      t.financialCategories = t.financialCategories ?? [];
      t.financialEntries = t.financialEntries ?? [];
      t.financialRecurrences = t.financialRecurrences ?? [];
      t.teacherPayRules = t.teacherPayRules ?? [];
      t.teacherPayouts = t.teacherPayouts ?? [];
      t.onlinePayments = t.onlinePayments ?? [];
      t.recurringAuthorizations = t.recurringAuthorizations ?? [];
      if (!t.organization.subscription) t.organization.subscription = { tier: "free" };
      if (t.organization.model === "classes" && t.financialCategories.length === 0) {
        t.financialCategories = defaultFinancialCategories(t.organization.id);
      }
    }
  }
  if (fromVersion < 23) {
    for (const tenant of Object.values(data.tenants)) {
      const t = tenant as Partial<MockStore> & MockStore;
      if (!t.communicationSession) {
        t.communicationSession = defaultWhatsAppSession(t.organization.id);
      }
      if (!t.messageTemplates || t.messageTemplates.length === 0) {
        t.messageTemplates = defaultMessageTemplates(t.organization.id);
      }
      if (!t.messageLogs || t.messageLogs.length === 0) {
        t.messageLogs = defaultMessageLogs(t.organization.id);
      }
    }
  }
  if (fromVersion < 25) {
    const renamed: Record<string, ClassesBusinessSegment> = {
      martial_arts: "martial_arts",
      fitness_wellness: "pilates_yoga",
      education_courses: "music_languages",
      dance_arts: "dance",
      crossfit_functional: "functional_training",
      aquatics_sports: "swimming_sports",
      custom: "custom",
    };
    for (const tenant of Object.values(data.tenants)) {
      const org = tenant.organization;
      const legacy = org.settings as
        | (OrganizationSettings & { businessSegments?: string[]; customSegmentName?: string })
        | undefined;
      if (!legacy) continue;
      const first = legacy.businessSegments?.[0];
      if (!org.classSegment && first && renamed[first]) org.classSegment = renamed[first];
      if (!org.customSegmentName && legacy.customSegmentName) {
        org.customSegmentName = legacy.customSegmentName;
      }
      delete legacy.businessSegments;
      delete legacy.customSegmentName;
    }
  }
  if (fromVersion < 26) {
    for (const tenant of Object.values(data.tenants)) {
      const fullScholars = new Set<string>();
      for (const client of tenant.clients) {
        const d = client.discount;
        if (d && d.type === "percentage" && d.value >= 100) {
          d.scholarship = true;
          fullScholars.add(client.id);
        }
      }
      for (const charge of tenant.charges) {
        if (charge.kind !== "membership" || charge.amountCents !== 0) continue;
        if (charge.status !== "pending" && charge.status !== "overdue") continue;
        charge.status = "waived";
        if (fullScholars.has(charge.studentId)) {
          charge.scholarshipPercent = 100;
          const plan = tenant.plans.find((p) => p.id === charge.planId);
          if (plan) charge.listAmountCents = plan.priceCents;
        }
      }
    }
  }
  if (fromVersion < 27) {
    const bjjAges: Record<string, { minAge: number; maxAge?: number }> = {
      "lvl-kids-gray": { minAge: 4, maxAge: 15 },
      "lvl-kids-yellow": { minAge: 7, maxAge: 15 },
      "lvl-kids-orange": { minAge: 10, maxAge: 15 },
      "lvl-kids-green": { minAge: 13, maxAge: 15 },
      "lvl-blue": { minAge: 16 },
      "lvl-purple": { minAge: 16 },
      "lvl-brown": { minAge: 18 },
      "lvl-black": { minAge: 19 },
    };
    for (const tenant of Object.values(data.tenants)) {
      for (const category of tenant.categories) {
        const track = category.progressionTrack;
        if (track?.templateKey !== "bjj_adult") continue;
        for (const level of track.levels) {
          const ages = bjjAges[level.id];
          if (!ages || level.minAge !== undefined || level.maxAge !== undefined) continue;
          level.minAge = ages.minAge;
          if (ages.maxAge !== undefined) level.maxAge = ages.maxAge;
        }
      }
    }
  }
  if (fromVersion < 28) {
    const replacedNotes: Record<string, string> = {
      "Cancelada por troca de plano": "Substituída pela troca de plano",
      "Cancelada por troca da regra de cobrança": "Substituída pela troca da regra de cobrança",
      "Cancelada por troca da bolsa": "Substituída pela troca da bolsa",
    };
    for (const tenant of Object.values(data.tenants)) {
      for (const charge of tenant.charges) {
        if (charge.status !== "canceled" || charge.canceledBy !== "system") continue;
        const note = charge.notes ? replacedNotes[charge.notes] : undefined;
        if (!note) continue;
        charge.replaced = true;
        charge.notes = note;
      }
    }
  }
  if (fromVersion < 29) {
    for (const tenant of Object.values(data.tenants)) {
      for (const client of tenant.clients) {
        for (const [modalityId, progression] of Object.entries(client.progressions ?? {})) {
          const legacy = progression as typeof progression & { focusAreas?: string[] };
          if (!legacy.goals) {
            legacy.goals = (legacy.focusAreas ?? []).map((title, index) => ({
              id: `goal-${client.id}-${modalityId}-${index}`,
              title,
              progress: 0,
              createdAt: progression.updatedAt,
            }));
          }
          delete legacy.focusAreas;
        }
      }
    }
  }
  return data;
}

function loadFromStorage(): MockWorld | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedBlob>;
    if (!parsed.data || typeof parsed.v !== "number") return null;
    if (parsed.v < 20) return null; // versões muito antigas reiniciam limpas

    let worldData = parsed.data;
    if (parsed.v < SEED_VERSION) {
      worldData = migrateWorld(worldData, parsed.v);
      saveToStorage(worldData);
    }

    let normalizedPlans = false;
    for (const tenant of Object.values(worldData.tenants)) {
      const t = tenant as Partial<MockStore>;
      t.charges = t.charges || t.cobrancas || [];
      t.reservations = t.reservations || t.reservas || [];
      if (t.plans) {
        for (const plan of t.plans) {
          const cleaned = plan.name
            .replace(/^(Mensal|Quinzenal|Semanal)\s*[-–—:]\s*/i, "")
            .trim();
          if (cleaned && cleaned !== plan.name) {
            plan.name = cleaned;
            normalizedPlans = true;
          }
        }
      }
    }
    if (normalizedPlans) {
      saveToStorage(worldData);
    }
    return worldData;
  } catch {
    return null;
  }
}

function saveToStorage(snapshot: MockWorld): void {
  if (typeof window === "undefined") return;
  try {
    const blob: PersistedBlob = { v: SEED_VERSION, data: snapshot };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // Modo privado / quota excedida: segue apenas em memoria.
  }
}

// Estado-mundo mutavel do modulo (interno). Hidratado do localStorage no browser.
const world: MockWorld = createInitialWorld();

if (canPersist()) {
  const saved = loadFromStorage();
  if (saved && saved.tenants[saved.activeOrganizationId]) {
    world.tenants = saved.tenants;
    world.activeOrganizationId = saved.activeOrganizationId;
  } else {
    saveToStorage(world);
  }
}

function activeStore(): MockStore {
  return world.tenants[world.activeOrganizationId];
}

/**
 * Store do tenant ATIVO. Proxy: os services usam `store.clients` etc. e sempre
 * batem no tenant corrente, sem precisar filtrar por organizationId.
 */
export const store: MockStore = new Proxy({} as MockStore, {
  get(_target, prop) {
    return activeStore()[prop as keyof MockStore];
  },
  set(_target, prop, value) {
    return Reflect.set(activeStore(), prop, value);
  },
  has(_target, prop) {
    return prop in activeStore();
  },
  ownKeys() {
    return Reflect.ownKeys(activeStore());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(activeStore(), prop);
  },
});

/** organizationId do tenant ativo (para os services carimbarem escritas). */
export function currentOrganizationId(): Id {
  return world.activeOrganizationId;
}

/**
 * Todos os tenants do mundo — uso restrito ao login/troca de usuario (demo),
 * que precisa listar usuarios de todas as organizacoes (cross-tenant). O resto
 * do app opera sempre no tenant ativo (via `store`).
 */
export function allTenants(): MockStore[] {
  return Object.values(world.tenants);
}

/**
 * Modelo operacional de uma organizacao (server e client, do mundo semeado/
 * hidratado). Usado pelo shell para renderizar a nav do modelo do tenant.
 */
export function organizationModelById(
  organizationId: Id,
): OperationalModel | undefined {
  return world.tenants[organizationId]?.organization.model;
}

/**
 * Tier do plano GestaraHub de uma organizacao no mundo semeado/hidratado. No
 * server so enxerga o seed (o tier trocado no navegador chega pelo cookie
 * espelho, ver lib/subscription).
 */
export function organizationTierById(organizationId: Id): SubscriptionTier | undefined {
  const org = world.tenants[organizationId]?.organization;
  if (!org) return undefined;
  return org.subscription?.tier ?? "free";
}

/** Indica se a organizacao ja concluiu a etapa de setup inicial (onboarding). */
export function isOnboardingCompletedById(organizationId: Id): boolean {
  return Boolean(world.tenants[organizationId]?.organization.settings?.onboardingCompleted);
}

/**
 * Troca o tenant ativo (segue o usuario logado). Chamado pela camada de sessao.
 * No-op se o org nao existe no mundo ou ja e o ativo.
 */
export function setActiveOrganization(organizationId: Id): void {
  if (
    world.tenants[organizationId] &&
    world.activeOrganizationId !== organizationId
  ) {
    world.activeOrganizationId = organizationId;
    if (canPersist()) saveToStorage(world);
  }
}

/** Grava o estado atual do mundo (chamado pelos writes via simulateWrite). */
export function persist(): void {
  if (canPersist()) saveToStorage(world);
}

/**
 * Reseta o localStorage completo e reinicializa os mocks deixando apenas
 * os proprietários da Barbearia (Corte Nobre) e da Academia (Academia X).
 */
export function resetStore(): void {
  const fresh = createInitialWorld();
  const currentActive = world.activeOrganizationId;
  world.tenants = fresh.tenants;
  world.activeOrganizationId = fresh.tenants[currentActive]
    ? currentActive
    : fresh.activeOrganizationId;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.clear();
    } catch {
      // Ignora falha de localStorage (ex: privado/sandbox)
    }
  }

  if (canPersist()) saveToStorage(world);
}

/** Esvazia os mocks mantendo apenas os proprietários (alias para resetStore). */
export function clearStore(): void {
  resetStore();
}
