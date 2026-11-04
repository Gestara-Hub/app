import type { FileAttachment } from "./attachment";
import type { DateISO, DateTimeISO, Id } from "./common";

/**
 * Documentos guardados na ficha do aluno ou do instrutor (04/11/2026, doc
 * product/28): atestado, termo assinado, autorizacao de imagem, registro
 * profissional. O arquivo fica no armazenamento privado do espaco; a linha
 * guarda o tipo, a validade e de quem e.
 */
export type PersonDocumentOwnerKind = "client" | "professional";

export type ClientDocumentKind =
  | "medical_certificate"
  | "liability_waiver"
  | "image_authorization"
  | "medical_report"
  | "graduation_proof"
  | "contract"
  | "other";

export type ProfessionalDocumentKind =
  | "professional_registration"
  | "certification"
  | "contract"
  | "background_check"
  | "other";

export type PersonDocumentKind = ClientDocumentKind | ProfessionalDocumentKind;

export interface PersonDocument {
  id: Id;
  organizationId: Id;
  ownerKind: PersonDocumentOwnerKind;
  /** Aluno dono do documento (ownerKind "client"). */
  clientId?: Id;
  /** Instrutor dono do documento (ownerKind "professional"). */
  professionalId?: Id;
  kind: PersonDocumentKind;
  /** Nome livre: obrigatorio em "other", opcional nos demais. */
  title?: string;
  file: FileAttachment;
  /** Ultimo dia de validade (atestado, registro). Sem data, nao vence. */
  expiresOn?: DateISO;
  notes?: string;
  /** Usuario que anexou. */
  createdBy: Id;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

/** Situacao da validade: sem data, valido, vence em ate 30 dias ou vencido. */
export type PersonDocumentExpiry = "none" | "valid" | "expiring" | "expired";

export interface PersonDocumentView extends PersonDocument {
  /** Nome para a tela: o titulo ou o nome do tipo. */
  label: string;
  expiry: PersonDocumentExpiry;
  /** Dias ate vencer (negativo = vencido ha N dias); ausente sem validade. */
  daysToExpire?: number;
}

export interface CreatePersonDocument {
  ownerKind: PersonDocumentOwnerKind;
  ownerId: Id;
  kind: PersonDocumentKind;
  title?: string;
  file: FileAttachment;
  expiresOn?: DateISO;
  notes?: string;
}

export type UpdatePersonDocument = Partial<Pick<PersonDocument, "kind" | "title" | "expiresOn" | "notes">>;

/** Documento vencendo ou vencido, para o sino e o topo da ficha. */
export interface ExpiringPersonDocument {
  id: Id;
  ownerKind: PersonDocumentOwnerKind;
  ownerId: Id;
  ownerName: string;
  label: string;
  expiresOn: DateISO;
  expiry: Extract<PersonDocumentExpiry, "expiring" | "expired">;
  daysToExpire: number;
}
