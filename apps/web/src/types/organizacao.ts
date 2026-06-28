import type { DiaSemana, HoraISO, Id, StatusCadastro } from "./comuns";

export interface Organizacao {
  id: Id;
  nome: string; // 'Corte Nobre'
  segmento: string; // 'Barbearia'
  status: StatusCadastro;
}

export interface FuncionamentoDia {
  diaSemana: DiaSemana;
  fechado: boolean; // domingo = true
  inicio?: HoraISO; // presente quando fechado = false
  fim?: HoraISO; // presente quando fechado = false
}

export interface Unidade {
  id: Id;
  organizacaoId: Id;
  nome: string; // 'Corte Nobre - Matriz'
  endereco?: string;
  telefone?: string;
  status: StatusCadastro;
  funcionamento: FuncionamentoDia[]; // horario de funcionamento da unidade
}
