import type { Address, Id, RecordStatus, TimeISO, Weekday } from "./common";
import type { OnlinePaymentSettings } from "./finance";
import type { Subscription } from "./subscription";

/**
 * Modelo operacional do tenant (estrutural — define o app inteiro). Ortogonal ao
 * `segment` (vertical/rotulo). Ver docs/technical/01-extensao-modelos-operacionais.
 * "scheduling" = Modelo 1 (atendimento individual); "classes" = Modelo 3
 * (turmas/aulas); "delivery" = Modelo 2 (entrega/encomenda).
 */
export type OperationalModel = "scheduling" | "classes" | "delivery";

export type OrganizationBillingTiming = "prepaid" | "postpaid";
export type OrganizationMidMonthStrategy = "prorated" | "full_cycle";

/**
 * Area do negocio no Modelo 3 (turmas). So define padroes (trilha, duracao,
 * vagas) e vocabulario; nunca liga ou desliga recursos. `custom` usa
 * `Organization.customSegmentName` como rotulo.
 */
export type ClassesBusinessSegment =
  | "martial_arts"
  | "pilates_yoga"
  | "music_languages"
  | "dance"
  | "functional_training"
  | "swimming_sports"
  | "custom";

export interface OrganizationSettings {
  defaultDueDay?: number; // dia padrão de vencimento de mensalidades (ex: 10)
  billingTiming?: OrganizationBillingTiming; // 'prepaid' (no ato) ou 'postpaid' (ao final) - default: 'prepaid'
  midMonthStrategy?: OrganizationMidMonthStrategy; // 'prorated' (proporcional) ou 'full_cycle' (ciclo 30 dias) - default: 'prorated'
  onlinePayments?: OnlinePaymentSettings; // cobranca online simulada (plano pago)
  onboardingCompleted?: boolean;
  /**
   * `false` quando o setup criou modalidades com a trilha padrao da area: o
   * passo "Cadastrar modalidades" fica em "Falta revisar" ate o dono conferir.
   * Ausente = nada a revisar.
   */
  modalitiesReviewed?: boolean;
}

export interface Organization {
  id: Id;
  name: string; // 'Corte Nobre'
  segment: string; // 'Barbearia' (vertical/rotulo — nao confundir com `model`)
  model: OperationalModel; // modelo operacional (estrutural)
  /** Area do negocio no Modelo 3. Ausente = `martial_arts` (tenants antigos). */
  classSegment?: ClassesBusinessSegment;
  /** Nome digitado quando `classSegment` e `custom`. */
  customSegmentName?: string;
  settings?: OrganizationSettings;
  /** Plano GestaraHub (assinatura). Ausente = free. */
  subscription?: Subscription;
  status: RecordStatus;
}

export interface BusinessHoursShift {
  start: TimeISO;
  end: TimeISO;
}

export interface BusinessHoursDay {
  weekday: Weekday;
  closed: boolean; // domingo = true
  start?: TimeISO; // presente quando closed = false (retrocompatibilidade: primeiro turno)
  end?: TimeISO; // presente quando closed = false (retrocompatibilidade: ultimo turno)
  shifts?: BusinessHoursShift[]; // turnos/intervalos de funcionamento
}

export interface Unit {
  id: Id;
  organizationId: Id;
  name: string; // 'Corte Nobre - Matriz'
  address?: Address | string;
  phone?: string;
  status: RecordStatus;
  businessHours: BusinessHoursDay[]; // horario de funcionamento da unidade
}

