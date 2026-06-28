import type {
  ApiErrorCampo,
  CreateProfissional,
  Id,
  Profissional,
  ProfissionalFiltro,
  UpdateProfissional,
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

const NOT_FOUND = "Profissional não encontrado.";

// NOTA: mensagens a confirmar com o doc 10 quando o modulo Equipe for feito.
function validateProfissional(
  payload: Partial<CreateProfissional>,
  { partial }: { partial: boolean },
): void {
  const campos: ApiErrorCampo[] = [];
  const has = (key: keyof CreateProfissional) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("nome")) {
    if (!payload.nome || !payload.nome.trim()) {
      campos.push({ campo: "nome", mensagem: "Informe o nome do profissional." });
    }
  }
  if (!partial || has("cargo")) {
    if (!payload.cargo || !payload.cargo.trim()) {
      campos.push({ campo: "cargo", mensagem: "Informe o cargo." });
    }
  }
  if (!partial || has("servicosIds")) {
    if (!payload.servicosIds || payload.servicosIds.length === 0) {
      campos.push({
        campo: "servicosIds",
        mensagem: "Selecione ao menos um serviço.",
      });
    }
  }
  if (has("horariosDeTrabalho") && payload.horariosDeTrabalho) {
    const invalida = payload.horariosDeTrabalho.some((f) => f.inicio >= f.fim);
    if (invalida) {
      campos.push({
        campo: "horariosDeTrabalho",
        mensagem: "Horário inválido: o início deve ser antes do fim.",
      });
    }
  }

  if (campos.length > 0) throw validationError(campos);
}

export const profissionaisService = {
  list(filtro?: ProfissionalFiltro): Promise<Profissional[]> {
    return simulateRead(() => {
      let result = store.profissionais;
      if (filtro?.busca) {
        const termo = filtro.busca;
        result = result.filter(
          (p) => textIncludes(p.nome, termo) || textIncludes(p.cargo, termo),
        );
      }
      if (filtro?.status) {
        result = result.filter((p) => p.status === filtro.status);
      }
      if (filtro?.servicoId) {
        result = result.filter((p) => p.servicosIds.includes(filtro.servicoId!));
      }
      return clone(
        [...result].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
    });
  },

  getById(id: Id): Promise<Profissional> {
    return simulateRead(() => {
      const found = store.profissionais.find((p) => p.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateProfissional): Promise<Profissional> {
    return simulateWrite(() => {
      validateProfissional(payload, { partial: false });
      const ts = nowIso();
      const profissional: Profissional = {
        id: newId(),
        organizacaoId: store.organizacao.id,
        unidadeId: payload.unidadeId ?? store.unidade.id,
        nome: payload.nome.trim(),
        cargo: payload.cargo.trim(),
        telefone: payload.telefone?.trim() || undefined,
        status: payload.status ?? "ativo",
        horariosDeTrabalho: payload.horariosDeTrabalho ?? [],
        servicosIds: payload.servicosIds,
        criadoEm: ts,
        atualizadoEm: ts,
      };
      store.profissionais.push(profissional);
      return clone(profissional);
    });
  },

  update(id: Id, payload: UpdateProfissional): Promise<Profissional> {
    return simulateWrite(() => {
      const idx = store.profissionais.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateProfissional(payload, { partial: true });
      const current = store.profissionais[idx];
      const updated: Profissional = {
        ...current,
        ...payload,
        atualizadoEm: nowIso(),
      };
      store.profissionais[idx] = updated;
      return clone(updated);
    });
  },

  // remove = inativacao logica; inativo nao e sugerido em novos agendamentos.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.profissionais.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      store.profissionais[idx] = {
        ...store.profissionais[idx],
        status: "inativo",
        atualizadoEm: nowIso(),
      };
    });
  },
};
