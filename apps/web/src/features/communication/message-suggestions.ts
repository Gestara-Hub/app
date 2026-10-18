import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ChargeView, DateISO, Id, MessageTrigger, StudentSummary } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { daysUntilBirthday } from "@/lib/birthdays";
import { selectEndingPackages } from "@/lib/package-ending";
import { TRIGGER_META } from "./message-meta";
import { chargeReference, chargeReminder, packageRemainingText } from "./message-values";
import { levelWithSubLevel } from "@/lib/progression-tracks";

/**
 * Modelos sugeridos na mensagem para o aluno: primeiro os da situacao dele
 * (cobranca, faltas, pacote, aniversario, avanco, pagamento, boas-vindas),
 * depois os avisos, que valem sempre. Pura, para a tela e os testes.
 */

export interface MessageSuggestion {
  key: string;
  trigger: MessageTrigger;
  label: string;
  /** Valores das variaveis; {aluno} e {empresa} vem do envio. */
  values?: Record<string, string>;
  /** Cobranca ligada (lembrete e pagamento recebido). */
  chargeId?: Id;
}

export interface StudentMessageContext {
  today: DateISO;
  summary?: Pick<StudentSummary, "student" | "studentSince" | "levels" | "packages">;
  /** Cobrancas do aluno (todas as situacoes). */
  charges?: ChargeView[];
  /** Faltas seguidas (0 sem sequencia). */
  absenceStreak?: number;
}

/** Lembrete so do que vence em ate 7 dias (ou ja venceu). */
export const REMINDER_WINDOW_DAYS = 7;
/** "Pagamento recebido" ate 7 dias depois de pagar. */
export const PAYMENT_WINDOW_DAYS = 7;
/** "Parabens pelo avanco" ate 14 dias depois. */
export const PROMOTION_WINDOW_DAYS = 14;
/** "Boas-vindas" ate 7 dias depois do cadastro. */
export const WELCOME_WINDOW_DAYS = 7;
/** "Aniversario" no dia e ate 6 dias depois (a semana do aniversario). */
export const BIRTHDAY_LATE_DAYS = 6;
/** Faltas seguidas para o "Sentimos sua falta" (o mesmo do Dashboard). */
export const ABSENCE_STREAK = 3;

const NOTICES: MessageTrigger[] = ["class_canceled", "schedule_change", "holiday_notice"];

/** No chip, a mensalidade diz de quem fala ("Vence hoje" sozinho fica solto). */
const MEMBERSHIP_LABEL: Partial<Record<MessageTrigger, string>> = {
  billing_before_due: "Mensalidade a vencer",
  billing_due_date: "Mensalidade vence hoje",
  billing_after_due: "Mensalidade em atraso",
  billing_critical: "Mensalidade em atraso",
};

const daysSince = (date: DateISO, today: DateISO) => differenceInCalendarDays(parseISO(today), parseISO(date));
const localDay = (iso: string) => format(parseISO(iso), "yyyy-MM-dd");

/** Em atraso primeiro (o mais antigo), depois o que vence antes. */
function byUrgency(a: ChargeView, b: ChargeView): number {
  const overdue = Number(b.status === "overdue") - Number(a.status === "overdue");
  return overdue || a.dueDate.localeCompare(b.dueDate);
}

function reminderSuggestions(charges: ChargeView[], today: DateISO): MessageSuggestion[] {
  const due = charges
    .filter(
      (c) =>
        c.kind !== "dropin" &&
        (c.status === "overdue" || (c.status === "pending" && -daysSince(c.dueDate, today) <= REMINDER_WINDOW_DAYS)),
    )
    .sort(byUrgency);
  // Uma da mensalidade e uma das outras cobrancas, a mais urgente de cada.
  const picks = [due.find((c) => c.kind === "membership"), due.find((c) => c.kind !== "membership")];
  return picks.flatMap((charge) => {
    const reminder = charge ? chargeReminder(charge, today) : null;
    if (!charge || !reminder) return [];
    return [
      {
        key: `reminder-${charge.id}`,
        trigger: reminder.trigger,
        label: MEMBERSHIP_LABEL[reminder.trigger] ?? TRIGGER_META[reminder.trigger].label,
        values: reminder.values,
        chargeId: charge.id,
      },
    ];
  });
}

/** "mensalidade de outubro"; as outras cobrancas usam a referencia do lembrete. */
function paidReference(charge: ChargeView): string {
  if (charge.kind === "membership" && charge.competence) {
    return `mensalidade de ${format(parseISO(`${charge.competence}-01`), "MMMM", { locale: ptBR })}`;
  }
  return chargeReference(charge);
}

function paymentSuggestion(charges: ChargeView[], today: DateISO): MessageSuggestion | null {
  const paid = charges
    .filter((c) => c.status === "paid" && c.paidAt && daysSince(localDay(c.paidAt), today) <= PAYMENT_WINDOW_DAYS)
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];
  if (!paid) return null;
  return {
    key: `payment-${paid.id}`,
    trigger: "payment_received",
    label: TRIGGER_META.payment_received.label,
    values: { valor: formatCents(paid.amountCents), referencia: paidReference(paid) },
    chargeId: paid.id,
  };
}

function isBirthdayWeek(birthDate: string | undefined, today: DateISO): boolean {
  if (!birthDate) return false;
  for (let late = 0; late <= BIRTHDAY_LATE_DAYS; late += 1) {
    if (daysUntilBirthday(birthDate, format(subDays(parseISO(today), late), "yyyy-MM-dd")) === 0) return true;
  }
  return false;
}

function contextualSuggestions(context: StudentMessageContext): MessageSuggestion[] {
  const { today, summary, charges = [], absenceStreak = 0 } = context;
  const out: MessageSuggestion[] = reminderSuggestions(charges, today);

  if (absenceStreak >= ABSENCE_STREAK) {
    out.push({ key: "absence", trigger: "absence_alert", label: TRIGGER_META.absence_alert.label });
  }

  const ending = summary ? selectEndingPackages(summary.packages, today)[0] : undefined;
  if (ending) {
    out.push({
      key: `package-${ending.pkg.id}`,
      trigger: "package_ending",
      label: TRIGGER_META.package_ending.label,
      values: { pacote: ending.pkg.name, restante: packageRemainingText(ending.pkg, today) },
    });
  }

  if (summary && isBirthdayWeek(summary.student.birthDate, today)) {
    out.push({ key: "birthday", trigger: "birthday_greeting", label: TRIGGER_META.birthday_greeting.label });
  }

  // So avanco de verdade (graduacao registrada), com o grau: "Faixa Azul · 1º grau".
  const promoted = (summary?.levels ?? [])
    .filter((l) => l.lastAdvancedAt && daysSince(l.lastAdvancedAt, today) <= PROMOTION_WINDOW_DAYS)
    .sort((a, b) => (b.lastAdvancedAt ?? "").localeCompare(a.lastAdvancedAt ?? ""))[0];
  if (promoted) {
    out.push({
      key: `level-${promoted.modalityId}`,
      trigger: "level_up",
      label: TRIGGER_META.level_up.label,
      values: { nivel: levelWithSubLevel(promoted.levelName, promoted.subLevel, promoted.trackStyle) },
    });
  }

  const payment = paymentSuggestion(charges, today);
  if (payment) out.push(payment);

  if (summary && daysSince(summary.studentSince, today) <= WELCOME_WINDOW_DAYS) {
    out.push({ key: "welcome", trigger: "welcome_student", label: TRIGGER_META.welcome_student.label });
  }
  return out;
}

export function messageSuggestions(context: StudentMessageContext): MessageSuggestion[] {
  const notices = NOTICES.map((trigger) => ({ key: trigger, trigger, label: TRIGGER_META[trigger].label }));
  return [...contextualSuggestions(context), ...notices];
}
