import type {
  ApiErrorField,
  DateISO,
  FileAttachment,
  FinancialEntry,
  Id,
  PaymentMethod,
} from "@gestarahub/contracts";
import { paymentMethodLabel } from "@/lib/labels";
import { nowIso, writeOp, validationError } from "@/services/world/ops";
import { paidAtFromDate, paidOnNote } from "../billing/payment-date";
import { attachmentsNote, entryFacts, entryLabel, PAID_STATUS_LABEL, recordEntry } from "./financeAudit";
import { clone, conflict, isPaymentMethod } from "./financeHelpers";
import { findEntry } from "./financeStore";
import { validateAttachments } from "./financeValidation";

export const entryStatusService = {
  /**
   * Marca como pago (exige forma de pagamento) no dia informado (padrao hoje);
   * comprovantes somam aos anexos.
   */
  markEntryPaid(
    id: Id,
    method: PaymentMethod,
    receipts: FileAttachment[] = [],
    paidOn?: DateISO,
  ): Promise<FinancialEntry> {
    return writeOp(async () => {
      const entry = findEntry(id);
      if (!isPaymentMethod(method)) {
        throw validationError([{ field: "method", message: "Selecione a forma de pagamento." }]);
      }
      if (entry.status === "paid") throw conflict("Este lançamento já está pago.");
      if (entry.status === "canceled") throw conflict("Lançamento cancelado não pode ser pago.");
      const attachments = [...(entry.attachments ?? []), ...receipts];
      const fields: ApiErrorField[] = [];
      validateAttachments(attachments, fields);
      if (fields.length > 0) throw validationError(fields);
      const paidAt = paidAtFromDate(paidOn);
      entry.status = "paid";
      entry.paidAt = paidAt;
      entry.method = method;
      if (receipts.length > 0) entry.attachments = attachments;
      entry.updatedAt = nowIso();

      recordEntry(
        entry,
        "status_changed",
        `registrou${paidOnNote(paidOn)} o pagamento da ${entryLabel(entry)} ${entryFacts(entry).slice(0, -1)}, via ${paymentMethodLabel(method)}${attachmentsNote(receipts.length)})`,
        [{ field: "status", label: "Status", before: "Pendente", after: PAID_STATUS_LABEL }],
      );
      return clone(entry);
    });
  },

  /** Desfaz o pagamento (volta a pendente; atraso derivado na leitura). */
  markEntryPending(id: Id): Promise<FinancialEntry> {
    return writeOp(async () => {
      const entry = findEntry(id);
      if (entry.status !== "paid") throw conflict("Só é possível desfazer um lançamento pago.");
      const method = entry.method;
      entry.status = "pending";
      entry.paidAt = undefined;
      entry.method = undefined;
      entry.updatedAt = nowIso();

      recordEntry(
        entry,
        "status_changed",
        `desfez o pagamento da ${entryLabel(entry)} ${entryFacts(entry)}`,
        [
          {
            field: "status",
            label: "Status",
            before: method ? `${PAID_STATUS_LABEL} (${paymentMethodLabel(method)})` : PAID_STATUS_LABEL,
            after: "Pendente",
          },
        ],
      );
      return clone(entry);
    });
  },

  /** Cancela (mantem no historico, sai dos totais). Pago precisa desfazer antes. */
  cancelEntry(id: Id): Promise<FinancialEntry> {
    return writeOp(async () => {
      const entry = findEntry(id);
      if (entry.status === "canceled") throw conflict("Este lançamento já está cancelado.");
      if (entry.status === "paid") {
        throw conflict("Desfaça o pagamento antes de cancelar o lançamento.");
      }
      entry.status = "canceled";
      entry.updatedAt = nowIso();

      recordEntry(entry, "cancelled", `cancelou a ${entryLabel(entry)} ${entryFacts(entry)}`);
      return clone(entry);
    });
  },
};
