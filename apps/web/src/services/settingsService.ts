import type { BusinessHoursDay, Organization, Unit } from "@/types";
import { store } from "@/mocks/store";
import { simulateRead, simulateWrite } from "@/mocks/helpers";

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
      return clone(store.unit);
    });
  },
};
