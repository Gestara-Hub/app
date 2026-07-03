import type {
  ApiErrorField,
  Client,
  ClientFilter,
  CreateClient,
  Id,
  UpdateClient,
} from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import {
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Cliente não encontrado.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// NOTA: mensagens a confirmar com o doc 10 quando o modulo Clientes for feito.
function validateClient(
  payload: Partial<CreateClient>,
  { partial }: { partial: boolean },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateClient) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: "Informe o nome do cliente." });
    }
  }
  if (!partial || has("phone")) {
    if (!payload.phone || !payload.phone.trim()) {
      fields.push({ field: "phone", message: "Informe o telefone." });
    }
  }
  if (has("email") && payload.email && !EMAIL_RE.test(payload.email)) {
    fields.push({ field: "email", message: "Informe um e-mail válido." });
  }

  if (fields.length > 0) throw validationError(fields);
}

export const clientsService = {
  list(filter?: ClientFilter): Promise<Client[]> {
    return simulateRead(() => {
      let result = store.clients;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter(
          (c) => textIncludes(c.name, term) || textIncludes(c.phone, term),
        );
      }
      if (filter?.status) {
        result = result.filter((c) => c.status === filter.status);
      }
      return clone(
        [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
    });
  },

  getById(id: Id): Promise<Client> {
    return simulateRead(() => {
      const found = store.clients.find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateClient): Promise<Client> {
    return simulateWrite(() => {
      validateClient(payload, { partial: false });
      const ts = nowIso();
      const client: Client = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        email: payload.email?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      store.clients.push(client);
      return clone(client);
    });
  },

  update(id: Id, payload: UpdateClient): Promise<Client> {
    return simulateWrite(() => {
      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateClient(payload, { partial: true });
      const current = store.clients[idx];
      const updated: Client = {
        ...current,
        ...payload,
        updatedAt: nowIso(),
      };
      store.clients[idx] = updated;
      return clone(updated);
    });
  },

  // remove = inativacao logica; cliente permanece no historico.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      store.clients[idx] = {
        ...store.clients[idx],
        status: "inactive",
        updatedAt: nowIso(),
      };
    });
  },
};
