import type {
  CreateFinancialEntry,
  FinancialEntry,
  FinancialEntryUpdateScope,
  FinancialRecurrence,
  Id,
  UpdateFinancialEntry,
} from "@gestarahub/contracts";
import { competenceOf, recurrenceDueDate } from "@gestarahub/core/finance";
import { plural } from "@gestarahub/core/format";
import { paymentMethodLabel } from "@/lib/labels";
import { newId, nowIso, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import {
  attachmentsNote,
  describeChanges,
  entryFacts,
  entryLabel,
  PAID_STATUS_LABEL,
  recordEntry,
  wasEverPaid,
} from "./financeAudit";
import { clone, conflict } from "./financeHelpers";
import { ensureRecurrenceEntries } from "./financeRecurrenceService";
import { findEntry } from "./financeStore";
import { validateCreate, validateUpdate } from "./financeValidation";

export function applyPatch(e: FinancialEntry, payload: UpdateFinancialEntry, ts: string): void {
  if (payload.categoryId !== undefined) e.categoryId = payload.categoryId;
  if (payload.description !== undefined) e.description = payload.description.trim();
  if (payload.amountCents !== undefined) e.amountCents = payload.amountCents;
  if (payload.dueDate !== undefined) e.dueDate = payload.dueDate;
  if (payload.notes !== undefined) e.notes = payload.notes.trim() || undefined;
  if (payload.attachments !== undefined) {
    e.attachments = payload.attachments.length > 0 ? payload.attachments : undefined;
  }
  e.updatedAt = ts;
}

export const transactionsService = {
  /**
   * Novo lancamento manual. `paidNow` grava como pago agora; `repeatMonthly`
   * cria a recorrencia a partir do mes do vencimento e materializa os meses
   * seguintes (ate o mes seguinte ao atual). Devolve o primeiro lancamento.
   */
  createEntry(payload: CreateFinancialEntry): Promise<FinancialEntry> {
    return writeOp(async () => {
      validateCreate(payload);
      const ts = nowIso();
      const organizationId = store.organization.id;
      const description = payload.description.trim();
      let recurrence: FinancialRecurrence | undefined;
      if (payload.repeatMonthly) {
        recurrence = {
          id: newId(),
          organizationId,
          type: payload.type,
          categoryId: payload.categoryId,
          description,
          amountCents: payload.amountCents,
          dayOfMonth: Number(payload.dueDate.slice(8, 10)),
          startCompetence: competenceOf(payload.dueDate),
          status: "active",
          createdAt: ts,
          updatedAt: ts,
        };
        store.financialRecurrences.push(recurrence);
      }
      const entry: FinancialEntry = {
        id: newId(),
        organizationId,
        unitId: store.unit.id,
        type: payload.type,
        categoryId: payload.categoryId,
        description,
        amountCents: payload.amountCents,
        dueDate: payload.dueDate,
        status: payload.paidNow ? "paid" : "pending",
        ...(payload.paidNow ? { paidAt: ts, method: payload.paidNow.method } : {}),
        ...(recurrence
          ? { recurrenceId: recurrence.id, recurrenceCompetence: recurrence.startCompetence }
          : {}),
        ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
        ...(payload.attachments?.length ? { attachments: payload.attachments } : {}),
        createdAt: ts,
        updatedAt: ts,
      };

      store.financialEntries.push(entry);
      if (recurrence) await ensureRecurrenceEntries();

      const paidNote = payload.paidNow ? `, pago via ${paymentMethodLabel(payload.paidNow.method)}` : "";
      const repeatNote = recurrence ? ", com repetição mensal" : "";
      const filesNote = attachmentsNote(entry.attachments?.length ?? 0);
      recordEntry(
        entry,
        "created",
        `lançou a ${entryLabel(entry)} ${entryFacts(entry).slice(0, -1)}${paidNote}${repeatNote}${filesNote})`,
        payload.paidNow
          ? [{ field: "status", label: "Status", before: "", after: PAID_STATUS_LABEL }]
          : undefined,
      );
      return clone(entry);
    });
  },

  /**
   * Edita um lancamento. Em serie, `scope = "following"` atualiza tambem a
   * recorrencia e os lancamentos PENDENTES das competencias seguintes.
   */
  updateEntry(
    id: Id,
    payload: UpdateFinancialEntry,
    scope: FinancialEntryUpdateScope = "single",
  ): Promise<FinancialEntry> {
    return writeOp(async () => {
      const entry = findEntry(id);
      if (entry.status === "canceled") {
        throw conflict("Lançamento cancelado não pode ser editado.");
      }
      validateUpdate(entry, payload);
      const ts = nowIso();
      const before = clone(entry);
      applyPatch(entry, payload, ts);
      const changes = describeChanges(before, entry);

      let following = 0;
      const recurrence =
        scope === "following" && entry.recurrenceId
          ? store.financialRecurrences.find((r) => r.id === entry.recurrenceId)
          : undefined;
      if (recurrence) {
        if (payload.categoryId !== undefined) recurrence.categoryId = payload.categoryId;
        if (payload.description !== undefined) recurrence.description = payload.description.trim();
        if (payload.amountCents !== undefined) recurrence.amountCents = payload.amountCents;
        if (payload.dueDate !== undefined) recurrence.dayOfMonth = Number(payload.dueDate.slice(8, 10));
        recurrence.updatedAt = ts;

        const from = entry.recurrenceCompetence ?? competenceOf(entry.dueDate);
        for (const other of store.financialEntries) {
          if (
            other.id === entry.id ||
            other.recurrenceId !== recurrence.id ||
            other.status !== "pending" ||
            (other.recurrenceCompetence ?? competenceOf(other.dueDate)) <= from
          ) {
            continue;
          }
          applyPatch(
            other,
            {
              categoryId: payload.categoryId,
              description: payload.description,
              amountCents: payload.amountCents,
              dueDate:
                payload.dueDate !== undefined
                  ? recurrenceDueDate(recurrence, other.recurrenceCompetence ?? competenceOf(other.dueDate))
                  : undefined,
            },
            ts,
          );
          following += 1;
        }
      }

      if (changes.length > 0 || following > 0) {
        const scopeNote =
          following > 0 ? ` e ${plural(following, "lançamento seguinte", "lançamentos seguintes")} da repetição` : "";
        recordEntry(entry, "updated", `editou a ${entryLabel(entry)}${scopeNote}`, changes);
      }
      return clone(entry);
    });
  },

  /**
   * Exclui de verdade (D2): so se nunca foi pago. Lancamento de repeticao nao
   * e excluido (a materializacao recriaria o mes): cancele ou encerre a repeticao.
   */
  deleteEntry(id: Id): Promise<void> {
    return writeOp(async () => {
      const entry = findEntry(id);
      if (wasEverPaid(entry)) {
        throw conflict("Lançamento que já foi pago não pode ser excluído. Cancele em vez disso.");
      }
      if (entry.recurrenceId) {
        throw conflict("Lançamento de repetição não pode ser excluído. Cancele ou encerre a repetição.");
      }

      store.financialEntries = store.financialEntries.filter((e) => e.id !== id);
      recordEntry(entry, "deleted", `excluiu a ${entryLabel(entry)} ${entryFacts(entry)}`);
    });
  },
};
