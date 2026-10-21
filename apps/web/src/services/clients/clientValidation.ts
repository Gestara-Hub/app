import type { ApiErrorField, Client, CreateClient, DateISO } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { store } from "@/mocks/store";
import { validationError } from "@/mocks/helpers";
import { clientNoun } from "../nouns";
import { todayISO } from "./clientStore";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// NOTA: mensagens a confirmar com o doc 10 quando o modulo Clientes for feito.
export function validateClient(
  payload: Partial<CreateClient>,
  { partial, current }: { partial: boolean; current?: Client },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateClient) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: `Informe o nome do ${clientNoun()}.` });
    }
  }
  if (!partial || has("phone")) {
    if (!payload.phone || !payload.phone.trim()) {
      fields.push({ field: "phone", message: "Informe o telefone." });
    }
  }
  if (has("email") && payload.email && !EMAIL_RE.test(payload.email)) {
    fields.push({ field: "email", message: "Informe um e-mail válido." });
  }
  if (has("birthDate") && payload.birthDate && payload.birthDate > todayISO()) {
    fields.push({ field: "birthDate", message: "A data de nascimento não pode ser futura." });
  }
  payload.guardians?.forEach((g, i) => {
    if (!g.name?.trim()) {
      fields.push({ field: `guardians.${i}.name`, message: "Informe o nome do responsável." });
    }
  });
  // So a bolsa integral dispensa plano; a parcial cobra uma parte dele. Na
  // edicao, o que nao veio no payload vale o que ja esta gravado.
  const d = has("discount") ? payload.discount : current?.discount;
  const planId = has("planId") ? payload.planId : current?.planId;
  if (d?.scholarship && !planId && !(d.type === "percentage" && d.value >= 100)) {
    fields.push({ field: "planId", message: "Bolsa parcial precisa de um plano." });
  }
  // Desconto nunca passa do plano (o valor todo vira isento, nunca negativo).
  if (d && !d.scholarship) {
    const plan = planId ? store.plans.find((p) => p.id === planId) : undefined;
    if (d.value < 0 || (d.type === "percentage" && d.value > 100)) {
      fields.push({ field: "discountValue", message: "Informe um desconto entre 0% e 100%." });
    } else if (d.type === "fixed" && plan && d.value > plan.priceCents) {
      fields.push({
        field: "discountValue",
        message: `O desconto passa do valor do plano (${formatCents(plan.priceCents)}).`,
      });
    }
  }

  if (fields.length > 0) throw validationError(fields);
}

/** Registro de aula so no dia da aula ou depois. */
export function assertRecordDate(date: DateISO): void {
  if (date > todayISO()) {
    throw validationError([{ field: "date", message: "Registre a aula no dia dela ou depois." }]);
  }
}
