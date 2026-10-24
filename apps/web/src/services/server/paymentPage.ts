import type { ChargeKind, OnlinePaymentMethod } from "@gestarahub/contracts";
import { resolveSpaceTimeZone } from "@gestarahub/core/date";
import { whatsappDigits } from "@gestarahub/core/phone";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
