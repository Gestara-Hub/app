import type {
  ApiErrorField,
  CreateProfessional,
  Id,
  Professional,
  ProfessionalFilter,
  ProfessionalView,
  UpdateProfessional,
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

function roleNameOf(roleId?: Id): string {
  return roleId ? (store.roles.find((r) => r.id === roleId)?.name ?? "") : "";
}

// Expande o cargo (roleId -> role) — espelha o join que a API faria no GET.
// Cargo e opcional: sem roleId, o profissional nao tem `role`.
function toView(p: Professional): ProfessionalView {
  return {
    ...p,
    role: p.roleId ? { id: p.roleId, name: roleNameOf(p.roleId) } : undefined,
  };
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
  // Cargo e opcional; se informado, precisa existir.
  if (has("roleId") && payload.roleId && !store.roles.some((r) => r.id === payload.roleId)) {
    fields.push({ field: "roleId", message: "Cargo inválido." });
  }
  // No modelo de turmas (classes), ao menos uma modalidade é obrigatória.
  if (store.organization.model === "classes" && (!partial || has("modalityIds"))) {
    if (!payload.modalityIds || payload.modalityIds.length === 0) {
      fields.push({
        field: "modalityIds",
        message: "Selecione ao menos uma modalidade que o profissional leciona.",
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
  list(filter?: ProfessionalFilter): Promise<ProfessionalView[]> {
    return simulateRead(() => {
      let result = store.professionals;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter(
          (p) =>
            textIncludes(p.name, term) ||
            textIncludes(roleNameOf(p.roleId), term),
        );
      }
      if (filter?.status) {
        result = result.filter((p) => p.status === filter.status);
      }
      if (filter?.serviceId) {
        result = result.filter((p) => p.serviceIds.includes(filter.serviceId!));
      }
      return clone(
        [...result]
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map(toView),
      );
    });
  },

  getById(id: Id): Promise<ProfessionalView> {
    return simulateRead(() => {
      const found = store.professionals.find((p) => p.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(toView(found));
    });
  },

  create(payload: CreateProfessional): Promise<ProfessionalView> {
    return simulateWrite(() => {
      validateProfessional(payload, { partial: false });
      const ts = nowIso();
      const professional: Professional = {
        id: newId(),
        organizationId: store.organization.id,
        // A unidade vem do tenant ativo (a sessao), nunca de um id fixo da UI.
        unitId: store.unit.id,
        name: payload.name.trim(),
        roleId: payload.roleId,
        phone: payload.phone?.trim() || undefined,
        address: payload.address,
        status: payload.status ?? "active",
        workingHours: payload.workingHours ?? [],
        serviceIds: payload.serviceIds,
        ...(payload.modalityIds && payload.modalityIds.length > 0
          ? { modalityIds: payload.modalityIds }
          : {}),
        createdAt: ts,
        updatedAt: ts,
      };
      store.professionals.push(professional);
      auditLogService.record({
        action: "created",
        target: { type: "professional", id: professional.id, label: professional.name },
        predicate: `criou o profissional ${professional.name}`,
      });
      return clone(toView(professional));
    });
  },

  update(id: Id, payload: UpdateProfessional): Promise<ProfessionalView> {
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
      // Reativacao (inativo -> ativo) e um evento proprio; senao, edicao comum.
      const reactivated = current.status === "inactive" && updated.status === "active";
      auditLogService.record({
        action: reactivated ? "activated" : "updated",
        target: { type: "professional", id: updated.id, label: updated.name },
        predicate: reactivated
          ? `reativou o profissional ${updated.name}`
          : `atualizou o profissional ${updated.name}`,
      });
      return clone(toView(updated));
    });
  },

  // remove = inativacao logica; inativo nao e sugerido em novos agendamentos.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.professionals.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const name = store.professionals[idx].name;
      store.professionals[idx] = {
        ...store.professionals[idx],
        status: "inactive",
        updatedAt: nowIso(),
      };
      auditLogService.record({
        action: "inactivated",
        target: { type: "professional", id, label: name },
        predicate: `inativou o profissional ${name}`,
      });
    });
  },
};
