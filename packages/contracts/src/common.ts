/**
 * Tipos base e enums do dominio (contrato).
 *
 * Convencao do projeto (english-code-standard): identificadores, keys e enum
 * VALUES em ingles. So strings vistas pelo usuario ficam em portugues — e elas
 * sao: texto livre de cadastro (name, description, notes...) e os ROTULOS de
 * exibicao dos enums (ver `src/lib/labels.ts`), nunca os codigos de enum.
 */

// Identificador opaco (uuid no mock).
export type Id = string;

// Data sem horario, formato 'YYYY-MM-DD' (ex.: '2026-06-26').
export type DateISO = string;

// Horario local 'HH:mm' (ex.: '09:00', '18:30').
export type TimeISO = string;

// Timestamp completo ISO 8601 (ex.: '2026-06-26T12:00:00.000Z').
export type DateTimeISO = string;

// Status generico de cadastro (Client, Professional, Service, Organization, Unit).
export type RecordStatus = "active" | "inactive";

/** Endereço estruturado compartilhado entre unidades, clientes e profissionais. */
export interface Address {
  postalCode: string; // CEP (apenas números ou formatado '00000-000')
  street: string; // Logradouro (rua, avenida)
  number: string; // Número
  complement?: string; // Complemento (apto, bloco, sala)
  neighborhood: string; // Bairro
  city: string; // Cidade
  state: string; // UF (SP, RJ, MG...)
}

// Status de agendamento (codigos canonicos).
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_service"
  | "completed"
  | "canceled"
  | "no_show";

// MVP: manual | recurrence. Futuro (fora do MVP): online | whatsapp.
export type AppointmentOrigin = "manual" | "recurrence";

export type Frequency = "weekly" | "biweekly" | "monthly";

// Dia da semana. 0 = domingo ... 6 = sabado.
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Faixa de horario de trabalho de um profissional em um dia. Intervalo (almoco)
// opcional dentro do expediente; se presente, o slot que o cobre e recusado.
export interface WorkingHours {
  weekday: Weekday;
  start: TimeISO; // ex.: '09:00'
  end: TimeISO; // ex.: '20:00'
  breakStart?: TimeISO; // inicio do intervalo/almoco (ex.: '12:00')
  breakEnd?: TimeISO; // fim do intervalo/almoco (ex.: '13:00')
}

// Escopo de acoes sobre ocorrencias de serie.
export type SeriesScope = "only_this" | "this_and_future";

// ---------------------------------------------------------------------------
// Formato de erro simulado (imita um erro de API).
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  // Infra simulada
  | "NETWORK"
  | "NOT_FOUND"
  | "VALIDATION"
  // Regras de negocio (agenda)
  | "OVERLAP_CONFLICT"
  | "OUTSIDE_BUSINESS_HOURS"
  | "OUTSIDE_PROFESSIONAL_HOURS"
  | "ON_BREAK"
  | "TIME_BLOCKED"
  | "PROFESSIONAL_DOES_NOT_OFFER_SERVICE"
  | "PROFESSIONAL_INACTIVE"
  | "SERVICE_INACTIVE"
  // Regras de negocio (turmas — Modelo 3)
  | "CLASS_FULL" // turma lotada (regra mole: confirma para matricular mesmo assim)
  | "CLASS_SCHEDULE_CONFLICT"; // conflito de horário (aluno já em outra turma no mesmo horário)

export interface ApiErrorField {
  field: string; // ex.: 'name', 'priceCents'
  message: string; // texto de referencia do doc 10 (PT, visto pelo usuario)
}

export interface ApiError {
  code: ApiErrorCode;
  // Mensagem amigavel em PT (alinhada ao doc 10).
  message: string;
  // Detalhes por campo para erros de validacao de formulario.
  fields?: ApiErrorField[];
  // Status HTTP equivalente (para quando virar backend real).
  httpStatus?: number; // 400 | 404 | 409 | 422 | 500
}

export function isApiError(e: unknown): e is ApiError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "message" in e
  );
}

/**
 * Campos de escopo do tenant. Nunca vem do cliente: o servidor (hoje, o mock)
 * carimba a partir da sessao, como a API real fara a partir do usuario logado.
 */
export type TenantScopeFields = "organizationId" | "unitId";
