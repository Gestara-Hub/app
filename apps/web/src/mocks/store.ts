import type {
  Appointment,
  Category,
  Client,
  Organization,
  Professional,
  RecurrenceSeries,
  Service,
  TimeBlock,
  Unit,
} from "@/types";
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
  categories: Category[];
  services: Service[];
  appointments: Appointment[];
  timeBlocks: TimeBlock[];
  series: RecurrenceSeries[];
}

const STORAGE_KEY = "gestarahub:db";

// Versao do seed. Subir quando a forma/conteudo do seed mudar: dados salvos com
// versao diferente sao descartados e re-seedados (migracao/auto-reset do mock).
const SEED_VERSION = 3;

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
