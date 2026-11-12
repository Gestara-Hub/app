import type { Id, PublicTicketView } from "@gestarahub/contracts";
import { can } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { maskPersonName } from "@gestarahub/core/privacy";
import { dateInSpace } from "@gestarahub/core/date";
import { forgetCachedWorld, runInWorld } from "@/services/world/runWorld";
import { store } from "@/services/world/store";
import { normalizeTicketCode } from "@/services/events/eventCheckInService";
import { findEvent, registrationCoversDay } from "@/services/events/eventShared";
import { systemTenantContext } from "./systemContext";
import { requireTenant } from "./tenant";

/**
 * Ingresso aberto pelo QR (doc product/29 T2 e T3): sem login, so dados
 * mascarados e nenhuma gravacao. Quem e da equipe, logado no mesmo espaco e
 * com a chamada (`attendance:mark`), recebe tambem o dia de hoje para
 * confirmar a entrada (T4). Modulo so do servidor.
 */

async function findTicket(code: string): Promise<{ id: string; organizationId: string; eventId: string } | null> {
  const normalized = normalizeTicketCode(code);
  if (!/^[A-Z0-9]{8,32}$/.test(normalized)) return null;
  const { data } = await createSupabaseAdminClient()
    .from("event_registrations")
    .select("id, organization_id, event_id")
    .eq("ticket_code", normalized)
    .maybeSingle();
  return data ? { id: String(data.id), organizationId: String(data.organization_id), eventId: String(data.event_id) } : null;
}

function addressLine(address: unknown): string | undefined {
  if (!address || typeof address !== "object") return typeof address === "string" ? address : undefined;
  const a = address as Record<string, string | undefined>;
  const street = [a.street, a.number].filter(Boolean).join(", ");
  const place = [a.neighborhood, a.city && a.state ? `${a.city}/${a.state}` : a.city].filter(Boolean).join(", ");
  return [street, place].filter(Boolean).join(" · ") || undefined;
}

export interface TicketPageData {
  ticket: PublicTicketView;
  /** Equipe logada no mesmo espaco, com a chamada: o dia de hoje do evento (se houver). */
  staff?: { sessionId: Id | null };
}

export async function loadTicketPage(code: string): Promise<TicketPageData | null> {
  const found = await findTicket(code);
  if (!found) return null;
  const admin = createSupabaseAdminClient();
  const { data: unit } = await admin.from("units").select("address").eq("organization_id", found.organizationId).limit(1).maybeSingle();
  const ctx = await systemTenantContext(found.organizationId, "Ingresso");
  const read = () =>
    runInWorld(ctx, async (): Promise<{ view: PublicTicketView; todaySession: Id | null } | null> => {
    const registration = (store.eventRegistrations ?? []).find((r) => r.id === found.id);
    // Inscricao recem-criada que o espaco em cache ainda nao tem: le de novo do banco.
    if (!registration) return null;
    const event = findEvent(registration.eventId);
    const student = store.clients.find((c) => c.id === registration.studentId);
    const days = (store.eventSessions ?? [])
      .filter((s) => s.eventId === event.id && s.status !== "canceled" && registrationCoversDay(registration, s.id))
      .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    const open = store.charges.some(
      (c) => c.eventRegistrationId === registration.id && (c.status === "pending" || c.status === "overdue") && c.amountCents > 0,
    );
    const instructors = event.instructors.map((i) =>
      i.professionalId ? (store.professionals.find((p) => p.id === i.professionalId)?.name ?? "") : (i.guestName ?? ""),
    );
    const today = dateInSpace(new Date(), ctx.timeZone);
    const state: PublicTicketView["state"] =
      registration.status === "confirmed" ? (open ? "payment_pending" : "confirmed") : registration.status;
    return {
      view: {
        code: registration.ticketCode ?? "",
        organizationName: store.organization.name,
        eventName: event.name,
        holderName: maskPersonName(student?.name ?? ""),
        days: days.map((s) => ({ date: s.date, start: s.start, end: s.end })),
        ...(addressLine(unit?.address) ? { address: addressLine(unit?.address) } : {}),
        instructors: instructors.filter(Boolean),
        state,
      },
      todaySession: days.find((s) => s.date === today)?.id ?? null,
    };
    });
  let ticket = await read();
  if (!ticket) {
    forgetCachedWorld(found.organizationId);
    ticket = await read();
  }
  if (!ticket) return null;

  // Equipe logada no mesmo espaco com a chamada: pode confirmar a entrada aqui.
  let staff: TicketPageData["staff"];
  try {
    const tenant = await requireTenant();
    if (tenant.organizationId === found.organizationId && can(tenant.profile, "attendance:mark")) {
      staff = { sessionId: ticket.todaySession };
    }
  } catch {
    // Sem sessao: a pagina publica, so o cartao.
  }
  return { ticket: ticket.view, ...(staff ? { staff } : {}) };
}
