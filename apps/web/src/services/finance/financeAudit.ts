import type { AuditChange, FileAttachment, FinancialEntry } from "@gestarahub/contracts";
import { formatCents, plural } from "@gestarahub/core/format";
import { financialEntryTypeLabel } from "@/lib/labels";
import { store } from "@/services/world/store";
import { auditLogService } from "../auditLogService";
import { dateLabel } from "./financeHelpers";
import { categoryName } from "./financeStore";

// --- Auditoria --------------------------------------------------------------

export const PAID_STATUS_LABEL = "Pago";

export function entryLabel(e: FinancialEntry): string {
  return `${financialEntryTypeLabel(e.type).toLowerCase()} ${e.description}`;
}

export function entryFacts(e: FinancialEntry): string {
  return `(${formatCents(e.amountCents)}, vence ${dateLabel(e.dueDate)})`;
}

export function recordEntry(
  e: FinancialEntry,
  action: "created" | "updated" | "deleted" | "cancelled" | "status_changed" | "inactivated",
  predicate: string,
  changes?: AuditChange[],
): void {
  auditLogService.record({
    action,
    target: { type: "financial_entry", id: e.id, label: e.description },
    predicate,
    changes,
  });
}

/** Ja foi pago alguma vez? (pago agora ou evento de pagamento na auditoria). */
export function wasEverPaid(e: FinancialEntry): boolean {
  if (e.status === "paid" || e.paidAt) return true;
  return store.auditLog.some(
    (log) =>
      log.target.type === "financial_entry" &&
      log.target.id === e.id &&
      (log.changes ?? []).some((c) => c.field === "status" && c.after === PAID_STATUS_LABEL),
  );
}

export function describeChanges(before: FinancialEntry, after: FinancialEntry): AuditChange[] {
  const changes: AuditChange[] = [];
  if (before.description !== after.description) {
    changes.push({ field: "description", label: "Descrição", before: before.description, after: after.description });
  }
  if (before.categoryId !== after.categoryId) {
    changes.push({
      field: "categoryId",
      label: "Categoria",
      before: categoryName(before.categoryId),
      after: categoryName(after.categoryId),
    });
  }
  if (before.amountCents !== after.amountCents) {
    changes.push({
      field: "amountCents",
      label: "Valor",
      before: formatCents(before.amountCents),
      after: formatCents(after.amountCents),
    });
  }
  if (before.dueDate !== after.dueDate) {
    changes.push({ field: "dueDate", label: "Vencimento", before: dateLabel(before.dueDate), after: dateLabel(after.dueDate) });
  }
  if ((before.notes ?? "") !== (after.notes ?? "")) {
    changes.push({ field: "notes", label: "Observações", before: before.notes ?? "", after: after.notes ?? "" });
  }
  const beforeFiles = attachmentNames(before.attachments);
  const afterFiles = attachmentNames(after.attachments);
  if (beforeFiles !== afterFiles) {
    changes.push({ field: "attachments", label: "Comprovantes", before: beforeFiles, after: afterFiles });
  }
  return changes;
}

export function attachmentNames(attachments: FileAttachment[] | undefined): string {
  return (attachments ?? []).map((a) => a.name).join(", ");
}

export function attachmentsNote(count: number): string {
  return count > 0 ? `, com ${plural(count, "comprovante", "comprovantes")}` : "";
}
