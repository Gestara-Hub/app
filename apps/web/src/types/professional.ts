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
  role: string; // cargo ou especialidade (ex.: 'Barbeiro e proprietario')
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
