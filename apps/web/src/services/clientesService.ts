import type {
  ApiErrorCampo,
  Cliente,
  ClienteFiltro,
  CreateCliente,
  Id,
  UpdateCliente,
} from "@/types";
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
function validateCliente(
  payload: Partial<CreateCliente>,
  { partial }: { partial: boolean },
): void {
  const campos: ApiErrorCampo[] = [];
  const has = (key: keyof CreateCliente) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("nome")) {
    if (!payload.nome || !payload.nome.trim()) {
      campos.push({ campo: "nome", mensagem: "Informe o nome do cliente." });
    }
  }
  if (!partial || has("telefone")) {
    if (!payload.telefone || !payload.telefone.trim()) {
      campos.push({ campo: "telefone", mensagem: "Informe o telefone." });
    }
  }
  if (has("email") && payload.email && !EMAIL_RE.test(payload.email)) {
    campos.push({ campo: "email", mensagem: "Informe um e-mail válido." });
  }

  if (campos.length > 0) throw validationError(campos);
}

export const clientesService = {
  list(filtro?: ClienteFiltro): Promise<Cliente[]> {
    return simulateRead(() => {
      let result = store.clientes;
      if (filtro?.busca) {
        const termo = filtro.busca;
        result = result.filter(
          (c) => textIncludes(c.nome, termo) || textIncludes(c.telefone, termo),
        );
      }
      if (filtro?.status) {
        result = result.filter((c) => c.status === filtro.status);
      }
      return clone(
        [...result].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
    });
  },

  getById(id: Id): Promise<Cliente> {
    return simulateRead(() => {
      const found = store.clientes.find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateCliente): Promise<Cliente> {
    return simulateWrite(() => {
      validateCliente(payload, { partial: false });
      const ts = nowIso();
      const cliente: Cliente = {
        id: newId(),
        organizacaoId: store.organizacao.id,
        nome: payload.nome.trim(),
        telefone: payload.telefone.trim(),
        email: payload.email?.trim() || undefined,
        observacoes: payload.observacoes?.trim() || undefined,
        status: payload.status ?? "ativo",
        criadoEm: ts,
        atualizadoEm: ts,
      };
      store.clientes.push(cliente);
      return clone(cliente);
    });
  },

  update(id: Id, payload: UpdateCliente): Promise<Cliente> {
    return simulateWrite(() => {
      const idx = store.clientes.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateCliente(payload, { partial: true });
      const current = store.clientes[idx];
      const updated: Cliente = {
        ...current,
        ...payload,
        atualizadoEm: nowIso(),
      };
      store.clientes[idx] = updated;
      return clone(updated);
    });
  },

  // remove = inativacao logica; cliente permanece no historico.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.clientes.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      store.clientes[idx] = {
        ...store.clientes[idx],
        status: "inativo",
        atualizadoEm: nowIso(),
      };
    });
  },
};
