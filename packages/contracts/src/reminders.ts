import type { ChargeView } from "./billing";
import type { ProgressionTrackStyle } from "./category";
import type { AbsenceStreakView } from "./class";
import type { DateISO, DateTimeISO, Id, TimeISO } from "./common";
import type { ExpiringPersonDocument } from "./person-document";
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

/** Aula de turma ou dia de evento de ontem sem nenhuma marcacao (doc product/25, "Resolver no sistema"). */
export interface ReminderOpenRollCall {
  /** Id da aula (`turma~data~inicio`) ou do dia do evento. */
  id: Id;
  kind: "class" | "event";
  title: string;
  date: DateISO;
  start: TimeISO;
  end: TimeISO;
  /** Alunos esperados (matriculados na data ou inscritos no dia). */
  studentsCount: number;
  href: string;
}

/** Evento terminado com presentes ainda sem certificado (Pro). */
export interface ReminderEventCertificates {
  eventId: Id;
  eventName: string;
  presentTotal: number;
  presentWithout: number;
  href: string;
}

/** Dia de evento amanha com os inscritos que o cobrem (doc product/25, "Falar com alguem"). */
export interface ReminderEventTomorrow {
  sessionId: Id;
  eventId: Id;
  eventName: string;
  date: DateISO;
  start: TimeISO;
  end: TimeISO;
  /** Inscritos confirmados no dia (alunos ativos visiveis a quem le). */
  studentIds: Id[];
}

/** Visitante: so fez evento (nenhuma matricula, plano ou pacote) e o evento terminou. */
export interface ReminderVisitor {
  studentId: Id;
  eventName: string;
  /** Ultimo dia do evento mais recente. */
  endedOn: DateISO;
}

/** Aluno de curso que termina em breve e nao tem outra turma, plano ou pacote. */
export interface ReminderCourseEnding {
  studentId: Id;
  classGroupId: Id;
  className: string;
  endDate: DateISO;
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
  // --- Resolver no sistema (09/11/2026): tarefas internas, sem WhatsApp ---
  /** Chamadas de ontem em aberto (o professor: so as dele). */
  openRollCalls: ReminderOpenRollCall[];
  /** Documentos da ficha vencendo ou vencidos (quem ve os alunos ou a equipe). */
  documents: ExpiringPersonDocument[];
  /** Eventos terminados com presentes sem certificado (so com o recurso `certificates`). */
  eventCertificates: ReminderEventCertificates[];
  // --- Falar com alguem (09/11/2026, fase 3) ---
  eventsTomorrow: ReminderEventTomorrow[];
  visitors: ReminderVisitor[];
  coursesEnding: ReminderCourseEnding[];
}
