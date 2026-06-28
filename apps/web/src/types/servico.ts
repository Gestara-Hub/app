import type {
  CategoriaServico,
  DateTimeISO,
  Id,
  StatusCadastro,
} from "./comuns";

export interface Servico {
  id: Id;
  organizacaoId: Id;
  nome: string;
  categoria: CategoriaServico;
  duracaoMinutos: number; // > 0
  precoCentavos: number; // >= 0 (armazenamento em centavos para precisao)
  descricao?: string;
  status: StatusCadastro;
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}

// Create: o service gera id e timestamps.
export type CreateServico = Omit<Servico, "id" | "criadoEm" | "atualizadoEm">;

// Update: PATCH parcial; id vai por argumento, nunca no corpo.
export type UpdateServico = Partial<CreateServico>;

export interface ServicoFiltro {
  busca?: string;
  categoria?: CategoriaServico;
  status?: StatusCadastro;
}

// Ordem canonica das categorias (para agrupar/ordenar listas).
export const CATEGORIAS_SERVICO: CategoriaServico[] = [
  "Cabelo",
  "Barba",
  "Cuidados",
  "Combos",
];
