import type { ChargeKind, OnlinePaymentMethod, OnlinePaymentSettings, StudentGuardian } from "@gestarahub/contracts";
import { resolveSpaceTimeZone, todayISO } from "@gestarahub/core/date";
import { whatsappDigits } from "@gestarahub/core/phone";
import { resolveOnlinePayer } from "@gestarahub/core/payer";
import { maskCpf, maskPersonName } from "@gestarahub/core/privacy";
import {
  availableOnlineMethods,
  calculateOnlineChargeAmounts,
  defaultPassFeeFor,
  effectiveGatewayFees,
  type PlatformTier,
} from "@gestarahub/core/payment-fees";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logWarn } from "@/lib/log";
import { effectivePlatformSplitCents } from "@/services/payments/platformSplit";

/**
 * Pagina publica da cobranca online (/p/<codigo>, migracao 35). Sem login: le
 * pela chave de servico so o que a pagina mostra (nome do espaco, o que e
 * cobrado, valor, validade e o Pix ou o link), nunca dados do aluno. Modulo so
 * do servidor, sem "use server".
 */

export type PaymentPageState = "open" | "paid" | "expired";

export interface PaymentPageView {
  state: PaymentPageState;
  /** Espaco (logo do comprovante em PDF); nao vai para a tela. */
  organizationId: string;
  organizationName: string;
  /** Fuso do espaco: validade e data do pagamento no horario de quem cobra. */
  timeZone: string;
  /** O que e cobrado: "Mensalidade", "Aula avulsa", "Curso Confeitaria"... */
  label: string;
  amountCents: number;
  method: OnlinePaymentMethod;
  expiresAt: string;
  pixCopyPaste?: string;
  linkUrl?: string;
  /** Codigo curto da pagina: referencia para falar com o espaco. */
  code: string;
  /** So quando paga: dados do pagamento (nunca do aluno). */
  paid?: {
    paidAt?: string;
    /** "Pix", "Cartão de crédito"... ou "Registrado pelo espaço" (baixa manual). */
    methodLabel: string;
    /** Mes da mensalidade ("out/2026"), quando houver. */
    competenceLabel?: string;
    receiptUrl?: string;
    /** Taxa repassada ao aluno: o valor da cobranca e a taxa somada a ele. */
    breakdown?: { baseCents: number; feeCents: number };
  };
  /** WhatsApp do espaco (telefone da unidade), para duvidas. */
  contactWhatsapp?: string;
}

export const PAID_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  creditCard: "Cartão de crédito",
  debitCard: "Cartão de débito",
  boleto: "Boleto",
};

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" -> "out/2026" (curto: cabe numa linha ao lado do rotulo). */
export function competenceLabelOf(competence: string | null | undefined): string | undefined {
  const match = /^(\d{4})-(\d{2})/.exec(competence ?? "");
  if (!match) return undefined;
  const month = MONTHS_SHORT[Number(match[2]) - 1];
  return month ? `${month}/${match[1]}` : undefined;
}

/** Formato do codigo gerado pelo app (`newPublicCode`) e do preenchimento da migracao. */
const CODE_RE = /^[A-Za-z0-9]{8,20}$/;

/** O que e cobrado: "Mensalidade", "Curso Confeitaria"... (pagina, comprovante e recibo). */
export function chargeLabelOf(kind: ChargeKind, description: string | null): string {
  const what = description?.trim();
  switch (kind) {
    case "membership":
      return "Mensalidade";
    case "dropin":
      return "Aula avulsa";
    case "course":
      return what ? `Curso ${what}` : "Curso";
    case "package":
      return what ? (what.toLowerCase().startsWith("pacote") ? what : `Pacote ${what}`) : "Pacote de aulas";
    default:
      return what || "Cobrança";
  }
}

/** Dados da pagina pelo codigo; marca a primeira abertura. Codigo desconhecido: null. */
export async function loadPaymentPage(code: string, now = new Date()): Promise<PaymentPageView | null> {
  if (!CODE_RE.test(code)) return null;
  const admin = createSupabaseAdminClient();
  const { data: payment } = await admin
    .from("online_payments")
    .select(
      "id, organization_id, charge_id, method, status, amount_cents, pix_copy_paste, link_url, expires_at, opened_at, paid_at, paid_method, receipt_url, fee_passed_to_customer",
    )
    .eq("public_code", code)
    .maybeSingle();
  if (!payment) return null;

  const [{ data: org }, { data: charge }, { data: units }] = await Promise.all([
    admin.from("organizations").select("name, settings").eq("id", payment.organization_id).maybeSingle(),
    admin
      .from("charges")
      .select("kind, description, status, competence, paid_at, paid_via, amount_cents")
      .eq("id", payment.charge_id)
      .maybeSingle(),
    admin
      .from("units")
      .select("phone, address")
      .eq("organization_id", payment.organization_id)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  if (!payment.opened_at) {
    await admin
      .from("online_payments")
      .update({ opened_at: now.toISOString() })
      .eq("id", payment.id)
      .is("opened_at", null);
  }

  const paid = payment.status === "paid" || charge?.status === "paid";
  const gone =
    payment.status === "expired" ||
    payment.status === "canceled" ||
    new Date(String(payment.expires_at)) <= now ||
    charge?.status === "canceled";

  // Com a taxa repassada, o aluno pagou mais que a cobranca: mostra as duas partes.
  const feeBreakdown = () => {
    const paidCents = Number(payment.amount_cents) || 0;
    const baseCents = Number(charge?.amount_cents) || 0;
    if (!payment.fee_passed_to_customer || baseCents <= 0 || paidCents <= baseCents) return undefined;
    return { baseCents, feeCents: paidCents - baseCents };
  };
  // Pago por este codigo: dados do parceiro. Pago de outro jeito (baixa manual,
  // outro codigo): so o que a cobranca registrou.
  const paidHere = payment.status === "paid";
  const paidInfo = paid
    ? {
        paidAt: String((paidHere ? payment.paid_at : charge?.paid_at) ?? "") || undefined,
        methodLabel: paidHere
          ? (PAID_METHOD_LABEL[String(payment.paid_method ?? payment.method)] ??
            (payment.method === "pix" ? "Pix" : "Pagamento online"))
          : charge?.paid_via === "manual"
            ? "Registrado pelo espaço"
            : "Pagamento online",
        competenceLabel: charge?.kind === "membership" ? competenceLabelOf(charge?.competence as string | null) : undefined,
        receiptUrl: paidHere && payment.receipt_url ? String(payment.receipt_url) : undefined,
        breakdown: feeBreakdown(),
      }
    : undefined;
  const contactWhatsapp = whatsappDigits((units?.[0]?.phone as string | undefined) ?? undefined) ?? undefined;

  return {
    organizationId: String(payment.organization_id),
    code,
    paid: paidInfo,
    contactWhatsapp,
    state: paid ? "paid" : gone ? "expired" : "open",
    organizationName: String(org?.name ?? "o espaço"),
    timeZone: resolveSpaceTimeZone(org?.settings as { timeZone?: string } | null, units?.[0]?.address),
    label: chargeLabelOf((charge?.kind ?? "extra") as ChargeKind, (charge?.description as string | null) ?? null),
    amountCents: Number(payment.amount_cents) || 0,
    method: payment.method as OnlinePaymentMethod,
    expiresAt: new Date(String(payment.expires_at)).toISOString(),
    pixCopyPaste: payment.pix_copy_paste ? String(payment.pix_copy_paste) : undefined,
    linkUrl: payment.link_url ? String(payment.link_url) : undefined,
  };
}

export interface ChargeInvoiceView {
  state: "open" | "paid" | "canceled" | "unavailable";
  chargeId: string;
  organizationId: string;
  organizationName: string;
  timeZone: string;
  label: string;
  amountCents: number;
  dueDate: string;
  /** Rota publica: nome e CPF sempre mascarados ("Ana S.", "***.982.247-**"). */
  studentName: string;
  hasPayerCpf: boolean;
  payerName: string;
  payerCpfMasked?: string;
  contactWhatsapp?: string;
  existingPayment?: {
    method: OnlinePaymentMethod;
    pixCopyPaste?: string;
    linkUrl?: string;
    publicCode?: string;
    expiresAt: string;
    /** O que este codigo cobra (achado V11 de 31/10/2026: a tela mostrava o valor da regra padrao). */
    amountCents?: number;
  };
  acceptedMethods: OnlinePaymentMethod[];
  amountsByMethod: Partial<Record<OnlinePaymentMethod, number>>;
  passFeeByMethod: Partial<Record<OnlinePaymentMethod, boolean>>;
  /** Cobranca de inscricao em evento: o codigo do ingresso, para o "Ver ingresso" (12/11/2026). */
  ticketCode?: string;
}

/**
 * Fatura pública da cobrança (/p/c/<id>):
 * Permite ao aluno visualizar a fatura, conferir ou inserir o CPF e gerar Pix/Cartão na hora.
 */
export async function loadChargeInvoice(
  chargeId: string,
  now = new Date(),
): Promise<ChargeInvoiceView | null> {
  if (!chargeId || typeof chargeId !== "string") return null;

  const admin = createSupabaseAdminClient();
  let charge: Record<string, unknown> | null = null;
  let org: Record<string, unknown> | null = null;
  let client: Record<string, unknown> | null = null;
  let units: Record<string, unknown>[] | null = null;
  let existingPaymentRow: Record<string, unknown> | null = null;
  let ticketCode: string | undefined;

  try {
    const [chargeRes, existingRes] = await Promise.all([
      admin
        .from("charges")
        .select("id, organization_id, student_id, amount_cents, due_date, status, kind, description, paid_at, paid_via, event_registration_id")
        .eq("id", chargeId)
        .maybeSingle(),
      admin
        .from("online_payments")
        .select("id, method, status, pix_copy_paste, link_url, public_code, expires_at, amount_cents")
        .eq("charge_id", chargeId)
        .eq("status", "awaiting")
        .gt("expires_at", now.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    charge = (chargeRes.data as Record<string, unknown> | null) ?? null;
    existingPaymentRow = (existingRes.data as Record<string, unknown> | null) ?? null;

    if (charge) {
      const registrationId = charge.event_registration_id as string | null | undefined;
      const [orgRes, clientRes, unitsRes, registrationRes] = await Promise.all([
        admin
          .from("organizations")
          .select("id, name, settings, subscription, gateway_api_key")
          .eq("id", charge.organization_id)
          .maybeSingle(),
        admin
          .from("clients")
          .select("id, name, cpf, phone, email, birth_date, guardians")
          .eq("id", charge.student_id)
          .maybeSingle(),
        admin
          .from("units")
          .select("phone, address")
          .eq("organization_id", charge.organization_id)
          .order("created_at", { ascending: true })
          .limit(1),
        registrationId
          ? admin.from("event_registrations").select("ticket_code").eq("id", registrationId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      ticketCode = (registrationRes.data as { ticket_code?: string | null } | null)?.ticket_code ?? undefined;
      org = (orgRes.data as Record<string, unknown> | null) ?? null;
      client = (clientRes.data as Record<string, unknown> | null) ?? null;
      units = (unitsRes.data as Record<string, unknown>[] | null) ?? null;
    }
  } catch (err) {
    logWarn("[loadChargeInvoice] Falha ao consultar a cobrança no banco:", err);
  }

  if (!charge) return null;

  const orgSettings = (org?.settings as Record<string, unknown> | null) ?? {};
  const onlineSettings = (orgSettings.onlinePayments as OnlinePaymentSettings | null) ?? undefined;
  const isOnlineEnabled = Boolean(onlineSettings?.enabled);

  const contactWhatsapp = whatsappDigits((units?.[0]?.phone as string | undefined) ?? undefined) ?? undefined;
  const timeZone = resolveSpaceTimeZone(org?.settings as { timeZone?: string } | null, units?.[0]?.address as string | undefined);
  const label = chargeLabelOf((charge?.kind ?? "extra") as ChargeKind, (charge?.description as string | null) ?? null);

  if (charge.status === "paid") {
    return {
      state: "paid",
      chargeId: String(charge.id),
      organizationId: String(charge.organization_id),
      organizationName: String(org?.name ?? "o espaço"),
      timeZone,
      label,
      amountCents: Number(charge.amount_cents) || 0,
      dueDate: String(charge.due_date),
      studentName: maskPersonName(String(client?.name ?? "Aluno")),
      hasPayerCpf: true,
      payerName: maskPersonName(String(client?.name ?? "Aluno")),
      contactWhatsapp,
      acceptedMethods: [],
      amountsByMethod: {},
      passFeeByMethod: {},
      ...(ticketCode ? { ticketCode } : {}),
    };
  }

  if (charge.status === "canceled") {
    return {
      state: "canceled",
      chargeId: String(charge.id),
      organizationId: String(charge.organization_id),
      organizationName: String(org?.name ?? "o espaço"),
      timeZone,
      label,
      amountCents: Number(charge.amount_cents) || 0,
      dueDate: String(charge.due_date),
      studentName: maskPersonName(String(client?.name ?? "Aluno")),
      hasPayerCpf: true,
      payerName: maskPersonName(String(client?.name ?? "Aluno")),
      contactWhatsapp,
      acceptedMethods: [],
      amountsByMethod: {},
      passFeeByMethod: {},
      ...(ticketCode ? { ticketCode } : {}),
    };
  }

  if (!isOnlineEnabled) {
    return {
      state: "unavailable",
      chargeId: String(charge.id),
      organizationId: String(charge.organization_id),
      organizationName: String(org?.name ?? "o espaço"),
      timeZone,
      label,
      amountCents: Number(charge.amount_cents) || 0,
      dueDate: String(charge.due_date),
      studentName: maskPersonName(String(client?.name ?? "Aluno")),
      hasPayerCpf: false,
      payerName: maskPersonName(String(client?.name ?? "Aluno")),
      contactWhatsapp,
      acceptedMethods: [],
      amountsByMethod: {},
      passFeeByMethod: {},
      ...(ticketCode ? { ticketCode } : {}),
    };
  }

  // Payer resolution
  const payerClient = client
    ? {
        name: String(client.name || ""),
        cpf: client.cpf ? String(client.cpf) : undefined,
        phone: client.phone ? String(client.phone) : "",
        email: client.email ? String(client.email) : undefined,
        birthDate: client.birth_date ? String(client.birth_date) : undefined,
        guardians: (client.guardians as StudentGuardian[] | undefined) ?? undefined,
      }
    : { name: "Aluno", cpf: undefined, phone: "", email: undefined, birthDate: undefined, guardians: undefined };

  const payerResult = resolveOnlinePayer(payerClient, todayISO());
  const hasPayerCpf = payerResult.ok;
  const payerName = payerResult.ok ? payerResult.payer.name : payerClient.name;
  const rawCpf = payerResult.ok ? payerResult.payer.cpf : "";
  const payerCpfMasked = maskCpf(rawCpf);

  // Available methods & amounts calculation
  const acceptedMethods = availableOnlineMethods(onlineSettings).filter((m) => m !== "choice");
  const tier = ((org?.subscription as Record<string, unknown> | null)?.tier as PlatformTier | undefined) ?? "free";
  const splitAmountCents = effectivePlatformSplitCents(tier);
  const fees = effectiveGatewayFees(onlineSettings?.gatewayFees, todayISO());

  const amountsByMethod: Partial<Record<OnlinePaymentMethod, number>> = {};
  const passFeeByMethod: Partial<Record<OnlinePaymentMethod, boolean>> = {};

  const baseAmount = Number(charge.amount_cents) || 0;
  for (const method of acceptedMethods) {
    const passFee = defaultPassFeeFor(onlineSettings, method);
    const calc = calculateOnlineChargeAmounts({
      amountCents: baseAmount,
      method,
      splitAmountCents,
      passFee,
      fees,
    });
    amountsByMethod[method] = calc.chargedAmountCents;
    passFeeByMethod[method] = passFee;
  }

  let existingPayment: ChargeInvoiceView["existingPayment"] = undefined;
  if (existingPaymentRow) {
    existingPayment = {
      method: existingPaymentRow.method as OnlinePaymentMethod,
      pixCopyPaste: existingPaymentRow.pix_copy_paste ? String(existingPaymentRow.pix_copy_paste) : undefined,
      linkUrl: existingPaymentRow.link_url ? String(existingPaymentRow.link_url) : undefined,
      publicCode: existingPaymentRow.public_code ? String(existingPaymentRow.public_code) : undefined,
      expiresAt: new Date(String(existingPaymentRow.expires_at)).toISOString(),
      amountCents: Number(existingPaymentRow.amount_cents) || undefined,
    };
  }

  return {
    state: "open",
    chargeId: String(charge.id),
    organizationId: String(charge.organization_id),
    organizationName: String(org?.name ?? "o espaço"),
    timeZone,
    label,
    amountCents: baseAmount,
    dueDate: String(charge.due_date),
    studentName: maskPersonName(payerClient.name),
    hasPayerCpf,
    payerName: maskPersonName(payerName),
    payerCpfMasked,
    contactWhatsapp,
    existingPayment,
    acceptedMethods,
    amountsByMethod,
    passFeeByMethod,
    ...(ticketCode ? { ticketCode } : {}),
  };
}
