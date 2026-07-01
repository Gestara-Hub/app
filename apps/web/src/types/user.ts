import type { DateTimeISO, Id, RecordStatus } from "./common";

/**
 * Perfil de acesso do usuario (RBAC). Codigos em ingles; rotulos PT via
 * `userProfileLabel` (lib/labels). NAO confundir com `Role` (= Cargo do
 * profissional, FK `Professional.roleId`): perfil controla o que o usuario
 * pode fazer no sistema; cargo e a funcao/especialidade no negocio.
 */
export type UserProfile = "owner" | "manager" | "attendant" | "professional";

export interface User {
  id: Id;
  organizationId: Id;
  name: string;
  email: string;
  profile: UserProfile;
  // Vinculo opcional com um Professional: usuarios de perfil "professional"
  // costumam ter; proprietario/atendente normalmente nao.
  professionalId?: Id;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateUser = Omit<User, "id" | "createdAt" | "updatedAt">;
export type UpdateUser = Partial<CreateUser>;

export interface UserFilter {
  search?: string;
  status?: RecordStatus;
  profile?: UserProfile;
}

/**
 * Read model retornado pelos GET de usuario: o `User` com o profissional
 * vinculado ja expandido (espelha o join que a API faria). A UI le
 * `user.professional?.name` direto, sem buscar /professionals e juntar.
 */
export interface UserView extends User {
  professional?: { id: Id; name: string; status: RecordStatus };
}
