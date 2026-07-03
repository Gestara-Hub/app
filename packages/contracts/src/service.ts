import type { DateTimeISO, Id, RecordStatus } from "./common";

export interface Service {
  id: Id;
  organizationId: Id;
  name: string;
  categoryId: Id; // referencia a entidade Category
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
  categoryId?: Id;
  status?: RecordStatus;
}
