import type {
  Appointment,
  Attendance,
  AuditLogEntry,
  Category,
  Charge,
  ClassGroup,
  ClassReservation,
  ClassSessionOverride,
  Client,
  Enrollment,
  Id,
  OperationalModel,
  Organization,
  Plan,
  Professional,
  RecurrenceSeries,
  Role,
  Service,
  TimeBlock,
  Unit,
  User,
  WaitlistEntry,
} from "@gestarahub/contracts";
import { mockConfig } from "./config";
import { createInitialWorld } from "./seed";

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
const SEED_VERSION = 21;

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
