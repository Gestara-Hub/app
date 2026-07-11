import type { BusinessHoursDay, Organization, Unit } from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import { simulateRead, simulateWrite } from "@/mocks/helpers";
import { auditLogService } from "./auditLogService";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export type UpdateOrganization = Partial<Pick<Organization, "name" | "segment">>;
export type UpdateUnit = Partial<{
  name: string;
  address: string;
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
        address: payload.address !== undefined ? payload.address.trim() || undefined : store.unit.address,
        phone: payload.phone !== undefined ? payload.phone.trim() || undefined : store.unit.phone,
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
