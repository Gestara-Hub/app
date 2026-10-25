/**
 * Linha do tempo de uma pessoa no painel (doc technical/21): erros, ações
 * auditadas e conversas de suporte numa só lista, da mais nova para a mais
 * antiga. As ações vêm só como tipo da ação e do alvo (a visão do banco não traz
 * rótulo nem nome de aluno). Puro, para testar.
 */
export type TimelineKind = "error" | "action" | "thread";

export interface TimelineItem {
  kind: TimelineKind;
  at: Date;
  /** Texto principal: o evento do erro, a ação ("Criou · Mensagem WhatsApp") ou o assunto da conversa. */
  title: string;
  /** Linha de apoio: a mensagem do erro, a tela e a versão, ou o protocolo. */
  detail?: string;
  /** Para onde o item leva (tela do erro ou da conversa). */
  href?: string;
  /** Marcado como falha (ação que falhou ou erro). */
  failed?: boolean;
  /** Código do erro que a pessoa viu, quando há. */
  reference?: string | null;
}

// Espelham os rótulos do app (web/src/lib/labels.ts); acrescente aqui quando o app ganhar tipo novo.
const ACTION_LABEL: Record<string, string> = {
  created: "Criou",
  updated: "Atualizou",
  deleted: "Removeu",
  cancelled: "Cancelou",
  rescheduled: "Remarcou",
  status_changed: "Mudou a situação de",
  activated: "Reativou",
  inactivated: "Inativou",
};

const TARGET_LABEL: Record<string, string> = {
  appointment: "agendamento",
  client: "aluno",
  service: "serviço",
  category: "categoria",
  role: "cargo",
  professional: "profissional",
  user: "usuário",
  settings: "configurações",
  plan: "plano",
  lesson_package: "pacote de aulas",
  charge: "cobrança",
  class_group: "turma",
  enrollment: "matrícula",
  assessment: "avaliação",
  financial_entry: "lançamento financeiro",
  financial_category: "categoria financeira",
  teacher_payout: "pagamento de professor",
  teacher_pay_rule: "regra de pagamento",
  online_payment: "pagamento online",
  subscription: "plano do GestaraHub",
  communication_session: "conexão do WhatsApp",
  message_template: "modelo de mensagem",
  message_log: "mensagem de WhatsApp",
};

/** "Criou · cobrança": a ação e o tipo do alvo, sem nome de ninguém. */
export function actionTitle(action: string, targetType: string | null): string {
  const verb = ACTION_LABEL[action] ?? action;
  const target = targetType ? (TARGET_LABEL[targetType] ?? targetType) : null;
  return target ? `${verb} · ${target}` : verb;
}

export const TIMELINE_KIND_LABEL: Record<TimelineKind, string> = { error: "Erro", action: "Ação", thread: "Conversa" };

/** Junta as listas e ordena da mais nova para a mais antiga (desempate estável: erro, ação, conversa). */
export function buildTimeline(...lists: TimelineItem[][]): TimelineItem[] {
  const order: Record<TimelineKind, number> = { error: 0, action: 1, thread: 2 };
  return lists
    .flat()
    .sort((a, b) => b.at.getTime() - a.at.getTime() || order[a.kind] - order[b.kind]);
}
