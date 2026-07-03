import type {
  Appointment,
  Category,
  Client,
  Organization,
  Professional,
  RecurrenceSeries,
  Role,
  Service,
  TimeBlock,
  Unit,
  User,
} from "@gestarahub/contracts";
import { mockConfig } from "./config";
import { createInitialStore } from "./seed";

/**
 * Store em memoria (interno; a UI NUNCA importa o store, so os services tocam).
 *
 * Persistencia: para simular um "banco", o estado e espelhado no localStorage
 * do navegador. Hidrata na 1a carga do modulo (client) e re-grava a cada escrita
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
}

const STORAGE_KEY = "gestarahub:db";

// Versao do seed. Subir quando a forma/conteudo do seed mudar: dados salvos com
// versao diferente sao descartados e re-seedados (migracao/auto-reset do mock).
// v5: cargo (role) virou entidade Role; Professional.role -> roleId.
// v6: agenda semeada (appointments, timeBlocks, series).
// v7: usuarios (multi-user + RBAC simulado).
// v8: almoco no WorkingHours (breakStart/breakEnd); almoco deixou de ser TimeBlock.
// v9: agendamento/serie com multiplos servicos (serviceId -> serviceIds[]).
const SEED_VERSION = 9;

interface PersistedBlob {
  v: number;
  data: MockStore;
}

function canPersist(): boolean {
  return mockConfig.persistence && typeof window !== "undefined";
}

function loadFromStorage(): MockStore | null {
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

function saveToStorage(snapshot: MockStore): void {
  if (typeof window === "undefined") return;
  try {
    const blob: PersistedBlob = { v: SEED_VERSION, data: snapshot };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // Modo privado / quota excedida: segue apenas em memoria.
  }
}

export const store: MockStore = createInitialStore();

// Hidrata do localStorage na 1a carga do modulo no browser.
if (canPersist()) {
  const saved = loadFromStorage();
  if (saved) {
    Object.assign(store, saved);
  } else {
    saveToStorage(store);
  }
}

/** Grava o estado atual do store (chamado pelos writes via simulateWrite). */
export function persist(): void {
  if (canPersist()) saveToStorage(store);
}

/** Reseta o store ao seed e re-grava no localStorage. */
export function resetStore(): void {
  Object.assign(store, createInitialStore());
  if (canPersist()) saveToStorage(store);
}

/**
 * Esvazia o store para simular a configuracao inicial (onboarding): mantem
 * organizacao, unidade e apenas o usuario Proprietario (owner). Todo o resto
 * (equipe, cargos, servicos, categorias, clientes, agenda e demais usuarios) e
 * limpo, para cadastrar do zero. Re-grava no localStorage.
 */
export function clearStore(): void {
  const base = createInitialStore();
  const owner = base.users.find((u) => u.profile === "owner");
  // No setup inicial ainda nao ha equipe: remove o vinculo do Proprietario com
  // um profissional para nao deixar uma referencia pendurada.
  if (owner) delete owner.professionalId;
  Object.assign(store, {
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
  });
  if (canPersist()) saveToStorage(store);
}
