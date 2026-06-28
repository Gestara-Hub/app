import type {
  DateTimeISO,
  Id,
  RecordStatus,
  ServiceCategory,
} from "./common";

export interface Service {
  id: Id;
  organizationId: Id;
  name: string;
  category: ServiceCategory;
  durationMinutes: number; // > 0
  priceCents: number; // >= 0 (centavos para precisao)
  description?: string;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateService = Omit<Service, "id" | "createdAt" | "updatedAt">;
export type UpdateService = Partial<CreateService>;

export interface ServiceFilter {
  search?: string;
  category?: ServiceCategory;
  status?: RecordStatus;
}
