import type { ReactNode } from "react";
import type { AuditAction, AuditEntityType } from "@gestarahub/contracts";
import {
  Award,
  BadgeDollarSign,
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  Contact,
  CreditCard,
  FileText,
  GraduationCap,
  Layers,
  MessageSquare,
  Receipt,
  Ruler,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Ticket,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cores e icones da auditoria (01/11/2026, decidido com o dono): a cor fica so
 * na acao (criou, atualizou, removeu...), para dizer o que aconteceu de longe;
 * o tipo do alvo (aluno, turma, certificado...) fica cinza, com um icone.
 */
const ACTION_CLASS: Record<AuditAction, string> = {
  created: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  updated: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  deleted: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  cancelled: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  rescheduled: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  status_changed: "border-border bg-muted text-muted-foreground",
  activated: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  inactivated: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export function auditActionClass(action: AuditAction): string {
  return cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium", ACTION_CLASS[action]);
}

const ENTITY_ICON: Record<AuditEntityType, typeof Users> = {
  appointment: CalendarClock,
  client: UserRound,
  service: Scissors,
  category: Tag,
  role: ShieldCheck,
  professional: Contact,
  user: Users,
  settings: Settings,
  plan: Layers,
  lesson_package: Ticket,
  charge: Wallet,
  class_group: GraduationCap,
  enrollment: BookOpenCheck,
  event: CalendarClock,
  event_registration: BookOpenCheck,
  assessment: ClipboardCheck,
  measurement: Ruler,
  certificate: Award,
  financial_entry: Receipt,
  financial_category: Tag,
  teacher_payout: BadgeDollarSign,
  teacher_pay_rule: BadgeDollarSign,
  online_payment: CreditCard,
  subscription: Sparkles,
  communication_session: MessageSquare,
  message_template: FileText,
  message_log: MessageSquare,
};

export function AuditEntityIcon({ type, className }: { type: AuditEntityType; className?: string }): ReactNode {
  const Icon = ENTITY_ICON[type] ?? FileText;
  return <Icon className={cn("size-3", className)} aria-hidden />;
}

/** Tela de detalhe do alvo, quando existe uma (aluno e turma); os outros ficam so no registro. */
export function auditTargetHref(type: AuditEntityType, id?: string): string | null {
  if (!id) return null;
  if (type === "client") return `/clients/${id}`;
  if (type === "class_group") return `/classes/${id}`;
  return null;
}

/**
 * A frase da linha sem o autor no comeco ("Ana atualizou a turma X" vira
 * "Atualizou a turma X"): o autor ja aparece a direita. O resumo completo
 * continua no registro e no nome acessivel da linha.
 */
export function summaryWithoutActor(summary: string, actorName: string): string {
  const prefix = `${actorName.trim()} `;
  if (!actorName.trim() || !summary.startsWith(prefix)) return summary;
  const rest = summary.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
