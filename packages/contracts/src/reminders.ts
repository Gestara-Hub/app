import type { ChargeView } from "./billing";
import type { AbsenceStreakView } from "./class";
import type { DateISO, DateTimeISO, Id } from "./common";
import type { MessageTrigger } from "./communication";
import type { StudentPackageView } from "./package";

/**
 * Dados dos lembretes (doc product/25): uma leitura no servidor com tudo de
 * que o motor de lembretes precisa. A regra (o que lembrar, prioridade, o que
 * ja foi feito) e pura, no app (`features/communication/reminders.ts`).
 * Respeita o perfil: sem permissao de cobranca, sem cobrancas e pacotes; o
 * professor so ve os alunos das turmas dele.
 */

export interface ReminderStudent {
  id: Id;
  name: string;
  phone?: string;
  birthDate?: DateISO;
  createdAt: DateTimeISO;
}

/** Mensagem ja aberta no WhatsApp ou enviada (o que tira o lembrete). */
export interface ReminderLog {
  trigger: MessageTrigger;
  clientId?: Id;
  chargeId?: Id;
  sentAt: DateTimeISO;
}

export interface ReminderTemplate {
  trigger: MessageTrigger;
  enabled: boolean;
  /** Dias em relacao ao vencimento (negativo: antes). */
  daysOffset: number;
}

export interface ReminderSources {
  /** Quem le pode ver cobrancas (senao, `charges` e `packages` vem vazios). */
  canBilling: boolean;
  /** Alunos ativos (do professor: so das turmas dele). */
  students: ReminderStudent[];
  /** Cobrancas em aberto (sem aula avulsa) e pagas nos ultimos 7 dias. */
  charges: ChargeView[];
  packages: StudentPackageView[];
  absenceStreaks: AbsenceStreakView[];
  /** Mensagens dos ultimos 60 dias, so dos tipos que tem lembrete. */
  logs: ReminderLog[];
  templates: ReminderTemplate[];
}
