import type {
  ChargeView,
  DateISO,
  Id,
  MessageTrigger,
  ReminderCourseEnding,
  ReminderEventCertificates,
  ReminderEventSignups,
  ReminderEventTomorrow,
  ReminderOpenRollCall,
  ReminderSources,
  ReminderSummary,
  ReminderVisitor,
} from "@gestarahub/contracts";
import { addDays, format, subDays } from "date-fns";
import { hasEnded } from "@gestarahub/core/billing";
import { can } from "@/lib/permissions";
import { ageAt, isAgedOutOfLevel, resolveModalityTrack } from "@/lib/progression-tracks";
import { getCurrentActor } from "@/services/world/actor";
import { readOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { chargesService } from "../billing/chargesService";
import { studentPackagesService } from "../billing/studentPackagesService";
import { attendanceService } from "../classes/attendanceService";
import { levelsOf } from "../clients/studentSummaryRules";
import { trialStudents } from "../clients/clientTrials";
import { actorTeacherId, teacherSeesSession } from "../classes/teacherScope";
import { sessionIdsInRange } from "../classes/classSlices";
import { enrollmentsOn, parseSessionId } from "../classes/classShared";
import { activeDays, eventStage } from "@gestarahub/core/events";
import { confirmedRegistrations, eventAttendancesStore, eventSessionsStore, eventsStore, registrationCoversDay, teacherSeesEvent } from "../events/eventShared";
import { expiringDocuments } from "../personDocuments/personDocumentsService";
import { tenantHasFeature } from "../subscription/subscriptionService";
import { ensureLogs, ensureTemplates } from "./communicationRules";
import { dateInSpace } from "@gestarahub/core/date";
import { attentionReminderKeys, buildReminders, pendingReminders } from "@/lib/messages/reminders";
import { messageGuardian } from "@gestarahub/core/payer";

/**
 * Dados dos lembretes (doc product/25) numa leitura so: alunos ativos,
 * cobrancas em aberto e pagas ha pouco, pacotes, faltas seguidas, mensagens
 * recentes e os prazos dos modelos. A regra do que lembrar e pura, no app.
 */

/** Tipos de mensagem que tem lembrete (o que ja foi enviado tira o lembrete). */
export const REMINDER_TRIGGERS: MessageTrigger[] = [
  "billing_before_due",
  "billing_due_date",
  "billing_after_due",
  "billing_critical",
  "charge_reminder",
  "package_ending",
  "absence_alert",
  "birthday_greeting",
  "welcome_student",
  "level_up",
  "payment_received",
  "trial_follow_up",
  "event_reminder",
];

/** Mensagens consideradas (atraso volta a lembrar depois de 7 dias; 60 cobre a semana do aniversario e o pacote). */
const LOG_WINDOW_DAYS = 60;
const PAID_WINDOW_DAYS = 7;
/** "Parabéns pelo avanço" ate 14 dias depois (o mesmo da ficha). */
const PROMOTION_WINDOW_DAYS = 14;

export const remindersService = {
  /**
   * Sino fora do Painel (12/11/2026): monta os lembretes aqui e devolve so o
   * numero e as chaves de atencao. `today` e `snoozes` vem da tela (dia do
   * espaco e "Lembrar amanha" da pessoa), para dar o mesmo que a lista.
   */
  async getReminderSummary(input: { today: DateISO; snoozes?: Record<string, string> }): Promise<ReminderSummary> {
    const sources = await remindersService.getReminderSources();
    const groups = buildReminders(sources, { today: input.today, snoozes: input.snoozes });
    return {
      pending: pendingReminders(groups),
      levelChanges: sources.levelChanges.length,
      attentionKeys: attentionReminderKeys(groups),
    };
  },

  getReminderSources(): Promise<ReminderSources> {
    return readOp(async () => {
      const actor = getCurrentActor();
      const teacherId = actorTeacherId();
      const canBilling = teacherId === undefined && (!actor || can(actor.profile, "billing:view"));

      // Professor: so os alunos das turmas em que e o titular.
      const teacherStudents =
        teacherId === undefined
          ? undefined
          : new Set(
              store.enrollments
                .filter(
                  (e) =>
                    e.status === "active" &&
                    store.classGroups.some((g) => g.id === e.classGroupId && g.instructorId === teacherId),
                )
                .map((e) => e.studentId),
            );
      const visible = (studentId: Id) => !teacherStudents || teacherStudents.has(studentId);

      const students = store.clients
        .filter((c) => c.status === "active" && visible(c.id))
        .map((c) => ({
          id: c.id,
          name: c.name,
          ...(c.phone ? { phone: c.phone } : {}),
          ...(messageGuardian(c, dateInSpace()) ? { guardian: messageGuardian(c, dateInSpace()) } : {}),
          ...(c.birthDate ? { birthDate: c.birthDate } : {}),
          createdAt: c.createdAt,
        }));
      const active = new Set(students.map((s) => s.id));
      // Assinatura pausada: o lembrete de cobranca nao sai (decisao de 24/10, achado 53).
      const paused = new Set(store.clients.filter((c) => c.membershipStatus === "paused").map((c) => c.id));

      const paidSince = subDays(new Date(), PAID_WINDOW_DAYS).toISOString();
      const charges: ChargeView[] = canBilling
        ? (await chargesService.listCharges()).filter(
            (c) =>
              active.has(c.studentId) &&
              c.kind !== "dropin" &&
              ((!paused.has(c.studentId) && (c.status === "pending" || c.status === "overdue")) ||
                (c.status === "paid" && Boolean(c.paidAt) && String(c.paidAt) >= paidSince)),
          )
        : [];
      const packages = canBilling
        ? (await studentPackagesService.listStudentPackages()).filter((p) => active.has(p.studentId))
        : [];
      const absenceStreaks = (await attendanceService.listAbsenceStreaks(3)).filter((s) => active.has(s.studentId));

      // Avanco de nivel registrado ha pouco (graduacao), para o "Parabéns pelo avanço".
      const today = dateInSpace();
      const promotedSince = format(subDays(new Date(), PROMOTION_WINDOW_DAYS), "yyyy-MM-dd");
      const promotions = store.clients
        .filter((c) => active.has(c.id) && c.progressions && Object.keys(c.progressions).length > 0)
        .flatMap((c) =>
          levelsOf(c, [], today)
            .filter((l) => l.lastAdvancedAt && l.lastAdvancedAt >= promotedSince)
            .map((l) => ({
              studentId: c.id,
              modalityId: l.modalityId,
              modalityName: l.modalityName,
              levelName: l.levelName,
              subLevel: l.subLevel,
              trackStyle: l.trackStyle,
              lastAdvancedAt: l.lastAdvancedAt as string,
            })),
        );

      const since = subDays(new Date(), LOG_WINDOW_DAYS).toISOString();
      const triggers = new Set(REMINDER_TRIGGERS);
      const logs = ensureLogs()
        .filter((l) => triggers.has(l.trigger) && l.sentAt >= since && (!l.clientId || active.has(l.clientId)))
        .map((l) => ({
          trigger: l.trigger,
          ...(l.clientId ? { clientId: l.clientId } : {}),
          ...(l.chargeId ? { chargeId: l.chargeId } : {}),
          sentAt: l.sentAt,
        }));
      const templates = ensureTemplates()
        .filter((t) => triggers.has(t.trigger))
        .map((t) => ({ trigger: t.trigger, enabled: t.enabled, daysOffset: t.daysOffset }));

      // Experimentais sem voltar (o motor decide a partir de quantos dias lembrar).
      const trials = trialStudents(
        store.clients.filter((c) => active.has(c.id)),
        today,
      ).filter((t) => t.stage === "trial");

      return {
        canBilling,
        students,
        charges,
        packages,
        absenceStreaks,
        promotions,
        trials,
        logs,
        templates,
        openRollCalls: openRollCallsOf(today, teacherId),
        documents: expiringDocuments(),
        eventCertificates: eventCertificatesOf(today, actor?.profile),
        eventSignups: eventSignupsOf(today, actor?.profile),
        eventsTomorrow: eventsTomorrowOf(today, teacherId, visible),
        visitors: visitorsOf(today, visible),
        coursesEnding: coursesEndingOf(today, teacherId, visible),
        levelChanges: levelChangesOf(today, active),
      };
    });
  },
};

/**
 * Troca de nivel pela idade (mesma regra do Painel, `use-level-change-pending`):
 * aluno ativo que passou da idade do nivel atual numa modalidade ativa, com
 * trilha, em que esta matriculado. O sino so precisa da contagem.
 */
function levelChangesOf(today: string, active: Set<Id>): { studentId: Id; modalityId: Id }[] {
  const categoryById = new Map(store.categories.filter((c) => c.status === "active").map((c) => [c.id, c]));
  const modalityByGroup = new Map(store.classGroups.map((g) => [g.id, g.modalityId]));
  const enrolled = new Set(
    store.enrollments
      .filter((e) => e.status === "active")
      .map((e) => `${e.studentId}~${modalityByGroup.get(e.classGroupId)}`),
  );
  const out: { studentId: Id; modalityId: Id }[] = [];
  for (const client of store.clients) {
    if (!active.has(client.id)) continue;
    const age = ageAt(client.birthDate, today);
    if (age === null) continue;
    for (const prog of Object.values(client.progressions ?? {})) {
      const category = categoryById.get(prog.modalityId);
      if (!category || !enrolled.has(`${client.id}~${prog.modalityId}`)) continue;
      const track = resolveModalityTrack(category);
      if (!track.enabled) continue;
      const level = track.levels.find((l) => l.id === prog.levelId || l.name === prog.levelName);
      if (level && isAgedOutOfLevel(level, age)) out.push({ studentId: client.id, modalityId: prog.modalityId });
    }
  }
  return out;
}

/**
 * Chamadas de ontem em aberto (doc product/25, "Resolver no sistema"): aulas de
 * turma ativa com matriculados na data e dias de evento com inscritos, sem
 * nenhuma marcacao. O professor so ve as dele (titular ou substituto).
 */
function openRollCallsOf(today: string, teacherId: Id | undefined): ReminderOpenRollCall[] {
  const yesterday = format(subDays(new Date(`${today}T12:00:00`), 1), "yyyy-MM-dd");
  const out: ReminderOpenRollCall[] = [];
  const marked = new Set(store.attendances.map((a) => a.sessionId));
  const groups = store.classGroups.filter((g) => g.status === "active");
  for (const sessionId of sessionIdsInRange(groups, yesterday, yesterday)) {
    if (marked.has(sessionId)) continue;
    const parsed = parseSessionId(sessionId);
    const g = parsed ? groups.find((x) => x.id === parsed.classGroupId) : undefined;
    if (!parsed || !g || !teacherSeesSession(g, sessionId, teacherId)) continue;
    const expected = enrollmentsOn(g.id, yesterday).length;
    if (expected === 0) continue;
    const slot = g.meetingSlots.find((s) => s.start === parsed.start);
    out.push({
      id: sessionId,
      kind: "class",
      title: g.name,
      date: yesterday,
      start: parsed.start,
      end: slot?.end ?? parsed.start,
      studentsCount: expected,
      href: `/classes/sessions/${encodeURIComponent(sessionId)}`,
    });
  }
  const eventMarked = new Set(eventAttendancesStore().map((a) => a.sessionId));
  for (const day of eventSessionsStore()) {
    if (day.date !== yesterday || day.status === "canceled" || eventMarked.has(day.id)) continue;
    const event = eventsStore().find((e) => e.id === day.eventId);
    if (!event || event.status !== "active" || !teacherSeesEvent(event, teacherId)) continue;
    const expected = confirmedRegistrations(event.id).filter((r) => registrationCoversDay(r, day.id)).length;
    if (expected === 0) continue;
    out.push({
      id: day.id,
      kind: "event",
      title: event.name,
      date: yesterday,
      start: day.start,
      end: day.end,
      studentsCount: expected,
      href: `/events/sessions/${encodeURIComponent(day.id)}`,
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "pt-BR"));
}

/** Dias de evento amanha com os inscritos confirmados que os cobrem (doc product/25, fase 3). */
function eventsTomorrowOf(today: string, teacherId: Id | undefined, visible: (id: Id) => boolean): ReminderEventTomorrow[] {
  const tomorrow = format(addDays(new Date(`${today}T12:00:00`), 1), "yyyy-MM-dd");
  const out: ReminderEventTomorrow[] = [];
  for (const day of eventSessionsStore()) {
    if (day.date !== tomorrow || day.status === "canceled") continue;
    const event = eventsStore().find((e) => e.id === day.eventId);
    if (!event || event.status !== "active" || !teacherSeesEvent(event, teacherId)) continue;
    const studentIds = confirmedRegistrations(event.id)
      .filter((r) => registrationCoversDay(r, day.id) && visible(r.studentId))
      .filter((r) => store.clients.find((c) => c.id === r.studentId)?.status === "active")
      .map((r) => r.studentId);
    if (studentIds.length === 0) continue;
    out.push({ sessionId: day.id, eventId: event.id, eventName: event.name, date: day.date, start: day.start, end: day.end, studentIds });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** O aluno tem algum vinculo fixo: matricula ativa, plano ou pacote em uso. */
function hasOngoingTie(studentId: Id): boolean {
  if (store.enrollments.some((e) => e.studentId === studentId && e.status === "active")) return true;
  const client = store.clients.find((c) => c.id === studentId);
  if (client?.planId) return true;
  return (store.studentPackages ?? []).some((p) => p.studentId === studentId && p.status === "active");
}

/**
 * Visitantes para virar aluno (doc product/25, fase 3; decisao 2 do doc 29):
 * aluno ativo sem matricula, plano ou pacote, com inscricao confirmada em evento
 * ja terminado ha 7 dias ou mais. O motor decide quando lembrar e se ja chamou.
 */
function visitorsOf(today: string, visible: (id: Id) => boolean): ReminderVisitor[] {
  const out = new Map<Id, ReminderVisitor>();
  for (const event of eventsStore()) {
    if (event.status !== "active") continue;
    const days = activeDays(eventSessionsStore().filter((s) => s.eventId === event.id));
    if (eventStage(days, today) !== "finished" || days.length === 0) continue;
    const endedOn = days[days.length - 1].date;
    for (const r of confirmedRegistrations(event.id)) {
      if (!visible(r.studentId) || hasOngoingTie(r.studentId)) continue;
      if (store.clients.find((c) => c.id === r.studentId)?.status !== "active") continue;
      const current = out.get(r.studentId);
      if (!current || current.endedOn < endedOn) out.set(r.studentId, { studentId: r.studentId, eventName: event.name, endedOn });
    }
  }
  return [...out.values()];
}

/** Dias antes do fim do curso em que o aluno sem outro vinculo entra no lembrete. */
const COURSE_ENDING_DAYS = 15;

/**
 * Curso terminando (doc product/25, fase 3): turma `course` ativa com fim nos
 * proximos 15 dias e aluno matriculado nela sem outra turma em andamento, plano
 * ou pacote. O professor so as dele.
 */
function coursesEndingOf(today: string, teacherId: Id | undefined, visible: (id: Id) => boolean): ReminderCourseEnding[] {
  const limit = format(addDays(new Date(`${today}T12:00:00`), COURSE_ENDING_DAYS), "yyyy-MM-dd");
  const out: ReminderCourseEnding[] = [];
  for (const g of store.classGroups) {
    if (g.status !== "active" || g.billingMode !== "course" || !g.endDate || g.endDate < today || g.endDate > limit) continue;
    if (teacherId !== undefined && g.instructorId !== teacherId) continue;
    for (const e of store.enrollments) {
      if (e.classGroupId !== g.id || e.status !== "active" || !visible(e.studentId)) continue;
      const client = store.clients.find((c) => c.id === e.studentId);
      if (!client || client.status !== "active" || client.planId) continue;
      const otherOngoing = store.enrollments.some(
        (o) => o.studentId === e.studentId && o.status === "active" && o.classGroupId !== g.id && !hasEnded(store.classGroups.find((x) => x.id === o.classGroupId) ?? {}, today),
      );
      if (otherOngoing || (store.studentPackages ?? []).some((p) => p.studentId === e.studentId && p.status === "active")) continue;
      out.push({ studentId: e.studentId, classGroupId: g.id, className: g.name, endDate: g.endDate });
    }
  }
  return out.sort((a, b) => a.endDate.localeCompare(b.endDate));
}

/**
 * Inscricao pelo link (doc product/29 P12): inscricoes novas nas ultimas 48 h e
 * vaga aberta com gente na lista de espera (reserva que caiu, cancelamento).
 * Quem ve eventos e pode inscrever (o professor: so os dele).
 */
function eventSignupsOf(today: string, profile: Parameters<typeof can>[0] | undefined): ReminderEventSignups[] {
  if (profile && !(can(profile, "events:view") && can(profile, "enrollment:manage"))) return [];
  const teacherId = actorTeacherId();
  const since = Date.now() - 48 * 3_600_000;
  const out: ReminderEventSignups[] = [];
  for (const event of eventsStore()) {
    if (event.status !== "active" || !teacherSeesEvent(event, teacherId)) continue;
    const days = activeDays(eventSessionsStore().filter((s) => s.eventId === event.id));
    if (eventStage(days, today) === "finished") continue;
    const registrations = (store.eventRegistrations ?? []).filter((r) => r.eventId === event.id);
    const fresh = registrations
      .filter((r) => r.source === "public_link" && r.status !== "canceled" && Date.parse(r.registeredAt) >= since)
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
    if (fresh.length > 0) {
      out.push({ eventId: event.id, eventName: event.name, kind: "new_signups", count: fresh.length, marker: fresh[0].id, href: `/events/${event.id}` });
    }
    const waiting = registrations.filter((r) => r.status === "waitlist").length;
    const taken = registrations.filter(
      (r) => r.status === "confirmed" || (r.status === "reserved" && r.holdUntil && Date.parse(r.holdUntil) > Date.now()),
    ).length;
    if (waiting > 0 && event.capacity !== undefined && taken < event.capacity) {
      out.push({
        eventId: event.id,
        eventName: event.name,
        kind: "spot_open",
        count: event.capacity - taken,
        marker: `${taken}:${waiting}`,
        href: `/events/${event.id}?tab=waitlist`,
      });
    }
  }
  return out;
}

/**
 * Eventos terminados com presentes sem certificado (doc product/25; Pro, recurso
 * `certificates`): quem ve eventos (o professor: so os dele).
 */
function eventCertificatesOf(today: string, profile: Parameters<typeof can>[0] | undefined): ReminderEventCertificates[] {
  if (!tenantHasFeature("certificates") || (profile && !can(profile, "events:view"))) return [];
  const teacherId = actorTeacherId();
  const issued = new Set((store.issuedCertificates ?? []).filter((c) => c.kind === "event").map((c) => c.eventRegistrationId));
  const present = new Set(eventAttendancesStore().filter((a) => a.status === "present").map((a) => a.registrationId));
  const out: ReminderEventCertificates[] = [];
  for (const event of eventsStore()) {
    if (event.status !== "active" || !teacherSeesEvent(event, teacherId)) continue;
    const days = activeDays(eventSessionsStore().filter((s) => s.eventId === event.id));
    if (eventStage(days, today) !== "finished") continue;
    const presentRegs = confirmedRegistrations(event.id).filter((r) => present.has(r.id));
    const without = presentRegs.filter((r) => !issued.has(r.id)).length;
    if (without === 0) continue;
    out.push({
      eventId: event.id,
      eventName: event.name,
      presentTotal: presentRegs.length,
      presentWithout: without,
      href: `/events/${event.id}/certificates`,
    });
  }
  return out.sort((a, b) => a.eventName.localeCompare(b.eventName, "pt-BR"));
}
