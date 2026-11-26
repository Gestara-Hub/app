"use server";

import { afterResponse } from "@/lib/after-response";
import { selectAllRows } from "@/lib/supabase/select-all";
import type { OnlinePayment } from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";
import { expireDueOnlinePayments } from "./gateway";
import { logError, withErrorScope } from "@/lib/log";
import { startOfDayInSpace } from "@gestarahub/core/date";
import type { ChargeKind } from "@gestarahub/contracts";
import { chargeLabelOf, competenceLabelOf } from "../server/paymentPage";
import { likeExact } from "@/lib/supabase/like";

/**
 * Extrato de recebimentos online da subconta (filtros, resumo e paginas).
 */

export interface SubaccountReceiptItem {
  id: string;
  chargeId: string;
  /** Aluno e o que foi cobrado ("Mensalidade nov/2026", "Uniforme"), 26/11/2026. */
  studentId?: string;
  studentName?: string;
  chargeLabel?: string;
  /**
   * Ultimo acontecimento (estorno, pagamento ou criacao do codigo): a data
   * mostrada e a ordem da lista (coluna gerada `event_at`, migracao 111).
   */
  eventAt: string;
  /** Codigo em aberto: ate quando vale e se o aluno ja abriu a pagina. */
  expiresAt?: string;
  openedAt?: string;
  /** Acoes da linha (26/11/2026): pagina publica, link do parceiro, Pix, comprovante e o mes da cobranca. */
  publicCode?: string;
  linkUrl?: string;
  pixCopyPaste?: string;
  receiptUrl?: string;
  chargeMonth?: string;
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
  /** Estornado depois do pagamento (doc product/15, "Estorno de pagamento"): sai do Recebido. */
  refundStatus?: "refunded" | "refund_in_progress";
  /** Quando o estorno foi avisado pelo parceiro. */
  refundedAt?: string;
  /**
   * O que o estorno custou ao espaco: cartao, nada (as taxas voltam); Pix, a
   * tarifa do parceiro (a taxa do GestaraHub volta).
   */
  refundCostCents?: number;
}

/**
 * Situacao no filtro do historico. "open" = pagas e aguardando (padrao).
 * "refunded" = pagas e depois estornadas (26/11/2026): fora de "paid" e "open".
 */
export type ReceiptStatusFilter = "open" | "paid" | "awaiting" | "canceled" | "refunded" | "all";

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
  /** Busca pelo nome do aluno (26/11/2026). */
  search?: string;
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
  /** Pagos e depois estornados (fora dos totais acima): quantos e quanto voltou aos alunos. */
  refundedCount: number;
  refundedCents: number;
  /** O que esses estornos custaram ao espaco (tarifa do Pix que nao volta). */
  refundCostCents: number;
}

/** Totais do que a lista mostra (todos os filtros, inclusive situacao e busca). */
export interface SubaccountReceiptsListTotals {
  /** Pagos e nao estornados: o liquido que entrou. */
  receivedNetCents: number;
  /** Codigos em aberto: o valor que o aluno ainda vai pagar. */
  awaitingCents: number;
}

export interface SubaccountReceiptsPage {
  items: SubaccountReceiptItem[];
  total: number;
  summary: SubaccountReceiptsSummary;
  listTotals: SubaccountReceiptsListTotals;
}

const STATUS_FILTER_VALUES: Record<ReceiptStatusFilter, string[] | null> = {
  open: ["paid", "awaiting"],
  paid: ["paid"],
  awaiting: ["awaiting"],
  canceled: ["canceled", "expired"],
  refunded: ["paid"],
  all: null,
};

const REFUND_DISPUTES = "(refunded,refund_in_progress)";

/**
 * Estorno no filtro (26/11/2026): "Pagas" e "Pagas e aguardando" deixam de fora
 * o que foi estornado; "Estornadas" mostra so ele; "Todas" e as demais, tudo.
 */
function refundFilter(status: ReceiptStatusFilter): { onlyRefunded: boolean; withoutRefunded: boolean } {
  return { onlyRefunded: status === "refunded", withoutRefunded: status === "paid" || status === "open" };
}

/** Custo do estorno ao espaco (testes de 26/11/2026): cartao 0; Pix e o resto, a tarifa do parceiro. */
function refundCost(paidMethod: unknown, gatewayFee: unknown): number {
  if (paidMethod === "creditCard" || paidMethod === "debitCard") return 0;
  return Number(gatewayFee) || 0;
}

function isRefunded(dispute: unknown): boolean {
  return dispute === "refunded" || dispute === "refund_in_progress";
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
  return withErrorScope(async () => {
    const client = await getClientForTenant();
    // O espaco vem da sessao, nao do pedido (revisao geral de 31/10/2026, achado S9).
    const { requireTenant } = await import("../server/tenant");
    const organizationId = (await requireTenant()).organizationId;
    // Vencidas pela validade: ja aparecem como vencidas na leitura; gravar e tirar
    // do Asaas fica para depois da resposta (a rotina de hora em hora tambem faz).
    await afterResponse("Expirar códigos vencidos", () => expireDueOnlinePayments(organizationId));
    const statuses = STATUS_FILTER_VALUES[query.status];
    const refunds = refundFilter(query.status);

    // Mesmo filtro para a pagina e para os totais.
    // Intervalo aberto de um lado tambem vale (so "de" ou so "ate").
    let period: string | null = null;
    if (query.from || query.to) {
      const from = query.from ? startOfDayInSpace(query.from) : null;
      const to = query.to ? startOfDayInSpace(nextDay(query.to)) : null;
      const on = (col: string) =>
        [from ? `${col}.gte.${from}` : null, to ? `${col}.lt.${to}` : null].filter(Boolean).join(",");
      // Pelo ultimo acontecimento, o mesmo dia mostrado na lista (26/11/2026).
      period = `and(${on("event_at")})`;
    }
    const offset = (query.page - 1) * query.pageSize;

    // Busca pelo aluno (26/11/2026): o filtro no nome pede a juncao "inner".
    const search = query.search?.trim().slice(0, 80) ?? "";
    const join = search ? "!inner" : "";
    const nameFilter = `%${likeExact(search)}%`;
    let pageQuery = client
      .from("online_payments")
      .select(
        `
        id, charge_id, method, status, amount_cents, split_amount_cents, gateway_fee_cents, paid_method, net_amount_cents, fee_passed_to_customer, paid_at, created_at, canceled_reason, credit_date, funds_released, dispute_status, disputed_at, event_at, expires_at, opened_at, public_code, link_url, pix_copy_paste, receipt_url,
        charges${join} (
          status, paid_via, kind, description, competence, due_date, student_id,
          clients${join} ( name )
        )
        `,
        { count: "exact" },
      )
      .eq("organization_id", organizationId);
    if (search) pageQuery = pageQuery.ilike("charges.clients.name", nameFilter);
    // Totais da lista: os mesmos filtros da pagina, todas as paginas.
    const listTotalsQuery = () => {
      let totals = client
        .from("online_payments")
        .select(`status, amount_cents, net_amount_cents, dispute_status${search ? ", charges!inner(clients!inner(name))" : ""}`)
        .eq("organization_id", organizationId);
      if (period) totals = totals.or(period);
      if (statuses) totals = totals.in("status", statuses);
      if (refunds.onlyRefunded) totals = totals.in("dispute_status", ["refunded", "refund_in_progress"]);
      if (refunds.withoutRefunded) totals = totals.or(`dispute_status.is.null,dispute_status.not.in.${REFUND_DISPUTES}`);
      if (query.method !== "all") totals = totals.eq("method", query.method);
      if (search) totals = totals.ilike("charges.clients.name", nameFilter);
      return totals;
    };
    // Totais dos cartoes: o periodo e a forma, nao a situacao (26/11/2026: com
    // "Estornadas" o Recebido virava zero). Todas as paginas (a consulta para
    // em 1.000 linhas; doc 19, fase 0).
    const totalsQuery = () => {
      let totals = client
        .from("online_payments")
        .select("status, amount_cents, split_amount_cents, gateway_fee_cents, net_amount_cents, funds_released, dispute_status, paid_method")
        .eq("organization_id", organizationId);
      if (period) totals = totals.or(period);
      if (query.method !== "all") totals = totals.eq("method", query.method);
      return totals;
    };
    if (period) pageQuery = pageQuery.or(period);
    if (statuses) pageQuery = pageQuery.in("status", statuses);
    if (refunds.onlyRefunded) pageQuery = pageQuery.in("dispute_status", ["refunded", "refund_in_progress"]);
    if (refunds.withoutRefunded) pageQuery = pageQuery.or(`dispute_status.is.null,dispute_status.not.in.${REFUND_DISPUTES}`);
    if (query.method !== "all") pageQuery = pageQuery.eq("method", query.method);

    const [pageRes, totalsRes, listRes] = await Promise.all([
      // Pelo ultimo acontecimento (o mesmo dia e hora mostrados na lista).
      pageQuery.order("event_at", { ascending: false }).range(offset, offset + query.pageSize - 1),
      selectAllRows(totalsQuery),
      selectAllRows(listTotalsQuery),
    ]);

    const empty: SubaccountReceiptsPage = {
      items: [],
      total: 0,
      summary: {
        count: 0,
        paidCount: 0,
        grossCents: 0,
        feeCents: 0,
        netCents: 0,
        releasedNetCents: 0,
        pendingNetCents: 0,
        refundedCount: 0,
        refundedCents: 0,
        refundCostCents: 0,
      },
      listTotals: { receivedNetCents: 0, awaitingCents: 0 },
    };
    if (pageRes.error || !pageRes.data) {
      logError("[listSubaccountReceiptsAction] Erro ao listar recebimentos:", pageRes.error);
      return empty;
    }

    const summary = (totalsRes.data ?? []).reduce<SubaccountReceiptsSummary>(
      (acc, r) => {
        acc.count += 1;
        // Estornado: o dinheiro voltou ao aluno; fica fora do Recebido.
        if (r.status === "paid" && isRefunded(r.dispute_status)) {
          acc.refundedCount += 1;
          acc.refundedCents += Number(r.amount_cents) || 0;
          acc.refundCostCents += refundCost(r.paid_method, r.gateway_fee_cents);
        } else if (r.status === "paid") {
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

    const listTotals = ((listRes.data ?? []) as unknown as Array<Record<string, unknown>>).reduce<SubaccountReceiptsListTotals>(
      (acc, r) => {
        if (r.status === "paid" && !isRefunded(r.dispute_status)) acc.receivedNetCents += Number(r.net_amount_cents) || 0;
        if (r.status === "awaiting") acc.awaitingCents += Number(r.amount_cents) || 0;
        return acc;
      },
      { receivedNetCents: 0, awaitingCents: 0 },
    );

    const items = pageRes.data.map((r) => {
      type ChargeRow = {
        status?: string;
        paid_via?: string;
        kind?: string;
        description?: string | null;
        competence?: string | null;
        due_date?: string | null;
        student_id?: string;
        clients?: { name?: string } | { name?: string }[] | null;
      };
      const charge = (Array.isArray(r.charges) ? r.charges[0] : r.charges) as ChargeRow | null;
      const client = charge ? (Array.isArray(charge.clients) ? charge.clients[0] : charge.clients) : null;
      const chargeLabel = charge?.kind
        ? [
            chargeLabelOf(charge.kind as ChargeKind, charge.description ?? null),
            charge.kind === "membership" ? competenceLabelOf(charge.competence) : undefined,
          ]
            .filter(Boolean)
            .join(" ")
        : undefined;
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
        studentId: charge?.student_id ? String(charge.student_id) : undefined,
        studentName: client?.name ? String(client.name) : undefined,
        chargeLabel,
        eventAt: String(r.event_at ?? r.paid_at ?? r.created_at),
        expiresAt: r.expires_at ? String(r.expires_at) : undefined,
        openedAt: r.opened_at ? String(r.opened_at) : undefined,
        publicCode: r.public_code ? String(r.public_code) : undefined,
        linkUrl: r.link_url ? String(r.link_url) : undefined,
        pixCopyPaste: r.pix_copy_paste ? String(r.pix_copy_paste) : undefined,
        receiptUrl: r.receipt_url ? String(r.receipt_url) : undefined,
        chargeMonth: charge?.competence ?? (charge?.due_date ? String(charge.due_date).slice(0, 7) : undefined),
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
        ...(String(r.status) === "paid" && isRefunded(r.dispute_status)
          ? {
              refundStatus: r.dispute_status as "refunded" | "refund_in_progress",
              refundedAt: r.disputed_at ? String(r.disputed_at) : undefined,
              refundCostCents: refundCost(r.paid_method, r.gateway_fee_cents),
            }
          : {}),
      };
    });

    return { items, total: pageRes.count ?? items.length, summary, listTotals };
  });
}
