import type {
  DataISO,
  DateTimeISO,
  HoraISO,
  Id,
  OrigemAgendamento,
  StatusAgendamento,
} from "./comuns";

export interface Agendamento {
  id: Id;
  organizacaoId: Id;
  unidadeId: Id;
  clienteId: Id;
  profissionalId: Id;
  servicoId: Id;
  data: DataISO; // 'YYYY-MM-DD'
  inicio: HoraISO; // 'HH:mm'
  fim: HoraISO; // derivado de inicio + duracaoMinutos do servico
  status: StatusAgendamento;
  origem: OrigemAgendamento;
  observacoes?: string;
  serieId?: Id; // presente quando faz parte de uma serie recorrente
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}

// Agendamento manual: 'fim' e derivado da duracao do servico no service;
// 'origem' e fixada como 'manual' pelo service no create manual.
export type CreateAgendamento = Omit<
  Agendamento,
  "id" | "fim" | "origem" | "status" | "criadoEm" | "atualizadoEm"
> & {
  status?: StatusAgendamento; // default 'pendente'
};

export type UpdateAgendamento = Partial<CreateAgendamento>;

export interface AgendamentoFiltro {
  // Periodo (inclusivo). Para a Agenda diaria, dataInicio === dataFim.
  dataInicio?: DataISO;
  dataFim?: DataISO;
  profissionalId?: Id;
  clienteId?: Id;
  status?: StatusAgendamento | StatusAgendamento[];
  origem?: OrigemAgendamento;
  serieId?: Id; // ocorrencias de uma serie
  busca?: string; // por cliente
}
