import type {
  DateTimeISO,
  Id,
  RecordStatus,
  WorkingHours,
} from "./common";

export interface Professional {
  id: Id;
  organizationId: Id;
  unitId: Id;
  name: string;
  roleId: Id; // FK -> Role (cargo/especialidade); nome resolvido via store.roles
  phone?: string;
  status: RecordStatus;
  workingHours: WorkingHours[]; // respeita o funcionamento da unidade
  serviceIds: Id[]; // servicos que o profissional realiza (matriz do canon)
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateProfessional = Omit<
  Professional,
  "id" | "createdAt" | "updatedAt"
>;
export type UpdateProfessional = Partial<CreateProfessional>;

export interface ProfessionalFilter {
  search?: string;
  status?: RecordStatus;
  serviceId?: Id; // profissionais que realizam o servico
}

/** Referencia de cargo expandida (id + nome resolvido). */
export interface RoleRef {
  id: Id;
  name: string;
}

/**
 * Read model retornado pelos GET de profissional: o `Professional` com o cargo
 * ja expandido (`role`), espelhando o que a API faria (join no servidor). A UI
 * le `professional.role.name` direto, sem buscar /roles e juntar no cliente.
 */
export interface ProfessionalView extends Professional {
  role: RoleRef;
}
