import { addDays, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type { ChargeView, DateISO, Id, MessageTrigger, ReminderLog, ReminderSources } from "@gestarahub/contracts";
import { relativeDateLabel } from "@gestarahub/core/date";
import { formatCents, plural } from "@gestarahub/core/format";
import { ageTurningThisYear, daysUntilBirthday } from "@/lib/birthdays";
import { selectEndingPackages } from "@/lib/package-ending";
import { chargeReminder, packageRemainingText } from "./message-values";
import { BIRTHDAY_LATE_DAYS } from "./message-suggestions";

/**
 * Motor de lembretes (doc product/25): a partir dos dados do espaco
 * (`getReminderSources`), o que lembrar hoje, em grupos, do mais importante
 * para o menos. Pura: a mesma regra serve o painel, o sino e o envio em
 * sequencia (e, no Pro, o envio automatico).
 *
 * - Nao repete o que ja foi feito: mensagem do tipo ja aberta no WhatsApp para
 *   aquele aluno (e aquela cobranca) marca o item como feito. Atraso sem
 *   pagamento volta a lembrar depois de 7 dias.
 * - Adiar e ignorar ficam nas preferencias do usuario (`snoozes`).
 */

export type ReminderGroupKey = "overdue" | "due_today" | "due_soon" | "packages" | "absence" | "birthday";
export type ReminderCategory = "billing" | "relationship";

export interface ReminderItem {
  /** Chave estavel (adiar/ignorar): `<grupo>:<cobranca ou aluno>`. */
  key: string;
  studentId: Id;
  studentName: string;
  phone?: string;
  trigger: MessageTrigger;
  /** Variaveis do modelo ({aluno} e {empresa} vem do envio). */
  values: Record<string, string>;
  chargeId?: Id;
  detail: string;
  amountCents?: number;
  /** Ja feito ("Avisado hoje"): fica na lista, nao conta como pendencia. */
  done?: string;
  /** Feito hoje: o grupo fica na tela ate o fim do dia (a confirmacao nao some no clique). */
  doneToday?: boolean;
}

export interface ReminderGroup {
  key: ReminderGroupKey;
  category: ReminderCategory;
  title: string;
  detail: string;
  /** Os primeiros `MAX_ITEMS_PER_GROUP`, na ordem de importancia; o resto fica em `hidden`. */
  items: ReminderItem[];
  /** Itens alem do limite (a tela mostra "e mais N" e o link da lista completa). */
  hidden: number;
  /** Itens ainda por fazer. */
  pending: number;
  /** Tela com a lista completa, quando existe. */
  href?: string;
}

/** `itemKey` -> ate quando adiado ("yyyy-MM-dd") ou "never" (nao lembrar). */
export type ReminderSnoozes = Record<string, string>;

/**
 * Itens por grupo na tela: um espaco com 2 mil cobrancas em atraso nao pode
 * desenhar 2 mil linhas no painel. O titulo e o total contam todos; a lista
 * completa fica na tela da area (Cobrancas, que pagina).
 */
export const MAX_ITEMS_PER_GROUP = 20;

/** Atraso: lembra de novo depois disto sem pagamento. */
export const OVERDUE_REMIND_AGAIN_DAYS = 7;
/** Sem prazo no modelo: avisa 3 dias antes do vencimento. */
const DEFAULT_BEFORE_DUE_DAYS = 3;

const BILLING_TRIGGERS = new Set<MessageTrigger>([
  "billing_before_due",
  "billing_due_date",
  "billing_after_due",
  "billing_critical",
  "charge_reminder",
]);

const localDay = (iso: string) => format(parseISO(iso), "yyyy-MM-dd");
const ddmm = (date: DateISO) => format(parseISO(date), "dd/MM");

function namesLine(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} e mais ${names.length - 3}` : shown;
}

/** Ultimo dia (local) em que saiu mensagem que casa com o filtro. */
function lastSent(logs: ReminderLog[], match: (log: ReminderLog) => boolean): DateISO | undefined {
  let last: DateISO | undefined;
  for (const log of logs) {
    if (!match(log)) continue;
    const day = localDay(log.sentAt);
    if (!last || day > last) last = day;
  }
  return last;
}

function doneFields(day: DateISO | undefined, today: DateISO, verb = "Avisado"): Pick<ReminderItem, "done" | "doneToday"> {
  const done = doneLabel(day, today, verb);
  if (!done) return {};
  return day && day >= today ? { done, doneToday: true } : { done };
}

function doneLabel(day: DateISO | undefined, today: DateISO, verb = "Avisado"): string | undefined {
  if (!day) return undefined;
  const days = differenceInCalendarDays(parseISO(today), parseISO(day));
  return days <= 0 ? `${verb} hoje` : days === 1 ? `${verb} ontem` : `${verb} em ${ddmm(day)}`;
}

/** "Faz 31 anos" (hoje) ou "Fez 31 anos em 19/09" (na semana). */
function birthdayDetail(birthDate: DateISO, day: DateISO, isToday: boolean): string {
  const age = ageTurningThisYear(birthDate, day);
  if (isToday) return age > 0 ? `Faz ${age} anos` : "Faz aniversário hoje";
  return age > 0 ? `Fez ${age} anos em ${ddmm(day)}` : `Fez aniversário em ${ddmm(day)}`;
}

function snoozed(key: string, snoozes: ReminderSnoozes, today: DateISO): boolean {
  const until = snoozes[key];
  return Boolean(until) && (until === "never" || until > today);
}

function billingItem(charge: ChargeView, today: DateISO, group: ReminderGroupKey, logs: ReminderLog[]): ReminderItem | null {
  const reminder = chargeReminder(charge, today);
  if (!reminder) return null;
  const overdueDays = differenceInCalendarDays(parseISO(today), parseISO(charge.dueDate));
  // Atraso: o lembrete enviado depois do vencimento vale por 7 dias; antes de
  // vencer, qualquer lembrete da cobranca na ultima semana.
  const since =
    group === "overdue"
      ? [charge.dueDate, format(subDays(parseISO(today), OVERDUE_REMIND_AGAIN_DAYS - 1), "yyyy-MM-dd")].sort().at(-1)!
      : format(subDays(parseISO(today), OVERDUE_REMIND_AGAIN_DAYS - 1), "yyyy-MM-dd");
  const sent = lastSent(
    logs,
    (log) => BILLING_TRIGGERS.has(log.trigger) && log.chargeId === charge.id && localDay(log.sentAt) >= since,
  );
  const when =
    group === "overdue"
      ? `venceu ${ddmm(charge.dueDate)} · ${plural(overdueDays, "dia", "dias")}`
      : group === "due_today"
        ? "vence hoje"
        : `vence ${ddmm(charge.dueDate)}`;
  return {
    key: `${group}:${charge.id}`,
    studentId: charge.studentId,
    studentName: charge.studentName,
    trigger: reminder.trigger,
    values: reminder.values,
    chargeId: charge.id,
    detail: `${formatCents(charge.amountCents)} · ${when}`,
    amountCents: charge.amountCents,
    ...doneFields(sent, today),
  };
}

function group(
  key: ReminderGroupKey,
  category: ReminderCategory,
  items: ReminderItem[],
  title: (n: number) => string,
  detail: (items: ReminderItem[]) => string,
  href?: string,
): ReminderGroup | null {
  const pending = items.filter((i) => !i.done).length;
  // Tudo feito: some, menos no dia em que foi feito (a pessoa ve o "Avisado hoje").
  if (pending === 0 && !items.some((i) => i.doneToday)) return null;
  // Na ordem de importancia; o ja feito fica no lugar (marcado), sem pular de posicao.
  const ordered = items;
  const shown = ordered.slice(0, MAX_ITEMS_PER_GROUP);
  return {
    key,
    category,
    title: title(items.length),
    detail: detail(items),
    items: shown,
    hidden: ordered.length - shown.length,
    pending,
    ...(href ? { href } : {}),
  };
}

const moneyDetail = (items: ReminderItem[]) =>
  formatCents(items.reduce((sum, i) => sum + (i.amountCents ?? 0), 0));

export function buildReminders(
  src: ReminderSources,
  options: { today: DateISO; snoozes?: ReminderSnoozes },
): ReminderGroup[] {
  const { today } = options;
  const snoozes = options.snoozes ?? {};
  const phoneOf = new Map(src.students.map((s) => [s.id, s.phone]));
  const withPhone = (item: ReminderItem): ReminderItem =>
    phoneOf.get(item.studentId) ? { ...item, phone: phoneOf.get(item.studentId) } : item;
  const keep = (item: ReminderItem | null): item is ReminderItem => Boolean(item) && !snoozed(item!.key, snoozes, today);

  // --- Cobranca ------------------------------------------------------------
  const beforeDue = Math.abs(
    src.templates.find((t) => t.trigger === "billing_before_due")?.daysOffset ?? -DEFAULT_BEFORE_DUE_DAYS,
  ) || DEFAULT_BEFORE_DUE_DAYS;
  const soonLimit = format(addDays(parseISO(today), beforeDue), "yyyy-MM-dd");
  const open = src.charges.filter((c) => c.status === "pending" || c.status === "overdue");
  const overdue = open
    .filter((c) => c.status === "overdue")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.amountCents - a.amountCents)
    .map((c) => billingItem(c, today, "overdue", src.logs))
    .filter(keep)
    .map(withPhone);
  const dueToday = open
    .filter((c) => c.status === "pending" && c.dueDate === today)
    .sort((a, b) => b.amountCents - a.amountCents)
    .map((c) => billingItem(c, today, "due_today", src.logs))
    .filter(keep)
    .map(withPhone);
  const dueSoon = open
    .filter((c) => c.status === "pending" && c.dueDate > today && c.dueDate <= soonLimit)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.amountCents - a.amountCents)
    .map((c) => billingItem(c, today, "due_soon", src.logs))
    .filter(keep)
    .map(withPhone);

  // --- Pacote ---------------------------------------------------------------
  const packages = selectEndingPackages(src.packages, today)
    .map(({ pkg }): ReminderItem => {
      const sent = lastSent(
        src.logs,
        (log) => log.trigger === "package_ending" && log.clientId === pkg.studentId && localDay(log.sentAt) >= pkg.purchasedAt,
      );
      const remaining = packageRemainingText(pkg, today);
      return {
        key: `packages:${pkg.id}`,
        studentId: pkg.studentId,
        studentName: pkg.studentName,
        trigger: "package_ending",
        values: { pacote: pkg.name, restante: remaining },
        detail: `${pkg.name} · ${remaining}`,
        ...doneFields(sent, today),
      };
    })
    .filter(keep)
    .map(withPhone);

  // --- Faltas seguidas -----------------------------------------------------
  const absence = src.absenceStreaks
    .map((s): ReminderItem => {
      const sent = lastSent(
        src.logs,
        (log) => log.trigger === "absence_alert" && log.clientId === s.studentId && localDay(log.sentAt) >= s.since,
      );
      const classes = s.classGroupNames.length > 0 ? ` · ${s.classGroupNames.join(", ")}` : "";
      return {
        key: `absence:${s.studentId}:${s.since}`,
        studentId: s.studentId,
        studentName: s.studentName,
        trigger: "absence_alert",
        values: {},
        detail: `${s.streak} faltas seguidas · desde ${relativeDateLabel(s.since)}${classes}`,
        ...doneFields(sent, today),
      };
    })
    .filter(keep)
    .map(withPhone);

  // --- Aniversario (no dia e na semana) -------------------------------------
  const birthday = src.students
    .flatMap((s): ReminderItem[] => {
      if (!s.birthDate) return [];
      for (let late = 0; late <= BIRTHDAY_LATE_DAYS; late += 1) {
        const day = format(subDays(parseISO(today), late), "yyyy-MM-dd");
        if (daysUntilBirthday(s.birthDate, day) !== 0) continue;
        const sent = lastSent(
          src.logs,
          (log) => log.trigger === "birthday_greeting" && log.clientId === s.id && localDay(log.sentAt) >= day,
        );
        return [
          {
            key: `birthday:${s.id}:${day}`,
            studentId: s.id,
            studentName: s.name,
            trigger: "birthday_greeting",
            values: {},
            detail: birthdayDetail(s.birthDate, day, late === 0),
            ...doneFields(sent, today, "Parabéns enviado"),
          },
        ];
      }
      return [];
    })
    // Hoje primeiro, depois o mais recente (a data e o fim da chave).
    .sort((a, b) => b.key.slice(-10).localeCompare(a.key.slice(-10)) || a.studentName.localeCompare(b.studentName, "pt-BR"))
    .filter(keep)
    .map(withPhone);

  const names = (items: ReminderItem[]) => namesLine(items.map((i) => i.studentName));
  // Atraso: o total e de quantos meses (a divida nao some na virada do mes).
  const overdueMonths = new Set(
    open.filter((c) => c.status === "overdue").map((c) => c.competence ?? c.dueDate.slice(0, 7)),
  ).size;
  const overdueDetail = (items: ReminderItem[]) =>
    overdueMonths > 1 ? `${moneyDetail(items)} até hoje, de ${overdueMonths} meses` : `${moneyDetail(items)} até hoje`;
  const allToday = birthday.every((i) => i.key.endsWith(today));
  return [
    group("overdue", "billing", overdue, (n) => plural(n, "cobrança em atraso", "cobranças em atraso"), overdueDetail, "/classes/billing?overdue=all"),
    group("due_today", "billing", dueToday, (n) => plural(n, "cobrança vence hoje", "cobranças vencem hoje"), moneyDetail, "/classes/billing"),
    group(
      "due_soon",
      "billing",
      dueSoon,
      (n) => `${plural(n, "cobrança vence", "cobranças vencem")} até ${ddmm(soonLimit)}`,
      moneyDetail,
      "/classes/billing",
    ),
    group("packages", "billing", packages, (n) => plural(n, "pacote acabando", "pacotes acabando"), names),
    group("absence", "relationship", absence, (n) => plural(n, "aluno com 3 faltas seguidas", "alunos com 3 faltas seguidas"), names),
    group(
      "birthday",
      "relationship",
      birthday,
      (n) => (allToday ? plural(n, "aniversariante hoje", "aniversariantes hoje") : plural(n, "aniversariante na semana", "aniversariantes na semana")),
      names,
    ),
  ].filter((g): g is ReminderGroup => g !== null);
}

/** Pendencias de todos os grupos (o numero do sino). */
export function pendingReminders(groups: ReminderGroup[]): number {
  return groups.reduce((sum, g) => sum + g.pending, 0);
}
