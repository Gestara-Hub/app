import type { ChargeKind, OnlinePaymentMethod } from "@gestarahub/contracts";
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
  organizationName: string;
  /** O que e cobrado: "Mensalidade", "Aula avulsa", "Curso Confeitaria"... */
  label: string;
  amountCents: number;
  method: OnlinePaymentMethod;
  expiresAt: string;
  pixCopyPaste?: string;
  pixQrCodeBase64?: string;
  linkUrl?: string;
}

/** Formato do codigo gerado pelo app (`newPublicCode`) e do preenchimento da migracao. */
const CODE_RE = /^[A-Za-z0-9]{8,20}$/;

function labelOf(kind: ChargeKind, description: string | null): string {
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
      "id, organization_id, charge_id, method, status, amount_cents, pix_copy_paste, pix_qr_code_base64, link_url, expires_at, opened_at",
    )
    .eq("public_code", code)
    .maybeSingle();
  if (!payment) return null;

  const [{ data: org }, { data: charge }] = await Promise.all([
    admin.from("organizations").select("name").eq("id", payment.organization_id).maybeSingle(),
    admin.from("charges").select("kind, description, status").eq("id", payment.charge_id).maybeSingle(),
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

  return {
    state: paid ? "paid" : gone ? "expired" : "open",
    organizationName: String(org?.name ?? "o espaço"),
    label: labelOf((charge?.kind ?? "extra") as ChargeKind, (charge?.description as string | null) ?? null),
    amountCents: Number(payment.amount_cents) || 0,
    method: payment.method as OnlinePaymentMethod,
    expiresAt: new Date(String(payment.expires_at)).toISOString(),
    pixCopyPaste: payment.pix_copy_paste ? String(payment.pix_copy_paste) : undefined,
    pixQrCodeBase64: payment.pix_qr_code_base64 ? String(payment.pix_qr_code_base64) : undefined,
    linkUrl: payment.link_url ? String(payment.link_url) : undefined,
  };
}
