import type { DateTimeISO, Id, RecordStatus } from "./common";

/**
 * Cargo do profissional — entidade da organizacao (nao mais texto livre).
 * Criado implicitamente pelo autocomplete da Equipe e referenciado por
 * `Professional.roleId`. Modelar como entidade habilita relatorios/dashboards
 * por cargo de forma canonica (sem drift de string). `position` controla a
 * ordem de exibicao (igual a Category).
 */
export interface Role {
  id: Id;
  organizationId: Id;
  name: string;
  position: number;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

// position/status sao opcionais na criacao: o autocomplete cria um cargo so com
// o nome; o service atribui a proxima position e status "active".
export type CreateRole = Omit<
  Role,
  "id" | "position" | "status" | "createdAt" | "updatedAt"
> & {
  position?: number;
  status?: RecordStatus;
};
export type UpdateRole = Partial<Pick<Role, "name" | "position" | "status">>;

export interface RoleFilter {
  search?: string;
  status?: RecordStatus;
}
