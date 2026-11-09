import type { ChargeView } from "./billing";
import type { ProgressionTrackStyle } from "./category";
import type { AbsenceStreakView } from "./class";
import type { DateISO, DateTimeISO, Id } from "./common";
import type { MessageTrigger } from "./communication";
import type { StudentPackageView } from "./package";
import type { TrialStudentView } from "./client";

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
  /** Aluno menor: o responsavel que recebe a cobranca no lugar dele (nome e telefone). */
  guardian?: { name: string; phone: string };
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

/** Avanco de nivel registrado nos ultimos 14 dias (para o "Parabéns pelo avanço"). */
export interface ReminderPromotion {
  studentId: Id;
  modalityId: Id;
  modalityName: string;
  levelName: string;
  subLevel: number;
  trackStyle: ProgressionTrackStyle;
  lastAdvancedAt: DateISO;
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
  promotions: ReminderPromotion[];
  /** Alunos que fizeram aula experimental e ainda nao voltaram (09/11/2026). */
  trials: TrialStudentView[];
  /** Mensagens dos ultimos 60 dias, so dos tipos que tem lembrete. */
  logs: ReminderLog[];
  templates: ReminderTemplate[];
}
