import type {
  Address,
  Event,
  EventInstructor,
  PublicEventSignupInput,
  PublicEventSignupResult,
  PublicEventView,
  PublicSignupClosedReason,
} from "@gestarahub/contracts";
import { isApiError } from "@gestarahub/contracts";
import { apiError } from "@gestarahub/core/api-error";
import { activeDays, earlyBirdActive, eventStage, suggestedRegistrationPrice } from "@gestarahub/core/events";
import { dateInSpace, resolveSpaceTimeZone } from "@gestarahub/core/date";
import { maskPersonName } from "@gestarahub/core/privacy";
import { sameName } from "@/lib/text";
import { whatsappNumber } from "@/lib/whatsapp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { tierHasFeature, tierOf } from "@/lib/subscription";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { runInWorld } from "@/services/world/runWorld";
import { store } from "@/services/world/store";
import { nowIso } from "@/services/world/ops";
import { clientsServiceImpl } from "@/services/clients";
import { samePhone } from "@/services/communication/whatsappOptOut";
import { registerInWorld } from "@/services/events/eventRegistrationsService";
import { activeReservation, findEvent, seatHolders } from "@/services/events/eventShared";
import { systemTenantContext } from "./systemContext";
import { EVENT_SIGNUP_TERMS } from "@/lib/event-signup-terms";

/**
 * Inscricao em evento por link publico (doc product/29, aprovada em 12/11/2026).
 * Excecao controlada a regra das paginas publicas (doc 24 §6): a pagina so
 * CRIA (aluno visitante novo e a inscricao), nunca muda um cadastro existente,
 * e nao devolve dado de aluno. Telefone de um aluno ativo do espaco liga a
 * inscricao a ele sem tocar no cadastro. Modulo so do servidor.
 */


const SPOTS_HINT = 5;
const MAX = { name: 120, phone: 20, email: 160 };

interface EventRow {
  id: string;
  organization_id: string;
}

async function findEventByCode(code: string): Promise<EventRow | null> {
  if (!/^[a-z0-9]{8,32}$/.test(code)) return null;
  const { data } = await createSupabaseAdminClient()
    .from("events")
    .select("id, organization_id")
    .eq("public_signup->>code", code)
    .maybeSingle();
  return (data as EventRow | null) ?? null;
}

function addressLine(address: unknown): string | undefined {
  if (!address || typeof address !== "object") return typeof address === "string" ? address : undefined;
  const a = address as Partial<Address>;
  const street = [a.street, a.number].filter(Boolean).join(", ");
  const place = [a.neighborhood, a.city && a.state ? `${a.city}/${a.state}` : a.city].filter(Boolean).join(", ");
  return [street, a.complement, place].filter(Boolean).join(" · ") || undefined;
}

function instructorName(instructor: EventInstructor): string {
  if (instructor.professionalId) return store.professionals.find((p) => p.id === instructor.professionalId)?.name ?? "";
  return instructor.guestName ?? "";
}

/** Por que o link nao aceita agora (dentro do espaco carregado). */
function closedReason(event: Event, today: string, proPlan: boolean): PublicSignupClosedReason | undefined {
  if (!event.publicSignup?.enabled) return "disabled";
  if (!proPlan) return "plan";
  if (event.status === "canceled") return "canceled";
  if (eventStage((store.eventSessions ?? []).filter((s) => s.eventId === event.id), today) === "finished") return "finished";
  if (event.publicSignup.until && today > event.publicSignup.until) return "until";
  return undefined;
}

/** Monta a leitura publica dentro do espaco carregado (sem dado de aluno). */
function publicViewOf(event: Event, unitAddress: unknown, today: string): PublicEventView {
  const sessions = (store.eventSessions ?? [])
    .filter((s) => s.eventId === event.id && s.status !== "canceled")
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const proPlan = tierHasFeature(tierOf(store.organization), "event_signup");
  const reason = closedReason(event, today, proPlan);
  const taken = seatHolders(event.id).length;
  const left = event.capacity === undefined ? undefined : Math.max(0, event.capacity - taken);
  const instructorsById = new Map(event.instructors.map((i) => [i.id, instructorName(i)]));
  return {
    code: event.publicSignup?.code ?? "",
    organizationName: store.organization.name,
    eventName: event.name,
    ...(event.description ? { description: event.description } : {}),
    ...(event.modalityId ? { modalityName: store.categories.find((c) => c.id === event.modalityId)?.name } : {}),
    sessions: sessions.map((s) => ({
      id: s.id,
      date: s.date,
      start: s.start,
      end: s.end,
      instructors: (s.instructorIds?.length ? s.instructorIds : event.instructors.map((i) => i.id))
        .map((id) => instructorsById.get(id) ?? "")
        .filter(Boolean),
    })),
    instructors: event.instructors.map((i) => ({
      name: instructorName(i),
      isGuest: !i.professionalId,
      ...(i.guestOrigin ? { origin: i.guestOrigin } : {}),
    })),
    ...(addressLine(unitAddress) ? { address: addressLine(unitAddress) } : {}),
    billingMode: event.billingMode,
    priceCents: suggestedRegistrationPrice(event, "full", activeDays(sessions).length, today),
    ...(event.dayPriceCents ? { dayPriceCents: event.dayPriceCents } : {}),
    ...(event.earlyBirdPriceCents && event.earlyBirdUntil && earlyBirdActive(event, today)
      ? { earlyBird: { priceCents: event.earlyBirdPriceCents, until: event.earlyBirdUntil } }
      : {}),
    seatGuarantee: event.seatGuarantee ?? "on_signup",
    holdMinutes: event.holdMinutes ?? 30,
    onlinePayments: Boolean(store.organization.settings?.onlinePayments?.enabled),
    ...(left !== undefined && left > 0 && left <= SPOTS_HINT ? { spotsLeft: left } : {}),
    isFull: left === 0,
    open: reason === undefined,
    ...(reason ? { closedReason: reason } : {}),
  };
}

async function unitAddressOf(organizationId: string): Promise<{ address: unknown; today: string }> {
  const admin = createSupabaseAdminClient();
  const [{ data: unit }, { data: org }] = await Promise.all([
    admin.from("units").select("address").eq("organization_id", organizationId).limit(1).maybeSingle(),
    admin.from("organizations").select("settings").eq("id", organizationId).maybeSingle(),
  ]);
  const zone = resolveSpaceTimeZone(org?.settings as { timeZone?: string } | undefined, unit?.address);
  return { address: unit?.address, today: dateInSpace(new Date(), zone) };
}

/** A pagina publica do evento. `null`: codigo que nao existe. */
export async function loadPublicEvent(code: string): Promise<PublicEventView | null> {
  const row = await findEventByCode(code);
  if (!row) return null;
  const { address, today } = await unitAddressOf(row.organization_id);
  const ctx = await systemTenantContext(row.organization_id, "Inscrição pelo link");
  return runInWorld(ctx, async () => publicViewOf(findEvent(row.id), address, today));
}

const tooLong = (value: string | undefined, max: number) => (value ?? "").trim().length > max;

/**
 * Inscreve pelo link. Travas: campo-armadilha, tamanho dos textos, telefone com
 * DDD, aceite, 10 inscricoes por IP por hora e 3 por telefone por evento por hora.
 */
export async function submitPublicEventSignup(
  input: PublicEventSignupInput,
  meta: { ip: string; userAgent?: string },
): Promise<PublicEventSignupResult> {
  if (input.website) throw apiError("VALIDATION", "Não foi possível concluir a inscrição.", { httpStatus: 422 });
  const name = (input.name ?? "").trim();
  const phone = whatsappNumber(input.phone);
  const fields = [];
  if (name.length < 2 || tooLong(name, MAX.name)) fields.push({ field: "name", message: "Informe o nome." });
  if (!phone || tooLong(input.phone, MAX.phone)) fields.push({ field: "phone", message: "Informe o WhatsApp com DDD." });
  if (tooLong(input.email, MAX.email)) fields.push({ field: "email", message: "Confira o e-mail." });
  const guardianPhone = input.isMinor ? whatsappNumber(input.guardianPhone) : null;
  if (input.isMinor) {
    if ((input.guardianName ?? "").trim().length < 2 || tooLong(input.guardianName, MAX.name)) {
      fields.push({ field: "guardianName", message: "Informe o nome do responsável." });
    }
    if (!guardianPhone) fields.push({ field: "guardianPhone", message: "Informe o WhatsApp do responsável com DDD." });
  }
  if (!input.acceptTerms) fields.push({ field: "acceptTerms", message: "Aceite para concluir a inscrição." });
  if (fields.length > 0) throw apiError("VALIDATION", "Confira os campos.", { httpStatus: 422, fields });

  if (!(await checkRateLimit({ key: `event_signup:ip:${meta.ip}`, maxRequests: 10, windowSeconds: 3600 }))) {
    throw apiError("VALIDATION", "Muitas inscrições deste aparelho. Aguarde alguns minutos.", { httpStatus: 429 });
  }
  const row = await findEventByCode(input.code);
  if (!row) throw apiError("NOT_FOUND", "Este link de inscrição não existe.", { httpStatus: 404 });
  if (!(await checkRateLimit({ key: `event_signup:phone:${row.id}:${phone}`, maxRequests: 3, windowSeconds: 3600 }))) {
    throw apiError("VALIDATION", "Muitas tentativas com este telefone. Aguarde alguns minutos.", { httpStatus: 429 });
  }

  const { today } = await unitAddressOf(row.organization_id);
  const ctx = await systemTenantContext(row.organization_id, "Inscrição pelo link");
  return runInWorld(ctx, async () => {
    const event = findEvent(row.id);
    const proPlan = tierHasFeature(tierOf(store.organization), "event_signup");
    const reason = closedReason(event, today, proPlan);
    if (reason) throw apiError("CONFLICT", "As inscrições deste evento estão encerradas.", { httpStatus: 409 });

    const at = nowIso();
    const evidence = {
      method: "event_signup_link",
      termsVersion: EVENT_SIGNUP_TERMS.version,
      text: input.isMinor ? EVENT_SIGNUP_TERMS.guardianText : EVENT_SIGNUP_TERMS.text,
      acceptedAt: at,
      acceptedBy: input.isMinor ? (input.guardianName ?? "").trim() : name,
      ip: meta.ip,
      ...(meta.userAgent ? { userAgent: meta.userAgent.slice(0, 200) } : {}),
      whatsapp: Boolean(input.acceptWhatsapp),
    };

    // Aluno ativo com o mesmo nome E o mesmo telefone: liga a inscricao sem
    // mexer no cadastro. So o telefone nao basta: quem digita o numero de outra
    // pessoa veria o nome dela na cobranca e entraria no historico dela. Nome
    // diferente vira um cadastro novo (a equipe junta depois, se for a mesma).
    const existing = input.isMinor
      ? undefined
      : store.clients.find((c) => c.status === "active" && samePhone(c.phone, phone) && sameName(c.name, name));
    let studentId = existing?.id;
    if (!studentId) {
      const created = await clientsServiceImpl.create({
        name,
        phone: input.isMinor ? undefined : `+${phone}`,
        ...(input.email?.trim() ? { email: input.email.trim() } : {}),
        status: "active",
        whatsappConsentStatus: input.acceptWhatsapp ? "granted" : "unknown",
        ...(input.isMinor
          ? {
              guardians: [
                { name: (input.guardianName ?? "").trim(), phone: `+${guardianPhone}`, relationship: "Responsável", financial: true },
              ],
            }
          : {}),
      });
      studentId = created.id;
      const stored = store.clients.find((c) => c.id === studentId)!;
      // Quem autorizou foi a pessoa, na pagina (nao a equipe): prova da inscricao.
      if (input.acceptWhatsapp) stored.whatsappConsentBy = "Na inscrição pelo link";
      if (input.isMinor) {
        stored.minorConsentStatus = "confirmed_whatsapp";
        stored.minorConsentAt = at;
        stored.minorConsentBy = (input.guardianName ?? "").trim();
        stored.minorConsentEvidence = evidence;
      }
    }

    let registration;
    try {
      registration = registerInWorld(
        { eventId: event.id, studentId, scope: input.scope ?? "full", sessionIds: input.sessionIds },
        {
          source: "public_link",
          signupEvidence: evidence,
          ...(event.seatGuarantee === "on_payment" ? { hold: { minutes: event.holdMinutes ?? 30 } } : {}),
        },
      );
    } catch (error) {
      // Ja inscrito: responde sem mostrar nada da inscricao (o ingresso a equipe reenvia).
      if (isApiError(error) && /já está inscrito/.test(error.message)) {
        return { status: "already" as const, amountCents: 0, displayName: maskPersonName(name) };
      }
      throw error;
    }
    const charge = store.charges.find(
      (c) => c.eventRegistrationId === registration.id && (c.status === "pending" || c.status === "overdue"),
    );
    const status = registration.status === "reserved" && activeReservation(registration) ? "reserved" : registration.status;
    return {
      status: status as PublicEventSignupResult["status"],
      ...(registration.status === "confirmed" && registration.ticketCode ? { ticketCode: registration.ticketCode } : {}),
      ...(charge ? { chargeId: charge.id } : {}),
      amountCents: registration.amountCents,
      ...(registration.holdUntil ? { holdUntil: registration.holdUntil } : {}),
      displayName: maskPersonName(name),
    };
  });
}
