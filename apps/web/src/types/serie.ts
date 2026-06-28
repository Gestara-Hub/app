import type {
  DataISO,
  DateTimeISO,
  Frequencia,
  HoraISO,
  Id,
} from "./comuns";

export interface SerieRecorrencia {
  id: Id;
  organizacaoId: Id;
  unidadeId: Id;
  clienteId: Id;
  profissionalId: Id;
  servicoId: Id;
  frequencia: Frequencia;
  inicio: DataISO; // data da primeira ocorrencia
  hora: HoraISO; // horario fixo das ocorrencias
  // Exatamente um dos dois criterios de termino e definido (serie sempre finita).
  terminoPorOcorrencias?: number;
  terminoPorData?: DataISO;
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}
