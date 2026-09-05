import type {
  ApiErrorField,
  CreateService,
  Id,
  Service,
  ServiceFilter,
  UpdateService,
} from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import { formatCents, formatDuration } from "@gestarahub/core/format";
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
import type { AuditChange } from "@gestarahub/contracts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Serviço não encontrado.";

/**
 * Validacao de campos do "servidor" (regra de negocio), com as mensagens de
 * referencia do doc 10. Independente da validacao de formulario (RHF + Zod).
 */
function validateService(
  payload: Partial<CreateService>,
  { partial }: { partial: boolean },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateService) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: "Informe o nome do serviço." });
    }
  }
  // Categoria e opcional; se informada, precisa existir.
  if (
    has("categoryId") &&
    payload.categoryId != null &&
    !store.categories.some((c) => c.id === payload.categoryId)
  ) {
    fields.push({ field: "categoryId", message: "Categoria inválida." });
  }
  if (!partial || has("durationMinutes")) {
    if (typeof payload.durationMinutes !== "number" || payload.durationMinutes <= 0) {
      fields.push({
        field: "durationMinutes",
        message: "A duração deve ser maior que zero.",
      });
    }
  }
  if (!partial || has("priceCents")) {
    if (typeof payload.priceCents !== "number" || payload.priceCents < 0) {
      fields.push({
        field: "priceCents",
        message: "O preço não pode ser negativo.",
      });
    }
  }
  if (has("status")) {
    if (payload.status !== "active" && payload.status !== "inactive") {
      fields.push({ field: "status", message: "Selecione um status válido." });
    }
  }

  if (fields.length > 0) {
    throw validationError(fields);
  }
}

// Sem categoria vai para o fim da ordenacao (posicao alta).
function categoryPosition(categoryId?: Id): number {
  return categoryId
    ? (store.categories.find((c) => c.id === categoryId)?.position ?? 9999)
    : 9999;
}

function sortServices(list: Service[]): Service[] {
  return [...list].sort((a, b) => {
    const pa = categoryPosition(a.categoryId);
    const pb = categoryPosition(b.categoryId);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export const servicesService = {
  list(filter?: ServiceFilter): Promise<Service[]> {
    return simulateRead(() => {
      let result = store.services;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter(
          (s) =>
            textIncludes(s.name, term) ||
            (s.description ? textIncludes(s.description, term) : false),
        );
      }
      if (filter?.categoryId) {
        result = result.filter((s) => s.categoryId === filter.categoryId);
      }
      if (filter?.status) {
        result = result.filter((s) => s.status === filter.status);
      }
      return clone(sortServices(result));
    });
  },

  getById(id: Id): Promise<Service> {
    return simulateRead(() => {
      const found = store.services.find((s) => s.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateService): Promise<Service> {
    return simulateWrite(() => {
      validateService(payload, { partial: false });
      const ts = nowIso();
      const service: Service = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        categoryId: payload.categoryId,
        durationMinutes: payload.durationMinutes,
        priceCents: payload.priceCents,
        description: payload.description?.trim() || undefined,
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      store.services.push(service);
      auditLogService.record({
        action: "created",
        target: { type: "service", id: service.id, label: service.name },
        predicate: `criou o serviço ${service.name}`,
      });
      return clone(service);
    });
  },

  update(id: Id, payload: UpdateService): Promise<Service> {
    return simulateWrite(() => {
      const idx = store.services.findIndex((s) => s.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateService(payload, { partial: true });

      const current = store.services[idx];
      const updated: Service = {
        ...current,
        ...payload,
        name: payload.name !== undefined ? payload.name.trim() : current.name,
        description:
          payload.description !== undefined
            ? payload.description.trim() || undefined
            : current.description,
        updatedAt: nowIso(),
      };
      store.services[idx] = updated;
      const changes: AuditChange[] = [];
      if (updated.priceCents !== current.priceCents) {
        changes.push({
          field: "priceCents",
          label: "Preço",
          before: formatCents(current.priceCents),
          after: formatCents(updated.priceCents),
        });
      }
      if (updated.durationMinutes !== current.durationMinutes) {
        changes.push({
          field: "durationMinutes",
          label: "Duração",
          before: formatDuration(current.durationMinutes),
          after: formatDuration(updated.durationMinutes),
        });
      }
      auditLogService.record({
        action: "updated",
        target: { type: "service", id: updated.id, label: updated.name },
        predicate: `atualizou o serviço ${updated.name}`,
        changes,
      });
      return clone(updated);
    });
  },

  // remove = inativacao logica (status -> 'inactive'); inativo nao e sugerido
  // em novos agendamentos, mas permanece no historico.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.services.findIndex((s) => s.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const name = store.services[idx].name;
      store.services[idx] = {
        ...store.services[idx],
        status: "inactive",
        updatedAt: nowIso(),
      };
      auditLogService.record({
        action: "inactivated",
        target: { type: "service", id, label: name },
        predicate: `inativou o serviço ${name}`,
      });
    });
  },
};