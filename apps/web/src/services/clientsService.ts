import type {
  ApiErrorField,
  Client,
  ClientFilter,
  CreateClient,
  Id,
  UpdateClient,
} from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import {
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";
import { auditLogService } from "./auditLogService";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Cliente não encontrado.";
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
      fields.push({ field: "name", message: "Informe o nome do cliente." });
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
          (c) => textIncludes(c.name, term) || textIncludes(c.phone, term),
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

      // Se possui plano e foi configurada cobrança inicial, gera imediatamente no store.charges
      if (
        client.planId &&
        payload.initialCharge &&
        payload.initialCharge.amountCents > 0
      ) {
        const todayStr = ts.slice(0, 10);
        const chargeDueDate = payload.initialCharge.dueDate || todayStr;
        const competence = chargeDueDate.slice(0, 7);

        store.charges.push({
          id: newId(),
          organizationId: store.organization.id,
          studentId: client.id,
          kind: "membership",
          planId: client.planId,
          competence,
          dueDate: chargeDueDate,
          amountCents: payload.initialCharge.amountCents,
          status: chargeDueDate < todayStr ? "overdue" : "pending",
          cycleIndex: 1,
          cycleTotal: 1,
          isProrated: payload.initialCharge.isProrated,
          proratedDays: payload.initialCharge.proratedDays,
          notes: payload.initialCharge.isProrated
            ? `Mensalidade proporcional (${payload.initialCharge.proratedDays ?? 0} dias)`
            : "1ª Mensalidade (ciclo completo)",
          createdAt: ts,
          updatedAt: ts,
        });
      }

      auditLogService.record({
        action: "created",
        target: { type: "client", id: client.id, label: client.name },
        predicate: `criou o cliente ${client.name}`,
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

      // Se foi vinculada uma cobrança inicial na transição de plano
      if (
        updated.planId &&
        payload.initialCharge &&
        payload.initialCharge.amountCents > 0
      ) {
        const todayStr = ts.slice(0, 10);
        const chargeDueDate = payload.initialCharge.dueDate || todayStr;
        const competence = chargeDueDate.slice(0, 7);

        const exists = store.charges.some(
          (c) =>
            c.kind === "membership" &&
            c.studentId === updated.id &&
            c.competence === competence,
        );

        if (!exists) {
          store.charges.push({
            id: newId(),
            organizationId: store.organization.id,
            studentId: updated.id,
            kind: "membership",
            planId: updated.planId,
            competence,
            dueDate: chargeDueDate,
            amountCents: payload.initialCharge.amountCents,
            status: chargeDueDate < todayStr ? "overdue" : "pending",
            cycleIndex: 1,
            cycleTotal: 1,
            isProrated: payload.initialCharge.isProrated,
            proratedDays: payload.initialCharge.proratedDays,
            notes: payload.initialCharge.isProrated
              ? `Mensalidade proporcional (${payload.initialCharge.proratedDays ?? 0} dias)`
              : "1ª Mensalidade (ciclo completo)",
            createdAt: ts,
            updatedAt: ts,
          });
        }
      }

      auditLogService.record({
        action: "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `atualizou o cliente ${updated.name}`,
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
      auditLogService.record({
        action: "inactivated",
        target: { type: "client", id, label: name },
        predicate: `inativou o cliente ${name}`,
      });
    });
  },
};
