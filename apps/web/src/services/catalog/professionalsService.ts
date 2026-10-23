import type {
  CreateProfessional,
  Id,
  Professional,
  ProfessionalFilter,
  ProfessionalView,
  UpdateProfessional,
} from "@gestarahub/contracts";
import { store } from "@/services/world/store";
import {
  newId,
  notFoundError,
  nowIso,
  readOp,
  writeOp,
  textIncludes,
} from "@/services/world/ops";
import { auditLogService } from "../audit/auditLogService";
import { realAccountInBrowser } from "../world/delegate";
import { unwrap } from "../server/action";
import {
  createProfessionalAction,
  getProfessionalAction,
  listProfessionalsAction,
  removeProfessionalAction,
  updateProfessionalAction,
} from "./teamActions";
import {
  PROFESSIONAL_NOT_FOUND,
  sortProfessionals,
  toProfessionalView,
  validateProfessionalPayload,
} from "./teamRules";
import { encodeArgs } from "../world/transport";

/**
 * Equipe. Conta real: banco pelo servidor (`catalog/teamActions`, doc 15,
 * fatia 2.1). Demonstracao: store.
 */

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRealAccount(): boolean {
  return realAccountInBrowser();
}

function toView(p: Professional): ProfessionalView {
  return toProfessionalView(p, store.roles);
}

/** O contrato do profissional, sem o cargo expandido. */
function withoutRole(view: ProfessionalView): Professional {
  const professional: ProfessionalView = { ...view };
  delete professional.role;
  return professional;
}

/**
 * Transicao (doc 15, fatia 2): turmas, chamada e repasse ainda montam as telas
 * no navegador a partir do store. Ate migrarem, a conta real mantem la uma
 * copia da equipe lida do banco. Sai na fatia 4.
 */
function cacheProfessionals(list: Professional[]): void {
  const ids = new Set(list.map((p) => p.id));
  store.professionals = [
    ...store.professionals.filter((p) => !ids.has(p.id)),
    ...list.map((p) => withoutRole(p)),
  ];
}

function validateProfessional(payload: Partial<CreateProfessional>, { partial }: { partial: boolean }): void {
  validateProfessionalPayload(payload, {
    partial,
    roleExists: (roleId) => store.roles.some((r) => r.id === roleId),
  });
}

function recordUpdate(updated: Professional, previousStatus: Professional["status"]): void {
  // Reativacao (inativo -> ativo) e um evento proprio; senao, edicao comum.
  const reactivated = previousStatus === "inactive" && updated.status === "active";
  auditLogService.record({
    action: reactivated ? "activated" : "updated",
    target: { type: "professional", id: updated.id, label: updated.name },
    predicate: reactivated
      ? `reativou o profissional ${updated.name}`
      : `atualizou o profissional ${updated.name}`,
  });
}

export const professionalsService = {
  list(filter?: ProfessionalFilter): Promise<ProfessionalView[]> {
    return readOp(async () => {
      if (isRealAccount()) {
        const views = await unwrap(listProfessionalsAction(filter));
        if (!filter?.search && !filter?.status && !filter?.serviceId) cacheProfessionals(views);
        return views;
      }

      let result = store.professionals;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((p) => {
          const view = toView(p);
          return (
            textIncludes(p.name, term) ||
            (p.email ? textIncludes(p.email, term) : false) ||
            (view.role ? textIncludes(view.role.name, term) : false)
          );
        });
      }
      if (filter?.status) {
        result = result.filter((p) => p.status === filter.status);
      }
      if (filter?.serviceId) {
        result = result.filter((p) => p.serviceIds.includes(filter.serviceId!));
      }
      return clone(sortProfessionals(result).map(toView));
    });
  },

  getById(id: Id): Promise<ProfessionalView> {
    return readOp(async () => {
      if (isRealAccount()) return unwrap(getProfessionalAction(id));
      const found = store.professionals.find((p) => p.id === id);
      if (!found) throw notFoundError(PROFESSIONAL_NOT_FOUND);
      return clone(toView(found));
    });
  },

  create(payload: CreateProfessional): Promise<ProfessionalView> {
    return writeOp(async () => {
      let view: ProfessionalView;
      if (isRealAccount()) {
        view = await unwrap(createProfessionalAction(payload));
        cacheProfessionals([view]);
      } else {
        validateProfessional(payload, { partial: false });
        const ts = nowIso();
        const professional: Professional = {
          id: newId(),
          organizationId: store.organization.id,
          // A unidade vem do tenant ativo (a sessao), nunca de um id fixo da UI.
          unitId: store.unit.id,
          name: payload.name.trim(),
          roleId: payload.roleId,
          email: payload.email?.trim() || undefined,
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
        view = toView(professional);
      }
      auditLogService.record({
        action: "created",
        target: { type: "professional", id: view.id, label: view.name },
        predicate: `criou o profissional ${view.name}`,
      });
      return clone(view);
    });
  },

  update(id: Id, payload: UpdateProfessional): Promise<ProfessionalView> {
    return writeOp(async () => {
      if (isRealAccount()) {
        const { professional, previousStatus } = await unwrap(updateProfessionalAction(id, encodeArgs(payload) as typeof payload));
        cacheProfessionals([professional]);
        recordUpdate(professional, previousStatus);
        return professional;
      }

      const idx = store.professionals.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError(PROFESSIONAL_NOT_FOUND);
      validateProfessional(payload, { partial: true });
      const current = store.professionals[idx];
      const updated: Professional = {
        ...current,
        ...payload,
        ...(payload.email !== undefined
          ? { email: payload.email?.trim() || undefined }
          : {}),
        updatedAt: nowIso(),
      };
      store.professionals[idx] = updated;
      recordUpdate(updated, current.status);
      return clone(toView(updated));
    });
  },

  // remove = inativacao logica; inativo nao e sugerido em novos agendamentos.
  remove(id: Id): Promise<void> {
    return writeOp(async () => {
      let name: string;
      if (isRealAccount()) {
        const removed = await unwrap(removeProfessionalAction(id));
        cacheProfessionals([removed]);
        name = removed.name;
      } else {
        const idx = store.professionals.findIndex((p) => p.id === id);
        if (idx === -1) throw notFoundError(PROFESSIONAL_NOT_FOUND);
        name = store.professionals[idx].name;
        store.professionals[idx] = {
          ...store.professionals[idx],
          status: "inactive",
          updatedAt: nowIso(),
        };
      }
      auditLogService.record({
        action: "inactivated",
        target: { type: "professional", id, label: name },
        predicate: `inativou o profissional ${name}`,
      });
    });
  },
};
