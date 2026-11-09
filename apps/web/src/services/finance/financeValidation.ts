import type {
  ApiErrorField,
  CreateFinancialEntry,
  FileAttachment,
  FinancialEntry,
  FinancialEntryType,
  Id,
  UpdateFinancialEntry,
} from "@gestarahub/contracts";
import { ENTRY_ATTACHMENT_RULES } from "@/lib/files";
import { validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { isEntryType, isPaymentMethod, isValidDate } from "./financeHelpers";
import { categoryOf } from "./financeStore";

// --- Validacao --------------------------------------------------------------

export function validateCategoryRef(
  categoryId: Id | undefined,
  type: FinancialEntryType | undefined,
  fields: ApiErrorField[],
): void {
  if (!categoryId) {
    fields.push({ field: "categoryId", message: "Selecione a categoria." });
    return;
  }
  const category = categoryOf(categoryId);
  if (!category) {
    fields.push({ field: "categoryId", message: "Categoria não encontrada." });
  } else if (category.system) {
    fields.push({
      field: "categoryId",
      message: "Esta categoria é automática e não pode ser usada num lançamento manual.",
    });
  } else if (category.status !== "active") {
    fields.push({ field: "categoryId", message: "Esta categoria está inativa." });
  } else if (type && category.type !== type) {
    fields.push({
      field: "categoryId",
      message: `Escolha uma categoria de ${type === "income" ? "entrada" : "saída"}.`,
    });
  }
}

export function validateAmount(amount: unknown, fields: ApiErrorField[]): void {
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    fields.push({ field: "amountCents", message: "Informe um valor maior que zero." });
  }
}

export function validateDescription(description: unknown, fields: ApiErrorField[]): void {
  if (typeof description !== "string" || !description.trim()) {
    fields.push({ field: "description", message: "Informe a descrição." });
  } else if (description.trim().length > 120) {
    fields.push({ field: "description", message: "Use no máximo 120 caracteres." });
  }
}

export function validateAttachments(attachments: FileAttachment[] | undefined, fields: ApiErrorField[]): void {
  if (attachments && attachments.length > ENTRY_ATTACHMENT_RULES.maxFiles) {
    fields.push({
      field: "receipts",
      message: `Anexe no máximo ${ENTRY_ATTACHMENT_RULES.maxFiles} arquivos por lançamento.`,
    });
  }
}

export function validateCreate(payload: CreateFinancialEntry): void {
  const fields: ApiErrorField[] = [];
  if (!isEntryType(payload.type)) {
    fields.push({ field: "type", message: "Escolha entre entrada e saída." });
  }
  validateCategoryRef(payload.categoryId, isEntryType(payload.type) ? payload.type : undefined, fields);
  validateDescription(payload.description, fields);
  validateAmount(payload.amountCents, fields);
  if (payload.eventId && !(store.events ?? []).some((e) => e.id === payload.eventId)) {
    fields.push({ field: "eventId", message: "Evento não encontrado." });
  }
  // Repetir todo mes aceita qualquer dia: 29 a 31 caem no ultimo dia dos meses curtos.
  if (!isValidDate(payload.dueDate)) {
    fields.push({ field: "dueDate", message: "Informe uma data de vencimento válida." });
  }
  if (payload.paidNow && !isPaymentMethod(payload.paidNow.method)) {
    fields.push({ field: "method", message: "Selecione a forma de pagamento." });
  }
  validateAttachments(payload.attachments, fields);
  if (fields.length > 0) throw validationError(fields);
}

export function validateUpdate(entry: FinancialEntry, payload: UpdateFinancialEntry): void {
  const fields: ApiErrorField[] = [];
  if (payload.categoryId !== undefined && payload.categoryId !== entry.categoryId) {
    validateCategoryRef(payload.categoryId, entry.type, fields);
  }
  if (payload.description !== undefined) validateDescription(payload.description, fields);
  if (payload.amountCents !== undefined) validateAmount(payload.amountCents, fields);
  if (payload.dueDate !== undefined && !isValidDate(payload.dueDate)) {
    fields.push({ field: "dueDate", message: "Informe uma data de vencimento válida." });
  }
  validateAttachments(payload.attachments, fields);
  if (fields.length > 0) throw validationError(fields);
}
