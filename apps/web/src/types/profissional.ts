import type {
  DateTimeISO,
  FaixaHorario,
  Id,
  StatusCadastro,
} from "./comuns";

export interface Profissional {
  id: Id;
  organizacaoId: Id;
  unidadeId: Id;
  nome: string;
  cargo: string; // cargo ou especialidade (ex.: 'Barbeiro e proprietario')
  telefone?: string;
  status: StatusCadastro;
  horariosDeTrabalho: FaixaHorario[]; // respeita o funcionamento da unidade
  servicosIds: Id[]; // servicos que o profissional realiza (matriz do canon)
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}

export type CreateProfissional = Omit<
  Profissional,
  "id" | "criadoEm" | "atualizadoEm"
>;

export type UpdateProfissional = Partial<CreateProfissional>;

export interface ProfissionalFiltro {
  busca?: string;
  status?: StatusCadastro;
  servicoId?: Id; // profissionais que realizam o servico
}
