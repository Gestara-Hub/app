import type { DataISO, DateTimeISO, HoraISO, Id } from "./comuns";

export interface Bloqueio {
  id: Id;
  organizacaoId: Id;
  unidadeId: Id;
  profissionalId: Id;
  data: DataISO;
  inicio: HoraISO;
  fim: HoraISO;
  motivo?: string; // ex.: 'Almoco', 'Folga'
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}

export type CreateBloqueio = Omit<Bloqueio, "id" | "criadoEm" | "atualizadoEm">;

export type UpdateBloqueio = Partial<CreateBloqueio>;

export interface BloqueioFiltro {
  dataInicio?: DataISO;
  dataFim?: DataISO;
  profissionalId?: Id;
}
