import {
  CATEGORIAS_SERVICO,
  type ApiErrorCampo,
  type CreateServico,
  type Id,
  type Servico,
  type ServicoFiltro,
  type UpdateServico,
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

const NOT_FOUND = "Serviço não encontrado.";

/**
 * Validacao de campos do "servidor" (regra de negocio), com as mensagens de
 * referencia do doc 10. Independente da validacao de formulario (RHF + Zod).
 */
function validateServico(
  payload: Partial<CreateServico>,
  { partial }: { partial: boolean },
): void {
  const campos: ApiErrorCampo[] = [];
  const has = (key: keyof CreateServico) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("nome")) {
    if (!payload.nome || !payload.nome.trim()) {
      campos.push({ campo: "nome", mensagem: "Informe o nome do serviço." });
    }
  }
  if (!partial || has("categoria")) {
    if (!payload.categoria || !CATEGORIAS_SERVICO.includes(payload.categoria)) {
      campos.push({ campo: "categoria", mensagem: "Selecione uma categoria." });
    }
  }
  if (!partial || has("duracaoMinutos")) {
    if (typeof payload.duracaoMinutos !== "number" || payload.duracaoMinutos <= 0) {
      campos.push({
        campo: "duracaoMinutos",
        mensagem: "A duração deve ser maior que zero.",
      });
    }
  }
  if (!partial || has("precoCentavos")) {
    if (typeof payload.precoCentavos !== "number" || payload.precoCentavos < 0) {
      campos.push({
        campo: "precoCentavos",
        mensagem: "O preço não pode ser negativo.",
      });
    }
  }
  if (has("status")) {
    if (payload.status !== "ativo" && payload.status !== "inativo") {
      campos.push({ campo: "status", mensagem: "Selecione um status válido." });
    }
  }

  if (campos.length > 0) {
    throw validationError(campos);
  }
}

function sortServicos(list: Servico[]): Servico[] {
  return [...list].sort((a, b) => {
    const ca = CATEGORIAS_SERVICO.indexOf(a.categoria);
    const cb = CATEGORIAS_SERVICO.indexOf(b.categoria);
    if (ca !== cb) return ca - cb;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export const servicosService = {
  list(filtro?: ServicoFiltro): Promise<Servico[]> {
    return simulateRead(() => {
      let result = store.servicos;
      if (filtro?.busca) {
        const termo = filtro.busca;
        result = result.filter(
          (s) =>
            textIncludes(s.nome, termo) ||
            (s.descricao ? textIncludes(s.descricao, termo) : false),
        );
      }
      if (filtro?.categoria) {
        result = result.filter((s) => s.categoria === filtro.categoria);
      }
      if (filtro?.status) {
        result = result.filter((s) => s.status === filtro.status);
      }
      return clone(sortServicos(result));
    });
  },

  getById(id: Id): Promise<Servico> {
    return simulateRead(() => {
      const found = store.servicos.find((s) => s.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateServico): Promise<Servico> {
    return simulateWrite(() => {
      validateServico(payload, { partial: false });
      const ts = nowIso();
      const servico: Servico = {
        id: newId(),
        organizacaoId: store.organizacao.id,
        nome: payload.nome.trim(),
        categoria: payload.categoria,
        duracaoMinutos: payload.duracaoMinutos,
        precoCentavos: payload.precoCentavos,
        descricao: payload.descricao?.trim() || undefined,
        status: payload.status ?? "ativo",
        criadoEm: ts,
        atualizadoEm: ts,
      };
      store.servicos.push(servico);
      return clone(servico);
    });
  },

  update(id: Id, payload: UpdateServico): Promise<Servico> {
    return simulateWrite(() => {
      const idx = store.servicos.findIndex((s) => s.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateServico(payload, { partial: true });

      const current = store.servicos[idx];
      const updated: Servico = {
        ...current,
        ...payload,
        nome: payload.nome !== undefined ? payload.nome.trim() : current.nome,
        descricao:
          payload.descricao !== undefined
            ? payload.descricao.trim() || undefined
            : current.descricao,
        atualizadoEm: nowIso(),
      };
      store.servicos[idx] = updated;
      return clone(updated);
    });
  },

  // remove = inativacao logica (status -> 'inativo'); inativo nao e sugerido
  // em novos agendamentos, mas permanece no historico.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.servicos.findIndex((s) => s.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      store.servicos[idx] = {
        ...store.servicos[idx],
        status: "inativo",
        atualizadoEm: nowIso(),
      };
    });
  },
};
