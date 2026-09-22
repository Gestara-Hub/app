import type { DateTimeISO, Id, RecordStatus, TenantScopeFields } from "./common";

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

// position/status sao opcionais na criacao: a gestao cria so com o nome; o
// service atribui a proxima position e status "active".
export type CreateCategory = Omit<
  Category,
  "id" | "position" | "status" | "createdAt" | "updatedAt" | TenantScopeFields
> & {
  position?: number;
  status?: RecordStatus;
};
export type UpdateCategory = Partial<Pick<Category, "name" | "position" | "status">>;

export interface CategoryFilter {
  search?: string;
  status?: RecordStatus;
}
