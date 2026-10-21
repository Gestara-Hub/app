import type { ChargeView, Id, ManualPaymentDetails, PaymentMethod } from "@gestarahub/contracts";
import { coversPeriod } from "@gestarahub/core/membership-generation";
import { store } from "@/mocks/store";
import { apiError, notFoundError, nowIso, simulateWrite } from "@/mocks/helpers";
import { isSupabaseOrganization } from "@/lib/session";
import { cancelOnlinePaymentsForCharge } from "../onlinePaymentsService";
import { cancelOnlinePaymentsForChargeInDb } from "../onlinePaymentsBackend";
import { paidAtFromDate, paidOnNote } from "../payment-date";
import { updateChargeInDb } from "../billingBackend";
import { clone } from "./billingHelpers";
import { assertNotPaidOnline, assertNotWaived } from "./billingValidation";
import { recordChargeEvent, toChargeView } from "./billingViews";

export const chargePaymentsService = {
  /** Registra o pagamento manual: dia do pagamento (padrao hoje) e comprovantes. */
  markPaid(id: Id, method?: PaymentMethod, details: ManualPaymentDetails = {}): Promise<ChargeView> {
    return simulateWrite(async () => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      assertNotWaived(c);
      // Pagar de novo trocaria a forma e a data, e apagaria o recebimento online.
      if (c.status === "paid") {
        throw apiError("VALIDATION", "Esta cobrança já está paga.", { httpStatus: 409 });
      }
      const paidAt = paidAtFromDate(details.paidOn);
      c.status = "paid";
      c.paidAt = paidAt;
      c.method = method;
      c.paidVia = "manual";
      if (details.receipts?.length) c.attachments = [...(c.attachments ?? []), ...details.receipts];
      c.updatedAt = nowIso();
      if (isSupabaseOrganization(store.organization.id)) {
        await updateChargeInDb(c.id, {
          status: "paid",
          paidAt: c.paidAt,
          method: c.method,
          paidVia: c.paidVia,
          attachments: c.attachments,
        }, store.organization.id);
        await cancelOnlinePaymentsForChargeInDb(
          c.id,
          store.organization.id,
          "Baixa manual da cobrança",
        );
      }
      // Pago na mao: o Pix/link em aberto nao vale mais.
      cancelOnlinePaymentsForCharge(c.id, "Baixa manual da cobrança");
      recordChargeEvent(c, "status_changed", `registrou${paidOnNote(details.paidOn)} o pagamento da`);
      return clone(toChargeView(c));
    });
  },

  // Desfaz o pagamento (volta a ficar em aberto; o atraso e derivado na leitura).
  markPending(id: Id): Promise<ChargeView> {
    return simulateWrite(async () => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      assertNotWaived(c);
      assertNotPaidOnline(c, "desfazer");
      c.status = "pending";
      c.paidAt = undefined;
      c.method = undefined;
      c.paidVia = undefined;
      c.attachments = undefined;
      c.updatedAt = nowIso();
      if (isSupabaseOrganization(store.organization.id)) {
        await updateChargeInDb(c.id, {
          status: "pending",
          paidAt: undefined,
          method: undefined,
          paidVia: undefined,
          attachments: [],
        }, store.organization.id);
      }
      recordChargeEvent(c, "status_changed", "desfez o pagamento da");
      return clone(toChargeView(c));
    });
  },

  // Cancela a cobrança (mantém o título no histórico sem compor o total a receber).
  cancelCharge(id: Id, reason?: string): Promise<ChargeView> {
    return simulateWrite(async () => {
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
      if (isSupabaseOrganization(store.organization.id)) {
        await updateChargeInDb(c.id, {
          status: "canceled",
          canceledBy: "user",
          cancelReason: c.cancelReason,
          paidAt: undefined,
          method: undefined,
          paidVia: undefined,
        }, store.organization.id);
        await cancelOnlinePaymentsForChargeInDb(
          c.id,
          store.organization.id,
          c.cancelReason || "Cobrança cancelada",
        );
      }
      cancelOnlinePaymentsForCharge(c.id, c.cancelReason || "Cobrança cancelada");
      recordChargeEvent(c, "cancelled", "cancelou a", c.cancelReason);
      return clone(toChargeView(c));
    });
  },

  // Reverte o cancelamento manual da cobrança (volta a ficar em aberto). Cancelada
  // pelo sistema (troca de plano/regra, inativacao, saida da aula) nao reabre:
  // voltaria a cobrar um periodo que o novo arranjo ja cobre.
  reopenCharge(id: Id): Promise<ChargeView> {
    return simulateWrite(async () => {
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
      if (isSupabaseOrganization(store.organization.id)) {
        await updateChargeInDb(c.id, {
          status: "pending",
          canceledBy: undefined,
          cancelReason: undefined,
        }, store.organization.id);
      }
      recordChargeEvent(c, "status_changed", "reabriu a");
      return clone(toChargeView(c));
    });
  },
};
