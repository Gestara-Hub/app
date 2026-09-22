import type { Address, BusinessHoursDay, Organization, Unit } from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import { simulateRead, simulateWrite } from "@/mocks/helpers";
import { auditLogService } from "./auditLogService";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export type UpdateOrganization = Partial<
  Pick<Organization, "name" | "segment" | "model" | "settings">
>;
export type UpdateUnit = Partial<{
  name: string;
  address: Address | string;
  phone: string;
  businessHours: BusinessHoursDay[];
}>;

export const settingsService = {
  getOrganization(): Promise<Organization> {
    return simulateRead(() => clone(store.organization));
  },

  getUnit(): Promise<Unit> {
    return simulateRead(() => clone(store.unit));
  },

  updateOrganization(payload: UpdateOrganization): Promise<Organization> {
    return simulateWrite(() => {
      store.organization = {
        ...store.organization,
        ...payload,
        name: payload.name?.trim() || store.organization.name,
        segment:
          payload.segment !== undefined
            ? payload.segment.trim() || store.organization.segment
            : store.organization.segment,
        model: payload.model || store.organization.model,
        settings: payload.settings !== undefined ? payload.settings : store.organization.settings,
      };
      auditLogService.record({
        action: "updated",
        target: { type: "settings", label: "Dados da organização" },
        predicate: "atualizou os dados da organização",
        security: true,
      });
      return clone(store.organization);
    });
  },

  updateUnit(payload: UpdateUnit): Promise<Unit> {
    return simulateWrite(() => {
      store.unit = {
        ...store.unit,
        ...payload,
        name: payload.name?.trim() || store.unit.name,
        address: payload.address !== undefined ? payload.address : store.unit.address,
        phone: payload.phone !== undefined ? (typeof payload.phone === "string" ? payload.phone.trim() || undefined : payload.phone) : store.unit.phone,
      };
      // Distingue alteracao do expediente (o caso mais sensivel) dos demais dados.
      const changedHours = payload.businessHours !== undefined;
      auditLogService.record({
        action: "updated",
        target: {
          type: "settings",
          label: changedHours ? "Horário de funcionamento" : "Dados da unidade",
        },
        predicate: changedHours
          ? "alterou o horário de funcionamento da unidade"
          : "atualizou os dados da unidade",
        security: true,
      });
      return clone(store.unit);
    });
  },
};
