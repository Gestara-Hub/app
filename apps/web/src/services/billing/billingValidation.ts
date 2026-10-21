import type {
  ApiErrorField,
  Charge,
  CreateExtraCharge,
  CreateLessonPackage,
  CreatePlan,
  SellPackage,
} from "@gestarahub/contracts";
import { MAX_INSTALLMENTS } from "@gestarahub/core/billing";
import { MAX_PACKAGE_LESSONS, MAX_PACKAGE_VALIDITY_DAYS } from "@gestarahub/core/packages";
import { parseISO } from "date-fns";
import { store } from "@/mocks/store";
import { apiError, validationError } from "@/mocks/helpers";
import { acceptsPackages } from "./packageUsage";

/**
 * D8: pagamento online ou por Pix Automatico nao se desfaz (seria estorno, fora
 * da demonstracao). Manual e dado antigo (sem `paidVia`) seguem permitidos.
 */
export function assertNotPaidOnline(c: Charge, verb: "desfazer" | "cancelar"): void {
  if (c.paidVia !== "online" && c.paidVia !== "recurring") return;
  const via = c.paidVia === "online" ? "online" : "pelo Pix Automático";
  throw apiError(
    "VALIDATION",
    `Não é possível ${verb} um pagamento feito ${via}: seria um estorno, que não existe nesta versão.`,
    { httpStatus: 409 },
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXTRA_DESCRIPTION_MAX = 80;

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(parseISO(value).getTime());
}

export function validateExtraCharge(payload: Partial<CreateExtraCharge>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.studentId) fields.push({ field: "studentId", message: "Selecione o aluno." });
  const description = payload.description?.trim() ?? "";
  if (!description) {
    fields.push({ field: "description", message: "Descreva a cobrança." });
  } else if (description.length > EXTRA_DESCRIPTION_MAX) {
    fields.push({ field: "description", message: `Use no máximo ${EXTRA_DESCRIPTION_MAX} caracteres.` });
  }
  if (!Number.isInteger(payload.totalCents) || (payload.totalCents ?? 0) <= 0) {
    fields.push({ field: "totalCents", message: "Informe o valor." });
  }
  if (!isValidDate(payload.firstDueDate)) {
    fields.push({ field: "firstDueDate", message: "Informe o vencimento." });
  }
  const n = payload.installments;
  if (!Number.isInteger(n) || (n ?? 0) < 1 || (n ?? 0) > MAX_INSTALLMENTS) {
    fields.push({ field: "installments", message: `Escolha de 1 a ${MAX_INSTALLMENTS} parcelas.` });
  } else if (Number.isInteger(payload.totalCents) && (payload.totalCents ?? 0) < (n ?? 1)) {
    // Parcela de R$ 0 nao e cobranca.
    fields.push({ field: "installments", message: "Cada parcela precisa de pelo menos R$ 0,01." });
  }
  if (fields.length > 0) throw validationError(fields);
}

export function validatePlan(payload: Partial<CreatePlan>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name || !payload.name.trim()) {
    fields.push({ field: "name", message: "Informe o nome do plano." });
  }
  if (payload.priceCents === undefined || payload.priceCents <= 0) {
    fields.push({ field: "priceCents", message: "Informe um valor maior que zero." });
  }
  if (fields.length > 0) throw validationError(fields);
}

/** Isento (bolsa integral) nao tem pagamento, desfazer nem cancelamento manual. */
export function assertNotWaived(c: Charge): void {
  if (c.status === "waived") {
    throw apiError(
      "VALIDATION",
      "Mensalidade isenta. Para cobrar, ajuste a bolsa ou o desconto no cadastro do aluno.",
      { httpStatus: 409 },
    );
  }
}

export function validatePackage(payload: Partial<CreateLessonPackage>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name || !payload.name.trim()) {
    fields.push({ field: "name", message: "Informe o nome do pacote." });
  }
  const lessons = payload.lessons;
  if (!Number.isInteger(lessons) || (lessons ?? 0) < 1 || (lessons ?? 0) > MAX_PACKAGE_LESSONS) {
    fields.push({ field: "lessons", message: `Informe de 1 a ${MAX_PACKAGE_LESSONS} aulas.` });
  }
  if (!Number.isInteger(payload.priceCents) || (payload.priceCents ?? 0) <= 0) {
    fields.push({ field: "priceCents", message: "Informe um valor maior que zero." });
  }
  const days = payload.validityDays;
  if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > MAX_PACKAGE_VALIDITY_DAYS)) {
    fields.push({ field: "validityDays", message: `A validade vai de 1 a ${MAX_PACKAGE_VALIDITY_DAYS} dias.` });
  }
  const invalidClass = (payload.classGroupIds ?? []).some((id) => {
    const g = store.classGroups.find((x) => x.id === id);
    return !g || !acceptsPackages(g);
  });
  if (invalidClass) {
    fields.push({ field: "classGroupIds", message: "Escolha turmas de pacote ou de mensalidade." });
  }
  if (fields.length > 0) throw validationError(fields);
}

export function validateSale(payload: Partial<SellPackage>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.studentId) fields.push({ field: "studentId", message: "Selecione o aluno." });
  if (!payload.packageId) fields.push({ field: "packageId", message: "Selecione o pacote." });
  if (!Number.isInteger(payload.priceCents) || (payload.priceCents ?? 0) <= 0) {
    fields.push({ field: "priceCents", message: "Informe o valor." });
  }
  const n = payload.installments;
  if (!Number.isInteger(n) || (n ?? 0) < 1 || (n ?? 0) > MAX_INSTALLMENTS) {
    fields.push({ field: "installments", message: `Escolha de 1 a ${MAX_INSTALLMENTS} parcelas.` });
  } else if (Number.isInteger(payload.priceCents) && (payload.priceCents ?? 0) > 0 && (payload.priceCents ?? 0) < (n ?? 1)) {
    // Parcela de R$ 0 nao e cobranca.
    fields.push({ field: "installments", message: "Cada parcela precisa de pelo menos R$ 0,01." });
  }
  if (!isValidDate(payload.firstDueDate)) {
    fields.push({ field: "firstDueDate", message: "Informe o 1º vencimento." });
  }
  if (fields.length > 0) throw validationError(fields);
}

/** Campos do pacote coerentes: nome sem espacos sobrando, validade ausente = sem validade. */
export function normalizePackage<T extends Partial<CreateLessonPackage>>(payload: T): T {
  return {
    ...payload,
    name: payload.name?.trim(),
    validityDays: payload.validityDays || undefined,
    classGroupIds: [...new Set(payload.classGroupIds ?? [])],
    modalityIds: [...new Set(payload.modalityIds ?? [])],
    absenceConsumes: payload.absenceConsumes ?? true,
  };
}
