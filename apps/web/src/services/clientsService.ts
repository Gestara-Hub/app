import type {
  ApiErrorField,
  Charge,
  Client,
  ClientFilter,
  CreateClient,
  CreateClientInitialCharge,
  Id,
  UpdateClient,
} from "@gestarahub/contracts";
import { chargesDueIn } from "@gestarahub/core/billing";
import { format } from "date-fns";
import { store } from "@/mocks/store";
import {
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  phoneIncludes,
  textIncludes,
  validationError,
} from "@/mocks/helpers";
import { auditLogService } from "./auditLogService";
import { cancelOpenMembershipCharges, studentMembershipTerms } from "./billingService";
import { clientNoun } from "./nouns";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Cliente não encontrado.";

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * 1a mensalidade do aluno no plano. Valor e vencimento vem do formulario (que
 * usa o motor de cobranca e permite ajuste); o periodo de referencia garante
 * que a geracao em lote reconheca esta cobranca e nao a duplique.
 */
function initialMembershipCharge(client: Client, input: CreateClientInitialCharge): Charge {
  const ts = nowIso();
  const competence = input.dueDate.slice(0, 7);
  const plan = store.plans.find((p) => p.id === client.planId);
  const slot = plan
    ? chargesDueIn(studentMembershipTerms(client, plan), competence).find(
        (c) => c.periodStart === input.periodStart,
      )
    : undefined;
  return {
    id: newId(),
    organizationId: store.organization.id,
    studentId: client.id,
    kind: "membership",
    planId: client.planId,
    competence,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    dueDate: input.dueDate,
    amountCents: input.amountCents,
    status: "pending",
    cycleIndex: slot?.cycleIndex ?? 1,
    cycleTotal: slot?.cycleTotal ?? 1,
    isProrated: input.isProrated,
    proratedDays: input.proratedDays,
    notes: input.isProrated
      ? `Mensalidade proporcional (${input.proratedDays ?? 0} dias)`
      : "1ª mensalidade",
    createdAt: ts,
    updatedAt: ts,
  };
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// NOTA: mensagens a confirmar com o doc 10 quando o modulo Clientes for feito.
function validateClient(
  payload: Partial<CreateClient>,
  { partial }: { partial: boolean },
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

  if (fields.length > 0) throw validationError(fields);
}

export const clientsService = {
  list(filter?: ClientFilter): Promise<Client[]> {
    return simulateRead(() => {
      let result = store.clients;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter(
          (c) => textIncludes(c.name, term) || phoneIncludes(c.phone, term),
        );
      }
      if (filter?.status) {
        result = result.filter((c) => c.status === filter.status);
      }
      return clone(
        [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
    });
  },

  getById(id: Id): Promise<Client> {
    return simulateRead(() => {
      const found = store.clients.find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateClient): Promise<Client> {
    return simulateWrite(() => {
      validateClient(payload, { partial: false });
      const ts = nowIso();
      const client: Client = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        email: payload.email?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        address: payload.address,
        planId: payload.planId || undefined,
        planStartDate: payload.planStartDate || undefined,
        billingStrategy: payload.billingStrategy || undefined,
        cyclePaymentTiming: payload.cyclePaymentTiming || undefined,
        dueDay: payload.dueDay || store.organization.settings?.defaultDueDay || 10,
        discount: payload.discount,
        membershipStatus: payload.membershipStatus ?? "active",
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      store.clients.push(client);

      // 1a mensalidade (calculada no cadastro pelo motor de cobranca e ajustavel).
      if (client.planId && payload.initialCharge && payload.initialCharge.amountCents > 0) {
        store.charges.push(initialMembershipCharge(client, payload.initialCharge));
      }

      auditLogService.record({
        action: "created",
        target: { type: "client", id: client.id, label: client.name },
        predicate: `criou o ${clientNoun()} ${client.name}`,
      });
      return clone(client);
    });
  },

  update(id: Id, payload: UpdateClient): Promise<Client> {
    return simulateWrite(() => {
      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateClient(payload, { partial: true });
      const current = store.clients[idx];
      const ts = nowIso();
      const updated: Client = {
        ...current,
        ...payload,
        updatedAt: ts,
      };
      store.clients[idx] = updated;

      // Troca de plano ou de data de inicio: as mensalidades em aberto do
      // arranjo anterior a partir da nova vigencia deixam de valer.
      const planChanged =
        Boolean(updated.planId) &&
        (current.planId !== updated.planId || current.planStartDate !== updated.planStartDate);
      if (planChanged && current.planId && updated.planStartDate) {
        cancelOpenMembershipCharges(updated.id, updated.planStartDate, "Cancelada por troca de plano", {
          inclusive: true,
        });
      }
      if (updated.planId && payload.initialCharge && payload.initialCharge.amountCents > 0) {
        const charge = initialMembershipCharge(updated, payload.initialCharge);
        const exists = store.charges.some(
          (c) =>
            c.kind === "membership" &&
            c.studentId === updated.id &&
            c.planId === updated.planId &&
            c.status !== "canceled" &&
            (c.periodStart ? c.periodStart === charge.periodStart : c.competence === charge.competence),
        );
        if (!exists) store.charges.push(charge);
      }

      auditLogService.record({
        action: current.status !== "active" && updated.status === "active" ? "activated" : "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `${current.status !== "active" && updated.status === "active" ? "reativou" : "atualizou"} o ${clientNoun()} ${updated.name}`,
      });
      return clone(updated);
    });
  },

  // remove = inativacao logica; cliente permanece no historico.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const name = store.clients[idx].name;
      store.clients[idx] = {
        ...store.clients[idx],
        status: "inactive",
        updatedAt: nowIso(),
      };
      // Mensalidades de periodos que ainda nao comecaram deixam de valer; o que
      // ja foi usado continua em aberto como divida.
      const canceled = cancelOpenMembershipCharges(id, todayISO(), "Cancelada na inativação do aluno");
      auditLogService.record({
        action: "inactivated",
        target: { type: "client", id, label: name },
        predicate: `inativou o ${clientNoun()} ${name}${canceled > 0 ? ` e cancelou ${canceled} mensalidade(s) futura(s)` : ""}`,
      });
    });
  },
};
