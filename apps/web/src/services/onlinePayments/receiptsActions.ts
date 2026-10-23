"use server";

import { selectAllRows } from "@/lib/supabase/select-all";
import type { OnlinePayment } from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";
import { expireDueOnlinePayments } from "./gateway";

/**
 * Extrato de recebimentos online da subconta (filtros, resumo e paginas).
 */

export interface SubaccountReceiptItem {
  id: string;
  chargeId: string;
  method: string;
  status: string;
  amountCents: number;
  splitAmountCents: number;
  /** Tarifa do Asaas: real depois do pagamento (webhook), estimada antes. */
  gatewayFeeCents: number;
  /** Meio usado pelo aluno, quando o Asaas informou. */
  paidMethod?: OnlinePayment["paidMethod"];
  netAmountCents: number;
  feePassedToCustomer?: boolean;
  paidAt?: string;
  createdAt: string;
  canceledReason?: string;
  /** Dia em que o valor fica (ou ficou) disponivel para saque. */
  creditDate?: string;
  /** Pago e ja disponivel; pago e false = a liberar (cartao). */
  fundsReleased: boolean;
}

/** Situacao no filtro do historico. "open" = pagas e aguardando (padrao). */
export type ReceiptStatusFilter = "open" | "paid" | "awaiting" | "canceled" | "all";

export interface SubaccountReceiptsQuery {
  organizationId: string;
  /**
   * Periodo "AAAA-MM-DD" (inclusive, horario de Brasilia), pela data do
   * pagamento ou, se nao pago, da criacao. Sem `from` e `to`: todo o periodo.
   */
  from?: string;
  to?: string;
  status: ReceiptStatusFilter;
  method: "all" | OnlinePayment["method"];
  page: number;
  pageSize: number;
}

export interface SubaccountReceiptsSummary {
  count: number;
  /** So os pagos: o que os alunos pagaram, as taxas e o que entrou. */
  paidCount: number;
  grossCents: number;
  feeCents: number;
  netCents: number;
  /** Do liquido pago: o que ja esta disponivel e o que ainda vai liberar. */
  releasedNetCents: number;
  pendingNetCents: number;
}

export interface SubaccountReceiptsPage {
  items: SubaccountReceiptItem[];
  total: number;
  summary: SubaccountReceiptsSummary;
}

const STATUS_FILTER_VALUES: Record<ReceiptStatusFilter, string[] | null> = {
  open: ["paid", "awaiting"],
  paid: ["paid"],
  awaiting: ["awaiting"],
  canceled: ["canceled", "expired"],
  all: null,
};

/** Dia "AAAA-MM-DD" no horario de Brasilia: inicio, em ISO UTC. */
function startOfDayInBrazil(date: string): string {
  return new Date(`${date}T00:00:00-03:00`).toISOString();
}

/** Dia seguinte a "AAAA-MM-DD" (fim exclusivo do intervalo). */
function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Historico de movimentacoes da subconta (Recebimentos online), filtrado no
 * banco: mes, situacao e forma, com paginacao e os totais do filtro. Le com o
 * cliente do usuario (RLS da organizacao), nao com a chave de servico.
 */
export async function listSubaccountReceiptsAction(
  query: SubaccountReceiptsQuery,
): Promise<SubaccountReceiptsPage> {
  const client = await getClientForTenant();
  // Vencidas pela validade: expira aqui e exclui no Asaas antes de listar.
  await expireDueOnlinePayments(query.organizationId).catch((err) =>
    console.error("[listSubaccountReceiptsAction] Erro ao expirar cobranças vencidas:", err),
  );
  const statuses = STATUS_FILTER_VALUES[query.status];

  // Mesmo filtro para a pagina e para os totais.
  // Intervalo aberto de um lado tambem vale (so "de" ou so "ate").
  let period: string | null = null;
  if (query.from || query.to) {
    const from = query.from ? startOfDayInBrazil(query.from) : null;
    const to = query.to ? startOfDayInBrazil(nextDay(query.to)) : null;
    const on = (col: string) =>
      [from ? `${col}.gte.${from}` : null, to ? `${col}.lt.${to}` : null].filter(Boolean).join(",");
    period = `and(${on("paid_at")}),and(paid_at.is.null,${on("created_at")})`;
  }
  const offset = (query.page - 1) * query.pageSize;

  let pageQuery = client
    .from("online_payments")
    .select(
      `
      id, charge_id, method, status, amount_cents, split_amount_cents, gateway_fee_cents, paid_method, net_amount_cents, fee_passed_to_customer, paid_at, created_at, canceled_reason, credit_date, funds_released,
      charges (
        status, paid_via
      )
      `,
      { count: "exact" },
    )
    .eq("organization_id", query.organizationId);
  // Totais do filtro inteiro: todas as paginas (a consulta para em 1.000 linhas; doc 19, fase 0).
  const totalsQuery = () => {
    let totals = client
      .from("online_payments")
      .select("status, amount_cents, split_amount_cents, gateway_fee_cents, net_amount_cents, funds_released")
      .eq("organization_id", query.organizationId);
    if (period) totals = totals.or(period);
    if (statuses) totals = totals.in("status", statuses);
    if (query.method !== "all") totals = totals.eq("method", query.method);
    return totals;
  };
  if (period) pageQuery = pageQuery.or(period);
  if (statuses) pageQuery = pageQuery.in("status", statuses);
  if (query.method !== "all") pageQuery = pageQuery.eq("method", query.method);

  const [pageRes, totalsRes] = await Promise.all([
    pageQuery.order("created_at", { ascending: false }).range(offset, offset + query.pageSize - 1),
    selectAllRows(totalsQuery),
  ]);

  const empty: SubaccountReceiptsPage = {
    items: [],
    total: 0,
    summary: { count: 0, paidCount: 0, grossCents: 0, feeCents: 0, netCents: 0, releasedNetCents: 0, pendingNetCents: 0 },
  };
  if (pageRes.error || !pageRes.data) {
    console.error("[listSubaccountReceiptsAction] Erro ao listar recebimentos:", pageRes.error);
    return empty;
  }

  const summary = (totalsRes.data ?? []).reduce<SubaccountReceiptsSummary>(
    (acc, r) => {
      acc.count += 1;
      if (r.status === "paid") {
        acc.paidCount += 1;
        acc.grossCents += Number(r.amount_cents) || 0;
        acc.feeCents += (Number(r.gateway_fee_cents) || 0) + (Number(r.split_amount_cents) || 0);
        acc.netCents += Number(r.net_amount_cents) || 0;
        if (r.funds_released) acc.releasedNetCents += Number(r.net_amount_cents) || 0;
        else acc.pendingNetCents += Number(r.net_amount_cents) || 0;
      }
      return acc;
    },
    { ...empty.summary },
  );

  const items = pageRes.data.map((r) => {
    const charge = Array.isArray(r.charges) ? r.charges[0] : (r.charges as { status?: string; paid_via?: string } | null);
    let canceledReason = r.canceled_reason ? String(r.canceled_reason) : undefined;
    if (String(r.status) === "canceled" && !canceledReason) {
      if (charge?.status === "paid") {
        canceledReason = charge.paid_via === "manual" ? "Baixa manual da cobrança" : "Pago por outro código";
      } else if (charge?.status === "canceled") {
        canceledReason = "Cobrança cancelada";
      } else {
        canceledReason = "Substituído por novo código";
      }
    }

    return {
      id: String(r.id),
      chargeId: String(r.charge_id),
      method: String(r.method),
      status: String(r.status),
      amountCents: Number(r.amount_cents) || 0,
      splitAmountCents: Number(r.split_amount_cents) || 0,
      gatewayFeeCents: Number(r.gateway_fee_cents) || 0,
      paidMethod: (r.paid_method as SubaccountReceiptItem["paidMethod"]) ?? undefined,
      netAmountCents: Number(r.net_amount_cents) || 0,
      feePassedToCustomer: Boolean(r.fee_passed_to_customer),
      paidAt: r.paid_at ? String(r.paid_at) : undefined,
      createdAt: String(r.created_at),
      canceledReason,
      creditDate: r.credit_date ? String(r.credit_date).slice(0, 10) : undefined,
      fundsReleased: Boolean(r.funds_released),
    };
  });

  return { items, total: pageRes.count ?? items.length, summary };
}
