import { addDays, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type { ChargeView, DateISO, Id, MessageTrigger, ReminderLog, ReminderSources } from "@gestarahub/contracts";
import { relativeDateLabel, dateInSpace } from "@gestarahub/core/date";
import { formatCents, plural } from "@gestarahub/core/format";
import { ageTurningThisYear, daysUntilBirthday } from "@/lib/birthdays";
import { selectEndingPackages } from "@/lib/package-ending";
import { chargeReminder, packageRemainingText } from "./message-values";
import { levelWithSubLevel } from "@/lib/progression-tracks";
import { needsTrialFollowUp } from "@gestarahub/core/trials";
import { documentExpiryText } from "@gestarahub/core/person-documents";
import { BIRTHDAY_LATE_DAYS, PAYMENT_WINDOW_DAYS, WELCOME_WINDOW_DAYS, paidReference } from "./message-suggestions";

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

export type ReminderGroupKey =
  | "overdue"
  | "due_today"
  | "due_soon"
  | "packages"
  | "absence"
  | "birthday"
  | "welcome"
  | "level_up"
  | "payment_received"
  /** Experimental que nao voltou depois de alguns dias: chamar de volta. */
  | "trial_follow_up"
  /** Aviso a uma turma (mudanca de horario): montado na hora, fora do motor. */
  | "schedule_change"
  /** Mensagem avulsa para varios alunos: montada na hora, fora do motor. */
  | "broadcast"
  /** Resolver no sistema (09/11/2026): tarefas internas, sem WhatsApp. */
  | "roll_call"
  | "documents"
  | "event_certificates"
  | "event_spot_open"
  | "event_new_signups"
  /** Falar com alguem (09/11/2026, fase 3). */
  | "event_tomorrow"
  | "visitor_follow_up"
  | "course_ending";
/** `task`: "Resolver no sistema" (abre uma tela), as outras sao "Falar com alguem" (WhatsApp). */
export type ReminderCategory = "billing" | "relationship" | "notice" | "task";
/**
 * Nivel com comportamento (doc product/25, "Níveis, urgência e novos lembretes"):
 * `info` so conta no sino; `warning` conta e faz o sino pulsar; `danger` e dos
 * avisos do espaco (lembrete de aluno nunca passa de `warning`).
 */
export type ReminderLevel = "info" | "warning" | "danger";

export const GROUP_LEVEL: Record<ReminderGroupKey, ReminderLevel> = {
  overdue: "warning",
  due_today: "warning",
  due_soon: "info",
  packages: "warning",
  absence: "warning",
  birthday: "info",
  welcome: "info",
  level_up: "info",
  payment_received: "info",
  trial_follow_up: "warning",
  schedule_change: "info",
  broadcast: "info",
  roll_call: "info",
  documents: "warning",
  event_certificates: "warning",
  event_spot_open: "warning",
  event_new_signups: "info",
  event_tomorrow: "info",
  visitor_follow_up: "warning",
  course_ending: "warning",
};

export interface ReminderItem {
  /** Chave estavel (adiar/ignorar): `<grupo>:<cobranca ou aluno>`. */
  key: string;
  studentId: Id;
  studentName: string;
  phone?: string;
  /** Aluno menor: quem recebe a mensagem no lugar dele (o responsavel), e o aluno de quem ela fala. */
  recipientName?: string;
  aboutStudent?: string;
  trigger: MessageTrigger;
  /** Variaveis do modelo ({aluno} e {empresa} vem do envio). */
  values: Record<string, string>;
  /** Texto pronto (no lugar do modelo), ex.: aviso com o horario novo. */
  content?: string;
  chargeId?: Id;
  detail: string;
  amountCents?: number;
  /** Ja feito ("Avisado hoje"): fica na lista, nao conta como pendencia. */
  done?: string;
  /** Feito hoje: o grupo fica na tela ate o fim do dia (a confirmacao nao some no clique). */
  doneToday?: boolean;
  /** Tarefa interna ("Resolver no sistema"): abre esta tela em vez do WhatsApp. */
  href?: string;
  /** Subtitulo que agrupa itens seguidos na lista ("Ontem", "Há 3 dias"): a data sai do `detail`. */
  section?: string;
}

export interface ReminderGroup {
  key: ReminderGroupKey;
  category: ReminderCategory;
  level: ReminderLevel;
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
/** Visitante de evento: dias depois do evento para oferecer turma (igual ao experimental). */
export const VISITOR_FOLLOW_UP_DAYS = 7;
/** Sem prazo no modelo: avisa 3 dias antes do vencimento. */
const DEFAULT_BEFORE_DUE_DAYS = 3;

const BILLING_TRIGGERS = new Set<MessageTrigger>([
  "billing_before_due",
  "billing_due_date",
  "billing_after_due",
  "billing_critical",
  "charge_reminder",
]);

const localDay = (iso: string) => dateInSpace(iso);
const ddmm = (date: DateISO) => format(parseISO(date), "dd/MM");

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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
  const todo = items.filter((i) => !i.done);
  const pending = todo.length;
  // Tudo feito: some, menos no dia em que foi feito (a pessoa ve o "Avisado hoje").
  if (pending === 0 && !items.some((i) => i.doneToday)) return null;
  // Na ordem de importancia. O feito hoje fica no lugar (marcado), sem pular de
  // posicao enquanto a pessoa envia; o feito em outro dia vai para o fim (10/11/2026).
  const doneBefore = items.filter((i) => i.done && !i.doneToday);
  const ordered = [...items.filter((i) => !i.done || i.doneToday), ...doneBefore];
  const shown = ordered.slice(0, MAX_ITEMS_PER_GROUP);
  // Titulo e nomes contam so o que falta fazer ("1 aniversariante", nao os 2 da semana).
  const counted = pending > 0 ? todo : items;
  return {
    key,
    category,
    level: GROUP_LEVEL[key],
    title: title(counted.length),
    detail: detail(counted),
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
  const guardianOf = new Map(src.students.map((s) => [s.id, s.guardian]));
  const withPhone = (item: ReminderItem): ReminderItem =>
    phoneOf.get(item.studentId) ? { ...item, phone: phoneOf.get(item.studentId) } : item;
  // Cobranca de aluno menor vai para o responsavel (decisao de 24/10, achado 57).
  const withBillingContact = (item: ReminderItem): ReminderItem => {
    const guardian = guardianOf.get(item.studentId);
    return guardian
      ? { ...item, phone: guardian.phone, recipientName: guardian.name, aboutStudent: item.studentName }
      : withPhone(item);
  };
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
    .map(withBillingContact);
  const dueToday = open
    .filter((c) => c.status === "pending" && c.dueDate === today)
    .sort((a, b) => b.amountCents - a.amountCents)
    .map((c) => billingItem(c, today, "due_today", src.logs))
    .filter(keep)
    .map(withBillingContact);
  const dueSoon = open
    .filter((c) => c.status === "pending" && c.dueDate > today && c.dueDate <= soonLimit)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.amountCents - a.amountCents)
    .map((c) => billingItem(c, today, "due_soon", src.logs))
    .filter(keep)
    .map(withBillingContact);

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

  // --- Relacionamento: boas-vindas, avanco de nivel e pagamento recebido ---
  const studentName = new Map(src.students.map((s) => [s.id, s.name]));
  const welcomeSince = format(subDays(parseISO(today), WELCOME_WINDOW_DAYS), "yyyy-MM-dd");
  const welcome = src.students
    .filter((s) => localDay(s.createdAt) >= welcomeSince)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((s): ReminderItem => {
      const sent = lastSent(src.logs, (log) => log.trigger === "welcome_student" && log.clientId === s.id);
      return {
        key: `welcome:${s.id}`,
        studentId: s.id,
        studentName: s.name,
        trigger: "welcome_student",
        values: {},
        // A data vira subtitulo na lista ("Ontem", "Há 3 dias"), sem repetir em cada linha.
        detail: "",
        section: capitalize(`Cadastrados ${relativeDateLabel(localDay(s.createdAt), { today })}`),
        ...doneFields(sent, today, "Boas-vindas enviadas"),
      };
    })
    .filter(keep)
    .map(withPhone);

  // --- Experimental sem voltar ----------------------------------------------
  const trialFollowUp = (src.trials ?? [])
    .filter((t) => needsTrialFollowUp(t))
    .sort((a, b) => (b.lastTrialAt ?? "").localeCompare(a.lastTrialAt ?? ""))
    .map((t): ReminderItem => {
      const sent = lastSent(
        src.logs,
        (log) =>
          log.trigger === "trial_follow_up" &&
          log.clientId === t.studentId &&
          (!t.lastTrialAt || localDay(log.sentAt) >= t.lastTrialAt),
      );
      const classes = t.classGroupNames.length > 0 ? ` · ${t.classGroupNames.join(", ")}` : "";
      return {
        key: `trial_follow_up:${t.studentId}`,
        studentId: t.studentId,
        studentName: t.studentName,
        trigger: "trial_follow_up",
        values: {},
        detail: `Experimental ${relativeDateLabel(t.lastTrialAt ?? t.firstTrialAt ?? today)}${classes}`,
        ...doneFields(sent, today, "Chamado"),
      };
    })
    .filter(keep)
    .map(withPhone);

  const levelUp = src.promotions
    .filter((p) => studentName.has(p.studentId))
    .sort((a, b) => b.lastAdvancedAt.localeCompare(a.lastAdvancedAt))
    .map((p): ReminderItem => {
      const level = levelWithSubLevel(p.levelName, p.subLevel, p.trackStyle);
      const sent = lastSent(
        src.logs,
        (log) => log.trigger === "level_up" && log.clientId === p.studentId && localDay(log.sentAt) >= p.lastAdvancedAt,
      );
      return {
        key: `level_up:${p.studentId}:${p.modalityId}:${p.lastAdvancedAt}`,
        studentId: p.studentId,
        studentName: studentName.get(p.studentId)!,
        trigger: "level_up",
        values: { nivel: level },
        detail: `${level} · ${p.modalityName} · ${relativeDateLabel(p.lastAdvancedAt)}`,
        ...doneFields(sent, today, "Parabéns enviado"),
      };
    })
    .filter(keep)
    .map(withPhone);

  const paidSince = format(subDays(parseISO(today), PAYMENT_WINDOW_DAYS), "yyyy-MM-dd");
  const paymentReceived = src.charges
    .filter((c) => c.status === "paid" && c.paidAt && localDay(c.paidAt) >= paidSince)
    .sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)))
    .map((c): ReminderItem => {
      const sent = lastSent(src.logs, (log) => log.trigger === "payment_received" && log.chargeId === c.id);
      return {
        key: `payment_received:${c.id}`,
        studentId: c.studentId,
        studentName: c.studentName,
        trigger: "payment_received",
        values: { valor: formatCents(c.amountCents), referencia: paidReference(c) },
        chargeId: c.id,
        detail: `${formatCents(c.amountCents)} · pago ${relativeDateLabel(localDay(String(c.paidAt)))}`,
        amountCents: c.amountCents,
        ...doneFields(sent, today, "Agradecido"),
      };
    })
    .filter(keep)
    .map(withPhone);

  // --- Resolver no sistema: chamada de ontem, documentos e certificados ------
  const rollCalls = (src.openRollCalls ?? [])
    .map(
      (r): ReminderItem => ({
        key: `roll_call:${r.id}`,
        studentId: r.id,
        studentName: r.title,
        trigger: "manual_broadcast",
        values: {},
        detail: `${r.kind === "event" ? "Evento · " : ""}${ddmm(r.date)}, ${r.start} às ${r.end} · ${plural(r.studentsCount, "aluno", "alunos")}`,
        href: r.href,
      }),
    )
    .filter(keep);
  const documents = (src.documents ?? [])
    .map(
      (d): ReminderItem => ({
        key: `document:${d.id}:${d.expiry}`,
        studentId: d.ownerId,
        studentName: `${d.label} de ${d.ownerName}`,
        trigger: "manual_broadcast",
        values: {},
        detail: `${documentExpiryText(d.daysToExpire) ?? ""} (${ddmm(d.expiresOn)})`,
        href: d.ownerKind === "client" ? `/clients/${d.ownerId}?tab=documents` : "/team",
      }),
    )
    .filter(keep);
  const eventCertificates = (src.eventCertificates ?? [])
    .map(
      (e): ReminderItem => ({
        key: `event_certificates:${e.eventId}`,
        studentId: e.eventId,
        studentName: e.eventName,
        trigger: "manual_broadcast",
        values: {},
        detail: `${e.presentWithout} de ${plural(e.presentTotal, "presente", "presentes")} sem certificado`,
        href: e.href,
      }),
    )
    .filter(keep);

  // Inscricao pelo link (doc product/29 P12): novas e vaga aberta com espera.
  const eventSignupItems = (kind: "new_signups" | "spot_open") =>
    (src.eventSignups ?? [])
      .filter((e) => e.kind === kind)
      .map(
        (e): ReminderItem => ({
          key: `event_${kind}:${e.eventId}:${e.marker}`,
          studentId: e.eventId,
          studentName: e.eventName,
          trigger: "manual_broadcast",
          values: {},
          detail:
            kind === "new_signups"
              ? plural(e.count, "inscrição nova pelo link", "inscrições novas pelo link")
              : `${plural(e.count, "vaga aberta", "vagas abertas")} com gente na espera`,
          href: e.href,
        }),
      )
      .filter(keep);
  const eventNewSignups = eventSignupItems("new_signups");
  const eventSpotOpen = eventSignupItems("spot_open");

  // --- Falar com alguem: evento amanha, visitante, curso terminando ------------
  const eventTomorrow = (src.eventsTomorrow ?? [])
    .flatMap((day) =>
      day.studentIds.map((studentId): ReminderItem => {
        const sent = lastSent(
          src.logs,
          (log) => log.trigger === "event_reminder" && log.clientId === studentId && localDay(log.sentAt) >= today,
        );
        return {
          key: `event_tomorrow:${day.sessionId}:${studentId}`,
          studentId,
          studentName: studentName.get(studentId) ?? "",
          trigger: "event_reminder",
          values: { evento: day.eventName, dia: ddmm(day.date), horario: `${day.start} às ${day.end}` },
          detail: `${day.eventName} · ${ddmm(day.date)}, ${day.start} às ${day.end}`,
          ...doneFields(sent, today),
        };
      }),
    )
    .filter(keep)
    .map(withPhone);

  const visitors = (src.visitors ?? [])
    .map((v): ReminderItem | null => {
      const days = differenceInCalendarDays(parseISO(today), parseISO(v.endedOn));
      if (days < VISITOR_FOLLOW_UP_DAYS) return null;
      const name = studentName.get(v.studentId) ?? "";
      const sent = lastSent(
        src.logs,
        (log) => log.trigger === "trial_follow_up" && log.clientId === v.studentId && localDay(log.sentAt) >= v.endedOn,
      );
      return {
        key: `visitor_follow_up:${v.studentId}:${v.endedOn}`,
        studentId: v.studentId,
        studentName: name,
        trigger: "trial_follow_up",
        values: {},
        content: `Oi, ${name}! Foi muito bom ter você no ${v.eventName}. Que tal continuar com a gente? Me conta o que achou e te ajudo a escolher a turma e o plano.`,
        detail: `${v.eventName} · ${relativeDateLabel(v.endedOn)}`,
        ...doneFields(sent, today, "Chamado"),
      };
    })
    .filter(keep)
    .map(withPhone);

  const coursesEnding = (src.coursesEnding ?? [])
    .map((c): ReminderItem => {
      const name = studentName.get(c.studentId) ?? "";
      return {
        key: `course_ending:${c.classGroupId}:${c.studentId}`,
        studentId: c.studentId,
        studentName: name,
        trigger: "manual_broadcast",
        values: {},
        content: `Oi, ${name}! Seu curso ${c.className} termina em ${ddmm(c.endDate)}. Quer continuar com a gente em outra turma? Me conta e te ajudo a escolher.`,
        detail: `${c.className} · termina ${ddmm(c.endDate)}`,
      };
    })
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
    group("level_up", "relationship", levelUp, (n) => plural(n, "aluno avançou de nível", "alunos avançaram de nível"), names),
    group("welcome", "relationship", welcome, (n) => plural(n, "aluno novo para dar boas-vindas", "alunos novos para dar boas-vindas"), names),
    group(
      "trial_follow_up",
      "relationship",
      trialFollowUp,
      (n) => plural(n, "experimental sem voltar", "experimentais sem voltar"),
      names,
      "/clients?trial=trial",
    ),
    group("payment_received", "relationship", paymentReceived, (n) => plural(n, "pagamento para agradecer", "pagamentos para agradecer"), moneyDetail),
    group("event_tomorrow", "notice", eventTomorrow, (n) => plural(n, "inscrito para avisar do evento de amanhã", "inscritos para avisar do evento de amanhã"), names),
    group("visitor_follow_up", "relationship", visitors, (n) => plural(n, "visitante para oferecer turma", "visitantes para oferecer turma"), names),
    group("course_ending", "relationship", coursesEnding, (n) => plural(n, "aluno com curso terminando", "alunos com curso terminando"), names),
    // Resolver no sistema
    group("roll_call", "task", rollCalls, (n) => plural(n, "chamada de ontem em aberto", "chamadas de ontem em aberto"), names),
    group("documents", "task", documents, (n) => plural(n, "documento para renovar", "documentos para renovar"), names),
    group("event_certificates", "task", eventCertificates, (n) => plural(n, "evento com presentes sem certificado", "eventos com presentes sem certificado"), names),
    group("event_spot_open", "task", eventSpotOpen, (n) => plural(n, "evento com vaga aberta e lista de espera", "eventos com vaga aberta e lista de espera"), names),
    group("event_new_signups", "notice", eventNewSignups, (n) => plural(n, "evento com inscrição nova pelo link", "eventos com inscrição nova pelo link"), names),
  ].filter((g): g is ReminderGroup => g !== null);
}

/** Pendencias de todos os grupos (o numero do sino). */
export function pendingReminders(groups: ReminderGroup[]): number {
  return groups.reduce((sum, g) => sum + g.pending, 0);
}

/**
 * Chaves dos itens de atencao ou urgencia ainda pendentes (o sino pulsa quando
 * alguma e nova desde a ultima abertura). Os itens ja feitos ficam de fora.
 */
export function attentionReminderKeys(groups: ReminderGroup[]): string[] {
  return groups
    .filter((g) => g.level !== "info")
    .flatMap((g) => g.items.filter((i) => !i.done).map((i) => i.key));
}
