/**
 * Documento gerado (relatorio, comprovante, recibo, extrato, demonstrativo):
 * um modelo so, que vira a previa na tela, o PDF (gerado no servidor) e o CSV.
 * Mudar o layout muda todos os documentos; um documento novo so monta os
 * dados neste formato. Valores ficam crus (centavos, datas ISO) e cada saida
 * formata do seu jeito (`DocumentCellFormat`).
 */

/** Como a celula e mostrada: dinheiro em centavos, data ISO, percentual... */
export type DocumentCellFormat =
  | "text"
  | "money"
  | "integer"
  | "percent"
  | "date"
  | "datetime"
  | "phone";

export type DocumentCellValue = string | number | null | undefined;

/** Destaque de um valor: positivo (verde), negativo (vermelho) ou apagado. */
export type DocumentTone = "default" | "positive" | "negative" | "muted";

export interface DocumentColumn {
  key: string;
  label: string;
  format?: DocumentCellFormat;
  align?: "left" | "center" | "right";
  /** Peso da largura (padrao 1); a coluna de assinatura costuma ter 2. */
  width?: number;
}

export interface DocumentTableRow {
  cells: Record<string, DocumentCellValue>;
  /** Tom por coluna (ex.: "Atrasado" em vermelho). */
  tones?: Record<string, DocumentTone>;
}

export interface DocumentTableBlock {
  type: "table";
  title?: string;
  columns: DocumentColumn[];
  rows: DocumentTableRow[];
  /** Linha de total no fim (mesmas colunas). */
  totals?: Record<string, DocumentCellValue>;
  /** Mostrado quando nao ha linhas. */
  emptyText: string;
  /** Numera as linhas (1, 2, 3...), como na lista de presenca. */
  numbered?: boolean;
}

export interface DocumentKpi {
  label: string;
  value: DocumentCellValue;
  format?: DocumentCellFormat;
  /** Linha pequena abaixo do valor. */
  sub?: string;
  tone?: DocumentTone;
}

/** Indicadores no topo (no maximo 4, como nas telas). */
export interface DocumentKpisBlock {
  type: "kpis";
  items: DocumentKpi[];
}

export interface DocumentField {
  label: string;
  value: DocumentCellValue;
  format?: DocumentCellFormat;
  tone?: DocumentTone;
  /** Destaque (ex.: total a pagar). */
  strong?: boolean;
}

/** Pares rotulo e valor (dados do pagamento, do aluno, do demonstrativo). */
export interface DocumentFieldsBlock {
  type: "fields";
  title?: string;
  items: DocumentField[];
}

export interface DocumentTextBlock {
  type: "text";
  title?: string;
  text: string;
  tone?: "default" | "muted";
}

/** Linhas de assinatura no fim (recibo, termo, demonstrativo). */
export interface DocumentSignaturesBlock {
  type: "signatures";
  lines: string[];
}

export type DocumentBlock =
  | DocumentKpisBlock
  | DocumentTableBlock
  | DocumentFieldsBlock
  | DocumentTextBlock
  | DocumentSignaturesBlock;

export interface DocumentHeader {
  organizationName: string;
  /** Linha abaixo do nome: unidade, area, contato. */
  details?: string;
}

export interface DocumentMeta {
  label: string;
  value: string;
}

export interface DocumentModel {
  /** Nome do arquivo sem extensao ("relatorio-alunos-2026-10"). */
  fileName: string;
  title: string;
  /** Linha abaixo do titulo (turma, aluno, periodo...). */
  subtitle?: string;
  header: DocumentHeader;
  /** Periodo, emissao, responsavel, codigo... (canto direito do cabecalho). */
  meta: DocumentMeta[];
  blocks: DocumentBlock[];
  /** Rodape do documento (ex.: aviso legal); a pagina e o "Emitido pelo GestaraHub" sao fixos. */
  footnote?: string;
  /** Pagina deitada (tabelas largas). Padrao: em pe. */
  landscape?: boolean;
}
