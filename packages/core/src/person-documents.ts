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

/**
 * Nome livre do documento: "required" pede (Outro), "optional" e o "Qual
 * documento" (RG, CNH) dos de identificacao, "none" nao mostra o campo.
 */
export type DocumentTitleMode = "none" | "optional" | "required";

export interface DocumentKindInfo<K extends PersonDocumentKind = PersonDocumentKind> {
  value: K;
  label: string;
  /** Titulo do grupo na selecao ("Saúde", "Identificação"); vazio = so uma linha separando (o "Outro"). */
  group: string;
  /** Costuma vencer: o campo "Válido até" vem como esperado. */
  expires: boolean;
  title: DocumentTitleMode;
  /**
   * Aposentado: sai da selecao de documento novo, mas os ja guardados seguem
   * com nome e icone. Para tirar um tipo, marque aqui em vez de apagar a linha.
   */
  retired?: boolean;
}

/**
 * Tipos do aluno, na ordem da selecao. Fonte unica: o banco nao lista os tipos
 * (migracao 85); acrescentar um tipo e uma linha aqui, o contrato e o icone.
 */
export const CLIENT_DOCUMENT_KINDS: DocumentKindInfo<ClientDocumentKind>[] = [
  { value: "medical_certificate", label: "Atestado médico", group: "Saúde", expires: true, title: "none" },
  { value: "health_questionnaire", label: "Ficha de anamnese ou PAR-Q", group: "Saúde", expires: true, title: "none" },
  { value: "dermatological_exam", label: "Exame dermatológico", group: "Saúde", expires: true, title: "none" },
  { value: "medical_report", label: "Laudo ou orientação médica", group: "Saúde", expires: false, title: "none" },
  { value: "identity_document", label: "Documento de identificação", group: "Identificação", expires: false, title: "optional" },
  { value: "guardian_document", label: "Documento do responsável", group: "Identificação", expires: false, title: "optional" },
  { value: "proof_of_address", label: "Comprovante de residência", group: "Identificação", expires: false, title: "none" },
  { value: "liability_waiver", label: "Termo de responsabilidade", group: "Autorizações e termos", expires: false, title: "none" },
  { value: "image_authorization", label: "Autorização de imagem", group: "Autorizações e termos", expires: false, title: "none" },
  { value: "pickup_authorization", label: "Autorização para buscar o aluno", group: "Autorizações e termos", expires: false, title: "none" },
  { value: "competition_authorization", label: "Autorização para competição ou viagem", group: "Autorizações e termos", expires: false, title: "none" },
  { value: "graduation_proof", label: "Comprovante de graduação", group: "Esporte", expires: false, title: "none" },
  { value: "federation_membership", label: "Filiação à federação", group: "Esporte", expires: true, title: "none" },
  { value: "contract", label: "Contrato", group: "Contratos e financeiro", expires: false, title: "none" },
  { value: "discount_proof", label: "Comprovante para desconto", group: "Contratos e financeiro", expires: true, title: "none" },
  { value: "other", label: "Outro", group: "", expires: false, title: "required" },
];

/** Tipos do instrutor, na ordem da selecao (mesma regra dos do aluno). */
export const PROFESSIONAL_DOCUMENT_KINDS: DocumentKindInfo<ProfessionalDocumentKind>[] = [
  { value: "identity_document", label: "Documento de identificação", group: "Identificação", expires: false, title: "optional" },
  { value: "proof_of_address", label: "Comprovante de residência", group: "Identificação", expires: false, title: "none" },
  { value: "professional_registration", label: "Registro profissional (CREF)", group: "Formação e registro", expires: true, title: "none" },
  { value: "degree", label: "Diploma", group: "Formação e registro", expires: false, title: "none" },
  { value: "certification", label: "Certificado de formação", group: "Formação e registro", expires: false, title: "none" },
  { value: "first_aid", label: "Primeiros socorros", group: "Formação e registro", expires: true, title: "none" },
  { value: "water_rescue", label: "Salvamento aquático", group: "Formação e registro", expires: true, title: "none" },
  { value: "federation_membership", label: "Filiação à federação", group: "Formação e registro", expires: true, title: "none" },
  { value: "contract", label: "Contrato", group: "Contratos", expires: false, title: "none" },
  { value: "business_registration", label: "Cartão CNPJ ou MEI", group: "Contratos", expires: false, title: "none" },
  { value: "background_check", label: "Antecedentes criminais", group: "Contratos", expires: true, title: "none" },
  { value: "other", label: "Outro", group: "", expires: false, title: "required" },
];

/** Categoria da selecao (primeiro campo do formulario): o grupo e os tipos dele. */
export interface DocumentCategory {
  /** O grupo do tipo ("Saúde"); vazio no "Outro". */
  key: string;
  label: string;
  kinds: DocumentKindInfo[];
}

/**
 * Categorias do dono, na ordem da lista, so com tipos que podem ser escolhidos
 * (mais o tipo atual do documento, se aposentado). O grupo vazio vira "Outro".
 */
export function documentCategoriesFor(ownerKind: PersonDocumentOwnerKind, keepKind?: string): DocumentCategory[] {
  const categories: DocumentCategory[] = [];
  for (const kind of documentKindsFor(ownerKind)) {
    if (kind.retired && kind.value !== keepKind) continue;
    let category = categories.find((c) => c.key === kind.group);
    if (!category) {
      category = { key: kind.group, label: kind.group || "Outro", kinds: [] };
      categories.push(category);
    }
    category.kinds.push(kind);
  }
  return categories;
}

/** Categoria (grupo) de um tipo, para abrir o documento ja guardado. */
export function documentCategoryOf(ownerKind: PersonDocumentOwnerKind, kind: string): string | undefined {
  return documentKindsFor(ownerKind).find((k) => k.value === kind)?.group;
}

/** Todos os tipos do dono, inclusive os aposentados (para mostrar o que ja existe). */
export function documentKindsFor(ownerKind: PersonDocumentOwnerKind): DocumentKindInfo[] {
  return ownerKind === "client" ? CLIENT_DOCUMENT_KINDS : PROFESSIONAL_DOCUMENT_KINDS;
}

/** Tipos que aparecem na selecao de documento novo (sem os aposentados). */
export function selectableDocumentKinds(ownerKind: PersonDocumentOwnerKind): DocumentKindInfo[] {
  return documentKindsFor(ownerKind).filter((k) => !k.retired);
}

function kindInfo(ownerKind: PersonDocumentOwnerKind, kind: string): DocumentKindInfo | undefined {
  return documentKindsFor(ownerKind).find((k) => k.value === kind);
}

/** O tipo e deste dono (o instrutor nao tem atestado; o aluno nao tem CREF)? Aceita aposentado. */
export function isDocumentKindOf(ownerKind: PersonDocumentOwnerKind, kind: string): kind is PersonDocumentKind {
  return Boolean(kindInfo(ownerKind, kind));
}

/** Pode ser escolhido agora (do dono e nao aposentado)? */
export function isSelectableDocumentKind(ownerKind: PersonDocumentOwnerKind, kind: string): kind is PersonDocumentKind {
  const info = kindInfo(ownerKind, kind);
  return Boolean(info && !info.retired);
}

/** O tipo costuma ter validade (o formulario mostra a data como esperada). */
export function documentKindExpires(ownerKind: PersonDocumentOwnerKind, kind: PersonDocumentKind): boolean {
  return kindInfo(ownerKind, kind)?.expires ?? false;
}

/** Como o tipo usa o nome livre (Outro pede; identificacao tem "Qual documento"). */
export function documentTitleMode(ownerKind: PersonDocumentOwnerKind, kind: PersonDocumentKind): DocumentTitleMode {
  return kindInfo(ownerKind, kind)?.title ?? "none";
}

/**
 * Nome do documento na tela: no "Outro", o nome dado; na identificacao,
 * "Documento de identificação (CNH)"; nos demais, o nome do tipo.
 */
export function documentLabel(ownerKind: PersonDocumentOwnerKind, kind: PersonDocumentKind, title?: string): string {
  const info = kindInfo(ownerKind, kind);
  const base = info?.label ?? "Documento";
  const trimmed = title?.trim();
  if (!trimmed || !info || info.title === "none") return base;
  return info.title === "required" ? trimmed : `${base} (${trimmed})`;
}

/**
 * Chave do aviso de vencimento: por pessoa, vale o documento de validade mais
 * longa de cada chave. O nome entra onde ele diferencia (a CNH vencida nao some
 * porque o RG esta em dia).
 */
export function documentExpiryGroupKey(ownerKind: PersonDocumentOwnerKind, kind: PersonDocumentKind, title?: string): string {
  const mode = documentTitleMode(ownerKind, kind);
  const name = mode === "none" ? "" : (title ?? "").trim().toLowerCase();
  return `${kind}:${name}`;
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
