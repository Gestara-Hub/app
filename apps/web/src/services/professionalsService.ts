import type {
  ApiErrorField,
  CreateProfessional,
  Id,
  Professional,
  ProfessionalFilter,
  UpdateProfessional,
} from "@/types";
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Profissional não encontrado.";

// NOTA: mensagens a confirmar com o doc 10 quando o modulo Equipe for feito.
function validateProfessional(
  payload: Partial<CreateProfessional>,
  { partial }: { partial: boolean },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateProfessional) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: "Informe o nome do profissional." });
    }
  }
  if (!partial || has("role")) {
    if (!payload.role || !payload.role.trim()) {
      fields.push({ field: "role", message: "Informe o cargo." });
    }
  }
  if (!partial || has("serviceIds")) {
    if (!payload.serviceIds || payload.serviceIds.length === 0) {
      fields.push({
        field: "serviceIds",
        message: "Selecione ao menos um serviço.",
      });
    }
  }
  if (has("workingHours") && payload.workingHours) {
    const invalid = payload.workingHours.some((h) => h.start >= h.end);
    if (invalid) {
      fields.push({
        field: "workingHours",
        message: "Horário inválido: o início deve ser antes do fim.",
      });
    }
  }

  if (fields.length > 0) throw validationError(fields);
}

export const professionalsService = {
  list(filter?: ProfessionalFilter): Promise<Professional[]> {
    return simulateRead(() => {
      let result = store.professionals;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter(
          (p) => textIncludes(p.name, term) || textIncludes(p.role, term),
        );
      }
      if (filter?.status) {
        result = result.filter((p) => p.status === filter.status);
      }
      if (filter?.serviceId) {
        result = result.filter((p) => p.serviceIds.includes(filter.serviceId!));
      }
      return clone(
        [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
    });
  },

  getById(id: Id): Promise<Professional> {
    return simulateRead(() => {
      const found = store.professionals.find((p) => p.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateProfessional): Promise<Professional> {
    return simulateWrite(() => {
      validateProfessional(payload, { partial: false });
      const ts = nowIso();
      const professional: Professional = {
        id: newId(),
        organizationId: store.organization.id,
        unitId: payload.unitId ?? store.unit.id,
        name: payload.name.trim(),
        role: payload.role.trim(),
        phone: payload.phone?.trim() || undefined,
        status: payload.status ?? "active",
        workingHours: payload.workingHours ?? [],
        serviceIds: payload.serviceIds,
        createdAt: ts,
        updatedAt: ts,
      };
      store.professionals.push(professional);
      return clone(professional);
    });
  },

  update(id: Id, payload: UpdateProfessional): Promise<Professional> {
    return simulateWrite(() => {
      const idx = store.professionals.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateProfessional(payload, { partial: true });
      const current = store.professionals[idx];
      const updated: Professional = {
        ...current,
        ...payload,
        updatedAt: nowIso(),
      };
      store.professionals[idx] = updated;
      return clone(updated);
    });
  },

  // remove = inativacao logica; inativo nao e sugerido em novos agendamentos.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.professionals.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      store.professionals[idx] = {
        ...store.professionals[idx],
        status: "inactive",
        updatedAt: nowIso(),
      };
    });
  },
};
