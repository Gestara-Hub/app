import type { DateTimeISO, Id, StatusCadastro } from "./comuns";

export interface Cliente {
  id: Id;
  organizacaoId: Id;
  nome: string;
  telefone: string;
  email?: string;
  observacoes?: string;
  status: StatusCadastro;
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}

// Create: o service gera id e timestamps.
export type CreateCliente = Omit<Cliente, "id" | "criadoEm" | "atualizadoEm">;

// Update: PATCH parcial; id vai por argumento, nunca no corpo.
export type UpdateCliente = Partial<CreateCliente>;

export interface ClienteFiltro {
  busca?: string; // nome ou telefone
  status?: StatusCadastro;
}
