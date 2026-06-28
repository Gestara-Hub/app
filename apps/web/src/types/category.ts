import type { DateTimeISO, Id, RecordStatus } from "./common";

/**
 * Categoria de servico — entidade da organizacao (nao mais um enum fixo).
 * Semeada por segmento (barbearia: Cabelo/Barba/Cuidados/Combos) e editavel
 * pelo tenant. `position` controla a ordem de exibicao.
 */
export interface Category {
  id: Id;
  organizationId: Id;
  name: string;
  position: number;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateCategory = Omit<Category, "id" | "createdAt" | "updatedAt">;
export type UpdateCategory = Partial<CreateCategory>;

export interface CategoryFilter {
  search?: string;
  status?: RecordStatus;
}
