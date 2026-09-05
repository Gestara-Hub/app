import type {
  Appointment,
  Attendance,
  AuditLogEntry,
  Category,
  ClassGroup,
  Client,
  Cobranca,
  Enrollment,
  Id,
  OperationalModel,
  Organization,
  Plano,
  Professional,
  RecurrenceSeries,
  Reposicao,
  Reserva,
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
  // Financeiro do M3 (planos + mensalidades/cobrancas).
  plans: Plano[];
  cobrancas: Cobranca[];
  // M3 Fatia 3: lista de espera, reposicoes e reservas (drop-in).
  waitlist: WaitlistEntry[];
  reposicoes: Reposicao[];
  reservas: Reserva[];
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
// v15: seed "ambiente vazio" — cada tenant nasce so com organizacao/unidade/dono.
const SEED_VERSION = 16;

interface PersistedBlob {
  v: number;
  data: MockWorld;
}

function canPersist(): boolean {
  return mockConfig.persistence && typeof window !== "undefined";
}

function loadFromStorage(): MockWorld | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedBlob>;
    if (parsed.v !== SEED_VERSION || !parsed.data) return null;
    return parsed.data;
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

/** Reseta o mundo inteiro ao seed e re-grava no localStorage. */
export function resetStore(): void {
  const fresh = createInitialWorld();
  world.tenants = fresh.tenants;
  world.activeOrganizationId = fresh.activeOrganizationId;
  if (canPersist()) saveToStorage(world);
}

/**
 * Esvazia o tenant ATIVO para simular a configuracao inicial (onboarding):
 * mantem organizacao, unidade e apenas o usuario Proprietario (owner). Todo o
 * resto e limpo, para cadastrar do zero. Re-grava no localStorage.
 */
export function clearStore(): void {
  const base = createInitialWorld().tenants[world.activeOrganizationId];
  if (!base) return;
  const owner = base.users.find((u) => u.profile === "owner");
  // No setup inicial ainda nao ha equipe: remove o vinculo do Proprietario com
  // um profissional para nao deixar uma referencia pendurada.
  if (owner) delete owner.professionalId;
  world.tenants[world.activeOrganizationId] = {
    organization: base.organization,
    unit: base.unit,
    clients: [],
    professionals: [],
    users: owner ? [owner] : base.users,
    roles: [],
    categories: [],
    services: [],
    appointments: [],
    timeBlocks: [],
    series: [],
    auditLog: [],
    classGroups: [],
    enrollments: [],
    attendances: [],
    plans: [],
    cobrancas: [],
    waitlist: [],
    reposicoes: [],
    reservas: [],
  };
  if (canPersist()) saveToStorage(world);
}
