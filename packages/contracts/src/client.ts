import type { Address, DateTimeISO, Id, RecordStatus } from "./common";

export type DiscountType = "percentage" | "fixed";

export interface StudentDiscount {
  type: DiscountType;
  value: number; // centavos se fixed (ex: 3000 = R$ 30,00) ou percentual (ex: 10 = 10%)
  reason?: string;
}

export type MembershipStatus = "active" | "paused" | "canceled";

export interface Client {
  id: Id;
  organizationId: Id;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  address?: Address;
  // Gestão de planos e mensalidade (vínculo no aluno)
  planId?: Id;
  dueDay?: number; // 1 a 31 (dia preferencial de vencimento da mensalidade)
  discount?: StudentDiscount;
  membershipStatus?: MembershipStatus;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateClient = Omit<Client, "id" | "createdAt" | "updatedAt">;
export type UpdateClient = Partial<CreateClient>;

export interface ClientFilter {
  search?: string; // nome ou telefone
  status?: RecordStatus;
  planId?: Id;
  membershipStatus?: MembershipStatus;
}

