import type {
  AgendamentoFiltro,
  BloqueioFiltro,
  ClienteFiltro,
  Id,
  ProfissionalFiltro,
  ServicoFiltro,
} from "@/types";

/**
 * Convencao de queryKeys (hierarquia estavel):
 *  - [entidade] para o namespace,
 *  - [entidade, 'list', filtro] para listas,
 *  - [entidade, 'detail', id] para detalhe.
 * Filtros entram como objeto serializavel (o Query faz hash estrutural).
 */
export const queryKeys = {
  clientes: {
    all: ["clientes"] as const,
    list: (filtro?: ClienteFiltro) => ["clientes", "list", filtro] as const,
    detail: (id: Id) => ["clientes", "detail", id] as const,
  },
  profissionais: {
    all: ["profissionais"] as const,
    list: (filtro?: ProfissionalFiltro) =>
      ["profissionais", "list", filtro] as const,
    detail: (id: Id) => ["profissionais", "detail", id] as const,
  },
  servicos: {
    all: ["servicos"] as const,
    list: (filtro?: ServicoFiltro) => ["servicos", "list", filtro] as const,
    detail: (id: Id) => ["servicos", "detail", id] as const,
  },
  agendamentos: {
    all: ["agendamentos"] as const,
    list: (filtro?: AgendamentoFiltro) =>
      ["agendamentos", "list", filtro] as const,
    detail: (id: Id) => ["agendamentos", "detail", id] as const,
    ocorrencias: (serieId: Id) => ["agendamentos", "serie", serieId] as const,
  },
  bloqueios: {
    all: ["bloqueios"] as const,
    list: (filtro?: BloqueioFiltro) => ["bloqueios", "list", filtro] as const,
  },
  series: {
    detail: (id: Id) => ["series", "detail", id] as const,
  },
} as const;
