import type { Id, ManualPaymentDetails, PaymentMethod, TeacherPayout } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/labels";
import { nowIso, simulateWrite, validationError } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { auditLogService } from "../auditLogService";
import { paidAtFromDate, paidOnNote } from "../payment-date";
import { isSupabaseOrganization } from "@/lib/session";
import { saveTeacherPayoutInDb } from "../teacherPayBackend";
import { clone, competenceLabel, conflict, findPayout, payoutLabel, professionalName } from "./teacherPayHelpers";

export const teacherPayPaymentsService = {
  /**
   * Paga o mes fechado no dia informado (padrao hoje): entra no caixa como
   * saida "Professores" em `paidAt`, com os comprovantes.
   */
  markPayoutPaid(id: Id, method: PaymentMethod, details: ManualPaymentDetails = {}): Promise<TeacherPayout> {
    return simulateWrite(async () => {
      const payout = findPayout(id);
      if (payout.status !== "closed") {
        throw conflict(
          payout.status === "paid" ? "Este pagamento já foi registrado." : "Feche o mês antes de pagar.",
        );
      }
      if (!PAYMENT_METHODS.includes(method)) {
        throw validationError([{ field: "method", message: "Selecione a forma de pagamento." }]);
      }
      payout.status = "paid";
      payout.paidAt = paidAtFromDate(details.paidOn);
      payout.method = method;
      if (details.receipts?.length) payout.attachments = details.receipts;
      payout.updatedAt = nowIso();

      if (isSupabaseOrganization(store.organization.id)) {
        await saveTeacherPayoutInDb(payout);
      }

      auditLogService.record({
        action: "status_changed",
        target: { type: "teacher_payout", id, label: payoutLabel(payout.professionalId, payout.competence) },
        predicate: `registrou${paidOnNote(details.paidOn)} o pagamento de ${professionalName(payout.professionalId)} de ${competenceLabel(payout.competence)} (${formatCents(payout.totalCents)} via ${paymentMethodLabel(method)})`,
      });
      return clone(payout);
    });
  },

  /** Desfaz o pagamento: volta para fechado. */
  markPayoutUnpaid(id: Id): Promise<TeacherPayout> {
    return simulateWrite(async () => {
      const payout = findPayout(id);
      if (payout.status !== "paid") throw conflict("Este pagamento não está registrado como pago.");
      payout.status = "closed";
      payout.paidAt = undefined;
      payout.method = undefined;
      payout.attachments = undefined;
      payout.updatedAt = nowIso();

      if (isSupabaseOrganization(store.organization.id)) {
        await saveTeacherPayoutInDb(payout);
      }

      auditLogService.record({
        action: "status_changed",
        target: { type: "teacher_payout", id, label: payoutLabel(payout.professionalId, payout.competence) },
        predicate: `desfez o pagamento de ${professionalName(payout.professionalId)} de ${competenceLabel(payout.competence)} (${formatCents(payout.totalCents)})`,
      });
      return clone(payout);
    });
  },
};
