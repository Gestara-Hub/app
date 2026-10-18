import type {
  Appointment,
  Assessment,
  Attendance,
  AuditLogEntry,
  Category,
  CertificateTemplate,
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
  LessonPackage,
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
  StudentPackage,
  TeacherPayout,
  TeacherPayRule,
  TimeBlock,
  Unit,
  User,
  WaitlistEntry,
  WhatsAppConnection,
} from "@gestarahub/contracts";
import { mockConfig } from "./config";
import {
  createInitialWorld,
  defaultFinancialCategories,
  defaultMessageTemplates,
  defaultSystemFinancialCategory,
  defaultWhatsAppConnection,
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
  // Pacotes de aulas (doc 20, fase C): catalogo e compras dos alunos.
  lessonPackages: LessonPackage[];
  studentPackages: StudentPackage[];
  // M3 Fatia 3: lista de espera e reservas (drop-in).
  waitlist: WaitlistEntry[];
  reservations: ClassReservation[];
  sessionOverrides?: ClassSessionOverride[];
  // Avaliacoes e notas (doc 21 §2.1). Opcional: nasce vazio no 1o lancamento,
  // sem migracao (ver gradesService.assessmentsStore).
  assessments?: Assessment[];
  // Financeiro do negocio (plano pago). Presentes em todos os tenants; as
  // categorias padrao so sao semeadas no de classes. Ver docs/technical/05.
  financialCategories: FinancialCategory[];
  financialEntries: FinancialEntry[];
  financialRecurrences: FinancialRecurrence[];
  teacherPayRules: TeacherPayRule[];
  teacherPayouts: TeacherPayout[];
  onlinePayments: OnlinePayment[];
  recurringAuthorizations: RecurringAuthorization[];
  // Comunicacao: WhatsApp do proprio espaco (assistido gratis; oficial no Pro)
  whatsAppConnection?: WhatsAppConnection;
  messageTemplates: MessageTemplate[];
  messageLogs: MessageLog[];
  // Modelo de certificado do espaco (Plano Pro). Ausente = modelo padrao.
  certificateTemplate?: CertificateTemplate;
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
// v30: WhatsApp com o numero do proprio espaco: a sessao simulada por QR code
//      (`communicationSession`) vira `whatsAppConnection` (assistido; conexao
//      oficial desligada), saem as mensagens ficticias do seed antigo e o
//      "Sentimos sua falta" passa a ser por 3 faltas seguidas. Migracao suave.
// v31: modelos de mensagem criados antes da area ganham o texto da propria area.
// v32: "Música & Idiomas" (`music_languages`) se divide em `music` e
//      `languages` (escolhido pelos nomes das modalidades). Migracao suave.
// v33: cobranca avulsa (`ChargeKind` "extra"): tenants com categorias
//      financeiras ganham a categoria de sistema "Cobranças avulsas". Migracao suave.
// v34: curso fechado (`ChargeKind` "course"): tenants com categorias
//      financeiras ganham a categoria de sistema "Cursos". Migracao suave.
// v35: pacote de aulas (`ChargeKind` "package"): colecoes `lessonPackages` e
//      `studentPackages` e, nos tenants com categorias financeiras, a categoria
//      de sistema "Pacotes de aulas". Migracao suave.
// v36: modelos de WhatsApp "Lembrete de cobrança" (`charge_reminder`) e
//      "Pacote acabando" (`package_ending`), com o texto da area do espaco,
//      para quem ainda nao tem. Migracao suave.
// v37: modelos de WhatsApp so de envio manual (pagamento recebido, parabens
//      pelo avanco, aula cancelada, mudanca de horario e feriado), com o texto
//      da area do espaco, para quem ainda nao tem. Migracao suave.
const SEED_VERSION = 37;

/** Nomes de modalidade que indicam escola de idiomas ou reforco (v32). */
const LANGUAGE_MODALITY_PATTERN = /ingl|espanh|franc|idioma|alem|italian|japon|libras|refor|portugu|redaç/i;

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
      if (!t.whatsAppConnection) {
        t.whatsAppConnection = defaultWhatsAppConnection(t.organization.id);
      }
      if (!t.messageTemplates || t.messageTemplates.length === 0) {
        t.messageTemplates = defaultMessageTemplates(t.organization.id);
      }
      if (!t.messageLogs) t.messageLogs = [];
    }
  }
  if (fromVersion < 25) {
    // `music_languages` nao existe mais: a v32 logo abaixo escolhe music ou languages.
    const renamed: Record<string, string> = {
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
      if (!org.classSegment && first && renamed[first]) {
        org.classSegment = renamed[first] as ClassesBusinessSegment;
      }
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
  if (fromVersion < 30) {
    for (const tenant of Object.values(data.tenants)) {
      const orgId = tenant.organization.id;
      const legacy = tenant as MockStore & {
        communicationSession?: { allowedSendHours?: WhatsAppConnection["allowedSendHours"]; monthlyQuota?: { included?: number } };
      };
      const base = defaultWhatsAppConnection(orgId);
      tenant.whatsAppConnection = {
        ...base,
        allowedSendHours: legacy.communicationSession?.allowedSendHours ?? base.allowedSendHours,
        monthlyQuota: { used: 0, included: legacy.communicationSession?.monthlyQuota?.included ?? base.monthlyQuota.included },
      };
      delete legacy.communicationSession;
      const fakeIds = new Set(Array.from({ length: 20 }, (_, i) => `msg-${orgId}-${i + 1}`));
      tenant.messageLogs = (tenant.messageLogs ?? []).filter((log) => !fakeIds.has(log.id));
      for (const template of tenant.messageTemplates ?? []) {
        if (template.trigger === "absence_alert" && template.daysOffset === 14) {
          template.daysOffset = 3;
          template.description = "Para alunos com 3 faltas seguidas";
        }
      }
    }
  }
  if (fromVersion < 31) {
    // Modelos criados antes da area (v23) nasceram com o texto de lutas
    // ("tatame", "treinos"). Quem nao e de lutas e nao editou o texto recebe
    // o padrao da propria area.
    for (const tenant of Object.values(data.tenants)) {
      const segment = tenant.organization.classSegment;
      if (!segment || segment === "martial_arts") continue;
      const orgId = tenant.organization.id;
      const martial = new Map(defaultMessageTemplates(orgId).map((t) => [t.trigger, t.content]));
      const own = new Map(defaultMessageTemplates(orgId, segment).map((t) => [t.trigger, t.content]));
      for (const template of tenant.messageTemplates ?? []) {
        const next = own.get(template.trigger);
        if (next && template.content === martial.get(template.trigger)) template.content = next;
      }
    }
  }
  if (fromVersion < 32) {
    for (const tenant of Object.values(data.tenants)) {
      const org = tenant.organization;
      if ((org.classSegment as string | undefined) !== "music_languages") continue;
      const teachesLanguages = (tenant.categories ?? []).some((c) =>
        LANGUAGE_MODALITY_PATTERN.test(c.name),
      );
      org.classSegment = teachesLanguages ? "languages" : "music";
      // Rotulo antigo gravado pelo setup acompanha a nova area.
      if (org.segment === "Música & Idiomas") {
        org.segment = teachesLanguages ? "Idiomas e reforço" : "Música";
      }
    }
  }
  if (fromVersion < 33) {
    // So tenants que ja tem as categorias padrao (os de turmas): quem nao tem
    // nenhuma segue sem (o Financeiro usa o id deterministico como fallback).
    for (const tenant of Object.values(data.tenants)) {
      const categories = tenant.financialCategories ?? [];
      if (categories.length === 0) continue;
      if (categories.some((c) => c.systemKey === "extras")) continue;
      const extras = defaultSystemFinancialCategory(tenant.organization.id, "extras");
      if (extras) categories.push(extras);
    }
  }
  if (fromVersion < 34) {
    // Mesmo criterio da v33: so quem ja tem as categorias padrao.
    for (const tenant of Object.values(data.tenants)) {
      const categories = tenant.financialCategories ?? [];
      if (categories.length === 0) continue;
      if (categories.some((c) => c.systemKey === "courses")) continue;
      const courses = defaultSystemFinancialCategory(tenant.organization.id, "courses");
      if (courses) categories.push(courses);
    }
  }
  if (fromVersion < 35) {
    for (const tenant of Object.values(data.tenants)) {
      const t = tenant as Partial<MockStore> & MockStore;
      t.lessonPackages = t.lessonPackages ?? [];
      t.studentPackages = t.studentPackages ?? [];
      // Mesmo criterio da v33: so quem ja tem as categorias padrao.
      const categories = t.financialCategories ?? [];
      if (categories.length === 0) continue;
      if (categories.some((c) => c.systemKey === "packages")) continue;
      const packages = defaultSystemFinancialCategory(t.organization.id, "packages");
      if (packages) categories.push(packages);
    }
  }
  if (fromVersion < 36) {
    // So quem ja tem modelos: lista vazia e recriada inteira na leitura.
    const added: MessageTemplate["trigger"][] = ["charge_reminder", "package_ending"];
    for (const tenant of Object.values(data.tenants)) {
      const templates = tenant.messageTemplates ?? [];
      if (templates.length === 0) continue;
      const defaults = defaultMessageTemplates(tenant.organization.id, tenant.organization.classSegment);
      for (const trigger of added) {
        if (templates.some((t) => t.trigger === trigger)) continue;
        const template = defaults.find((t) => t.trigger === trigger);
        if (template) templates.push(template);
      }
    }
  }
  if (fromVersion < 37) {
    // Mesmo criterio da v36: so quem ja tem modelos.
    const added: MessageTemplate["trigger"][] = [
      "payment_received",
      "level_up",
      "class_canceled",
      "schedule_change",
      "holiday_notice",
    ];
    for (const tenant of Object.values(data.tenants)) {
      const templates = tenant.messageTemplates ?? [];
      if (templates.length === 0) continue;
      const defaults = defaultMessageTemplates(tenant.organization.id, tenant.organization.classSegment);
      for (const trigger of added) {
        if (templates.some((t) => t.trigger === trigger)) continue;
        const template = defaults.find((t) => t.trigger === trigger);
        if (template) templates.push(template);
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
