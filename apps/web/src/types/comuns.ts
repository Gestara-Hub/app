/**
 * Tipos base e enums do dominio (contrato), 100% coerentes com
 * docs/frontend/02-camada-de-dados-mock.md e docs/product/04-mvp-barbearia.md.
 *
 * Convencao do projeto: o CONTRATO de dominio segue o canon em portugues
 * (entidades, campos e enum values), pois a camada de servico imita o contrato
 * da futura API NestJS. Codigo nao-dominio (componentes, hooks) fica em ingles.
 */

// Identificador opaco (uuid no mock).
export type Id = string;

// Data sem horario, formato 'YYYY-MM-DD' (ex.: '2026-06-26').
export type DataISO = string;

// Horario local 'HH:mm' (ex.: '09:00', '18:30').
export type HoraISO = string;

// Timestamp completo ISO 8601 (ex.: '2026-06-26T12:00:00.000Z').
export type DateTimeISO = string;

// Status generico de cadastro (Cliente, Profissional, Servico, Organizacao, Unidade).
export type StatusCadastro = "ativo" | "inativo";

// Chaves exatas do canon (StatusAgendamento).
export type StatusAgendamento =
  | "pendente"
  | "confirmado"
  | "em_atendimento"
  | "concluido"
  | "cancelado"
  | "nao_compareceu";

// MVP: manual | recorrencia. Futuro (fora do MVP): online | whatsapp.
export type OrigemAgendamento = "manual" | "recorrencia";

export type Frequencia = "semanal" | "quinzenal" | "mensal";

// Dia da semana. 0 = domingo ... 6 = sabado.
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Faixa de horario de trabalho de um profissional em um dia.
export interface FaixaHorario {
  diaSemana: DiaSemana;
  inicio: HoraISO; // ex.: '09:00'
  fim: HoraISO; // ex.: '20:00'
}

// Categoria de servico (canon Corte Nobre).
export type CategoriaServico = "Cabelo" | "Barba" | "Cuidados" | "Combos";

// Escopo de acoes sobre ocorrencias de serie (ver doc 10).
export type EscopoSerie = "somente_esta" | "esta_e_futuras";

// ---------------------------------------------------------------------------
// Formato de erro simulado (imita um erro de API). O mesmo objeto sera usado
// quando o backend real existir (mapear resposta HTTP -> ApiError).
// ---------------------------------------------------------------------------

export type ApiErrorCodigo =
  // Infra simulada
  | "NETWORK" // falha de rede simulada (gera estado de erro de lista)
  | "NOT_FOUND" // id inexistente
  | "VALIDATION" // payload invalido (campos)
  // Regras de negocio (agenda)
  | "CONFLITO_SOBREPOSICAO"
  | "FORA_DO_EXPEDIENTE"
  | "HORARIO_BLOQUEADO"
  | "PROFISSIONAL_NAO_REALIZA_SERVICO"
  | "PROFISSIONAL_INATIVO"
  | "SERVICO_INATIVO";

export interface ApiErrorCampo {
  campo: string; // ex.: 'nome', 'precoCentavos'
  mensagem: string; // texto de referencia do doc 10
}

export interface ApiError {
  codigo: ApiErrorCodigo;
  // Mensagem amigavel (alinhada ao doc 10-estados-e-mensagens.md).
  mensagem: string;
  // Detalhes por campo para erros de validacao de formulario.
  campos?: ApiErrorCampo[];
  // Status HTTP equivalente (para quando virar backend real).
  statusHttp?: number; // 400 | 404 | 409 | 422 | 500
}

// Type guard para uso nos hooks/telas.
export function isApiError(e: unknown): e is ApiError {
  return (
    typeof e === "object" &&
    e !== null &&
    "codigo" in e &&
    "mensagem" in e
  );
}
