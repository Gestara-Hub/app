import type { ChargeRefund, ChargeView, Id, ManualPaymentDetails, PaymentMethod, RefundChargeInput } from "@gestarahub/contracts";
import { confirmPaidReservation } from "../events/eventShared";
import { coversPeriod } from "@gestarahub/core/membership-generation";
import { store } from "@/services/world/store";
import { isSupabaseOrganization } from "@/lib/session";
import { apiError, newId, notFoundError, nowIso, writeOp } from "@/services/world/ops";
import { cancelOnlinePaymentsForCharge } from "../onlinePayments";
import { paidAtFromDate, paidOnNote, refundedOnDate } from "./payment-date";
import { clone } from "./billingHelpers";
import { assertNotPaidOnline, assertNotWaived } from "./billingValidation";
import { recordChargeEvent, toChargeView } from "./billingViews";

export const chargePaymentsService = {
  /** Registra o pagamento manual: dia do pagamento (padrao hoje) e comprovantes. */
  markPaid(id: Id, method?: PaymentMethod, details: ManualPaymentDetails = {}): Promise<ChargeView> {
    return writeOp(async () => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      assertNotWaived(c);
      // Pagar de novo trocaria a forma e a data, e apagaria o recebimento online.
      if (c.status === "paid") {
        throw apiError("VALIDATION", "Esta cobrança já está paga.", { httpStatus: 409 });
      }
      // Cancelada: primeiro reabrir (com as travas do periodo e do cancelamento
      // pelo sistema). Pagar direto deixava "cancelada pelo sistema" e "substituida"
      // numa cobranca paga, ao lado da que a substituiu (revisao de valores, 30/10/2026).
      if (c.status === "canceled") {
        throw apiError("VALIDATION", "Esta cobrança está cancelada. Reabra antes de registrar o pagamento.", { httpStatus: 409 });
      }
      const paidAt = paidAtFromDate(details.paidOn);
      c.status = "paid";
      c.paidAt = paidAt;
      c.method = method;
      c.paidVia = "manual";
      if (details.receipts?.length) c.attachments = [...(c.attachments ?? []), ...details.receipts];
      c.updatedAt = nowIso();
      // Pago na mao: o Pix/link em aberto nao vale mais.
      cancelOnlinePaymentsForCharge(c.id, "Baixa manual da cobrança");
      // Evento "vaga so com o pagamento": pagou, a reserva vira inscricao com ingresso.
      if (c.kind === "event") confirmPaidReservation(c.eventRegistrationId);
      recordChargeEvent(c, "status_changed", `registrou${paidOnNote(details.paidOn)} o pagamento da`);
      return clone(toChargeView(c));
    });
  },

  // Desfaz o pagamento (volta a ficar em aberto; o atraso e derivado na leitura).
  markPending(id: Id): Promise<ChargeView> {
    return writeOp(async () => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      assertNotWaived(c);
      // So desfaz pagamento: numa cancelada, voltar a "em aberto" pulava as travas
      // do "Reabrir" (cancelada pelo sistema, periodo ja cobrado) e cobrava em dobro.
      if (c.status !== "paid") {
        throw apiError("VALIDATION", "Só dá para desfazer o pagamento de uma cobrança paga.", { httpStatus: 409 });
      }
      assertNotPaidOnline(c, "desfazer");
      c.status = "pending";
      c.paidAt = undefined;
      c.method = undefined;
      c.paidVia = undefined;
      c.attachments = undefined;
      c.updatedAt = nowIso();
      recordChargeEvent(c, "status_changed", "desfez o pagamento da");
      return clone(toChargeView(c));
    });
  },

  /**
   * Devolve o pagamento da cobranca (doc product/15, "Estorno de pagamento").
   * Pago online: o estorno no parceiro ja foi pedido pelo GestaraHub
   * (`refundOnlinePaymentAction`) ou feito no painel do Asaas; aqui so registra
   * e resolve o aviso. Pago fora do app: so registra (dia, forma, comprovante).
   * A cobranca reabre (pagar de outra forma) ou fica "Devolvida" (encerrada).
   */
  refundCharge(input: RefundChargeInput): Promise<ChargeView> {
    return writeOp(async () => {
      const c = store.charges.find((x) => x.id === input.chargeId);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      if (c.status !== "paid") {
        throw apiError("VALIDATION", "Só dá para estornar uma cobrança paga.", { httpStatus: 409 });
      }
      if (input.outcome !== "reopened" && input.outcome !== "closed") {
        throw apiError("VALIDATION", "Escolha o que fazer com a cobrança.", { httpStatus: 422 });
      }
      const refundedOn = refundedOnDate(input.refundedOn);
      const online = c.paidVia === "online" || c.paidVia === "recurring";
      let onlinePaymentId: Id | undefined;
      let amountCents = c.amountCents;
      if (online) {
        // O estorno precisa ter sido pedido (ou feito no Asaas) antes: sem isso a
        // cobranca sairia do Recebido com o dinheiro ainda na conta do espaco.
        let payment = store.onlinePayments.find(
          (p) =>
            p.chargeId === c.id &&
            p.status === "paid" &&
            (p.disputeStatus === "refunded" || p.disputeStatus === "refund_in_progress") &&
            !p.refundHandledAt,
        );
        // Demonstracao (sem parceiro de verdade): o estorno acontece aqui mesmo.
        if (!payment && !isSupabaseOrganization(c.organizationId)) {
          payment = store.onlinePayments.find((p) => p.chargeId === c.id && p.status === "paid" && !p.refundHandledAt);
          if (payment) {
            payment.disputeStatus = "refunded";
            payment.disputedAt = nowIso();
          }
        }
        if (!payment) {
          throw apiError("VALIDATION", "O estorno deste pagamento ainda não foi pedido ao parceiro.", { httpStatus: 409 });
        }
        payment.refundHandledAt = nowIso();
        onlinePaymentId = payment.id;
        amountCents = payment.amountCents || c.amountCents;
      }
      const reason = input.reason?.trim() || undefined;
      const refund: ChargeRefund = {
        id: newId(),
        refundedAt: nowIso(),
        refundedOn,
        amountCents,
        via: online ? "online" : "manual",
        method: online ? undefined : input.method,
        onlinePaymentId,
        paidAt: c.paidAt,
        paidMethod: c.method,
        paidVia: c.paidVia,
        paidReceipts: c.attachments?.length ? c.attachments : undefined,
        receipts: !online && input.receipts?.length ? input.receipts : undefined,
        outcome: input.outcome,
        reason,
      };
      c.refunds = [...(c.refunds ?? []), refund];
      // O pagamento devolvido sai da cobranca (fica no registro da devolucao).
      c.status = input.outcome === "reopened" ? "pending" : "refunded";
      c.paidAt = undefined;
      c.method = undefined;
      c.paidVia = undefined;
      c.attachments = undefined;
      c.updatedAt = nowIso();
      recordChargeEvent(
        c,
        "status_changed",
        input.outcome === "reopened" ? "estornou o pagamento e reabriu a" : "estornou o pagamento e encerrou a",
        reason,
      );
      return clone(toChargeView(c));
    });
  },

  // Cancela a cobrança (mantém o título no histórico sem compor o total a receber).
  cancelCharge(id: Id, reason?: string): Promise<ChargeView> {
    return writeOp(async () => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      assertNotWaived(c);
      // Cancelar uma paga online apagaria o recebimento, como o desfazer.
      if (c.status === "paid") assertNotPaidOnline(c, "cancelar");
      c.status = "canceled";
      c.canceledBy = "user";
      c.cancelReason = reason?.trim() || undefined;
      c.paidAt = undefined;
      c.method = undefined;
      c.paidVia = undefined;
      c.updatedAt = nowIso();
      cancelOnlinePaymentsForCharge(c.id, c.cancelReason || "Cobrança cancelada");
      recordChargeEvent(c, "cancelled", "cancelou a", c.cancelReason);
      return clone(toChargeView(c));
    });
  },

  // Reverte o cancelamento manual da cobrança (volta a ficar em aberto). Cancelada
  // pelo sistema (troca de plano/regra, inativacao, saida da aula) nao reabre:
  // voltaria a cobrar um periodo que o novo arranjo ja cobre.
  reopenCharge(id: Id): Promise<ChargeView> {
    return writeOp(async () => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      if (c.status !== "canceled") {
        throw apiError("VALIDATION", "Só é possível reabrir uma cobrança cancelada.", { httpStatus: 409 });
      }
      if (c.canceledBy === "system") {
        throw apiError(
          "VALIDATION",
          "Esta cobrança foi cancelada automaticamente pelo sistema e não pode ser reaberta.",
          { httpStatus: 409 },
        );
      }
      // Reabrir nao pode duplicar: outra mensalidade ja cobre o periodo (ex.:
      // o plano foi trocado depois do cancelamento).
      const { periodStart, periodEnd } = c;
      if (
        c.kind === "membership" &&
        periodStart &&
        periodEnd &&
        store.charges.some(
          (o) =>
            o.id !== c.id &&
            o.kind === "membership" &&
            o.studentId === c.studentId &&
            o.status !== "canceled" &&
            coversPeriod(o, {
              periodStart,
              periodEnd,
              competence: c.competence ?? "",
              cycleIndex: c.cycleIndex ?? 1,
            }),
        )
      ) {
        throw apiError(
          "VALIDATION",
          "Já existe outra mensalidade para este período. Cancele-a antes de reabrir esta.",
          { httpStatus: 409 },
        );
      }
      c.status = "pending";
      c.canceledBy = undefined;
      c.cancelReason = undefined;
      c.updatedAt = nowIso();
      recordChargeEvent(c, "status_changed", "reabriu a");
      return clone(toChargeView(c));
    });
  },
};
