import type { EventsReportData, GeneratedReportData } from "@gestarahub/contracts";
import { firstDayOfCompetence, lastDayOfCompetence } from "@gestarahub/core/finance";
import { dateInSpace } from "@gestarahub/core/date";
import { activeDays, eventStage } from "@gestarahub/core/events";
import { store } from "@/services/world/store";
import { assertFeature } from "../subscription/subscriptionService";
import { buildHeader } from "./reportCatalog";
import type { ReportContext } from "./reportContext";

/**
 * Eventos e seminarios do mes (doc product/29, fase 5, Pro): cada evento com
 * algum dia no mes, com inscritos, espera, presenca (presencas sobre inscritos
 * x dias ja feitos), o que entrou, o que falta, as saidas ligadas e o
 * resultado. Mesmas contas da aba Financeiro do evento.
 */
export async function buildEventsSummary({ competence, periodLabel }: ReportContext): Promise<GeneratedReportData> {
  assertFeature("reports_advanced");
  const today = dateInSpace();
  const first = firstDayOfCompetence(competence);
  const last = lastDayOfCompetence(competence);
  const sessions = store.eventSessions ?? [];
  const registrations = store.eventRegistrations ?? [];
  const attendances = store.eventAttendances ?? [];
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

  const events = (store.events ?? [])
    .map((event) => {
      const days = activeDays(sessions.filter((s) => s.eventId === event.id));
      if (!days.some((d) => d.date >= first && d.date <= last)) return null;
      const regs = registrations.filter((r) => r.eventId === event.id);
      const confirmed = regs.filter((r) => r.status === "confirmed");
      const doneDays = days.filter((d) => d.date <= today);
      const presences = attendances.filter((a) => a.eventId === event.id && a.status === "present").length;
      const slots = confirmed.length * doneDays.length;
      const charges = store.charges.filter((c) => c.eventId === event.id);
      const entries = store.financialEntries.filter((e) => e.eventId === event.id && e.status !== "canceled");
      const receivedCents = sum(charges.filter((c) => c.status === "paid").map((c) => c.amountCents));
      const paidIncome = sum(entries.filter((e) => e.type === "income" && e.status === "paid").map((e) => e.amountCents));
      const paidExpenses = sum(entries.filter((e) => e.type === "expense" && e.status === "paid").map((e) => e.amountCents));
      const instructor = event.instructorId ? store.professionals.find((p) => p.id === event.instructorId)?.name : event.guestInstructorName;
      return {
        eventId: event.id,
        name: event.name,
        ...(days[0] ? { firstDate: days[0].date, lastDate: days[days.length - 1].date } : {}),
        daysCount: days.length,
        instructorName: instructor ?? "",
        isGuestInstructor: !event.instructorId,
        stage: event.status === "canceled" ? ("canceled" as const) : eventStage(days, today),
        confirmedCount: confirmed.length,
        waitlistCount: regs.filter((r) => r.status === "waitlist").length,
        canceledCount: regs.filter((r) => r.status === "canceled").length,
        attendancePercent: slots > 0 ? Math.round((Math.min(presences, slots) / slots) * 100) : null,
        receivedCents,
        openCents: sum(charges.filter((c) => c.status === "pending" || c.status === "overdue").map((c) => c.amountCents)),
        expensesCents: sum(entries.filter((e) => e.type === "expense").map((e) => e.amountCents)),
        resultCents: receivedCents + paidIncome - paidExpenses,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => (a.firstDate ?? "").localeCompare(b.firstDate ?? "") || a.name.localeCompare(b.name, "pt-BR"));

  const data: EventsReportData = {
    header: buildHeader(periodLabel),
    eventsCount: events.length,
    confirmedTotal: sum(events.map((e) => e.confirmedCount)),
    receivedCents: sum(events.map((e) => e.receivedCents)),
    openCents: sum(events.map((e) => e.openCents)),
    expensesCents: sum(events.map((e) => e.expensesCents)),
    resultCents: sum(events.map((e) => e.resultCents)),
    events,
  };
  return { type: "events_summary", data };
}
