import type { DateISO, DateTimeISO, Id, TimeISO, TenantScopeFields } from "./common";

export interface TimeBlock {
  id: Id;
  organizationId: Id;
  unitId: Id;
  professionalId: Id;
  date: DateISO;
  start: TimeISO;
  end: TimeISO;
  reason?: string; // ex.: 'Almoco', 'Folga'
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateTimeBlock = Omit<
  TimeBlock,
  "id" | "createdAt" | "updatedAt" | TenantScopeFields
>;
export type UpdateTimeBlock = Partial<CreateTimeBlock>;

export interface TimeBlockFilter {
  dateFrom?: DateISO;
  dateTo?: DateISO;
  professionalId?: Id;
}
