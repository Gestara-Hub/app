import type {
  ClientDocumentKind,
  PersonDocumentExpiry,
  PersonDocumentKind,
  PersonDocumentOwnerKind,
  ProfessionalDocumentKind,
} from "@gestarahub/contracts";

/**
 * Regras dos documentos da ficha (aluno e instrutor), doc product/28: tipos de
 * cada um, nome na tela e situacao da validade. Puro, sem store.
 */

/** "Vence em breve" a partir de 30 dias antes. */
export const DOCUMENT_EXPIRING_DAYS = 30;
export const MAX_DOCUMENT_TITLE_LENGTH = 80;
export const MAX_DOCUMENT_NOTES_LENGTH = 500;

export const CLIENT_DOCUMENT_KINDS: { value: ClientDocumentKind; label: string; expires: boolean }[] = [
  { value: "medical_certificate", label: "Atestado médico", expires: true },
  { value: "liability_waiver", label: "Termo de responsabilidade", expires: false },
  { value: "image_authorization", label: "Autorização de imagem", expires: false },
  { value: "medical_report", label: "Laudo ou orientação médica", expires: false },
  { value: "graduation_proof", label: "Comprovante de graduação", expires: false },
  { value: "contract", label: "Contrato", expires: false },
  { value: "other", label: "Outro", expires: false },
];

export const PROFESSIONAL_DOCUMENT_KINDS: { value: ProfessionalDocumentKind; label: string; expires: boolean }[] = [
  { value: "professional_registration", label: "Registro profissional (CREF)", expires: true },
  { value: "certification", label: "Certificado de formação", expires: false },
  { value: "contract", label: "Contrato", expires: false },
  { value: "background_check", label: "Antecedentes criminais", expires: true },
  { value: "other", label: "Outro", expires: false },
];

export function documentKindsFor(ownerKind: PersonDocumentOwnerKind) {
  return ownerKind === "client" ? CLIENT_DOCUMENT_KINDS : PROFESSIONAL_DOCUMENT_KINDS;
}

/** O tipo vale para este dono? (o instrutor nao tem atestado; o aluno nao tem CREF). */
export function isDocumentKindOf(ownerKind: PersonDocumentOwnerKind, kind: string): kind is PersonDocumentKind {
  return documentKindsFor(ownerKind).some((k) => k.value === kind);
}

/** O tipo costuma ter validade (o formulario mostra a data de cara). */
export function documentKindExpires(ownerKind: PersonDocumentOwnerKind, kind: PersonDocumentKind): boolean {
  return documentKindsFor(ownerKind).find((k) => k.value === kind)?.expires ?? false;
}

/** Nome do documento na tela: o titulo dado ou o nome do tipo. */
export function documentLabel(ownerKind: PersonDocumentOwnerKind, kind: PersonDocumentKind, title?: string): string {
  const trimmed = title?.trim();
  if (trimmed) return trimmed;
  return documentKindsFor(ownerKind).find((k) => k.value === kind)?.label ?? "Documento";
}

/** Dias de `from` ate `to` (datas AAAA-MM-DD; negativo se `to` ja passou). */
function daysUntil(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Situacao da validade no dia `today`. O ultimo dia ainda vale: vencido so no
 * dia seguinte ao `expiresOn`.
 */
export function documentExpiry(
  expiresOn: string | undefined,
  today: string,
): { expiry: PersonDocumentExpiry; daysToExpire?: number } {
  if (!expiresOn) return { expiry: "none" };
  const daysToExpire = daysUntil(today, expiresOn);
  if (daysToExpire < 0) return { expiry: "expired", daysToExpire };
  if (daysToExpire <= DOCUMENT_EXPIRING_DAYS) return { expiry: "expiring", daysToExpire };
  return { expiry: "valid", daysToExpire };
}

/** Frase curta da validade: "Vence hoje", "Vence em 12 dias", "Venceu há 3 dias". */
export function documentExpiryText(daysToExpire: number | undefined): string | undefined {
  if (daysToExpire === undefined) return undefined;
  if (daysToExpire === 0) return "Vence hoje";
  if (daysToExpire === 1) return "Vence amanhã";
  if (daysToExpire > 1) return `Vence em ${daysToExpire} dias`;
  if (daysToExpire === -1) return "Venceu ontem";
  return `Venceu há ${-daysToExpire} dias`;
}
