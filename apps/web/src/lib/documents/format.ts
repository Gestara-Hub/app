import type { DocumentCellFormat, DocumentCellValue } from "@gestarahub/contracts";
import { formatCents, formatPhone } from "@gestarahub/core/format";
import { currentSpaceTimeZone } from "@gestarahub/core/date";

/**
 * Formatacao das celulas do documento (`DocumentModel`). A tela e o PDF usam
 * `displayCell`; o CSV usa `csvCell` (numeros que o Excel em pt-BR le como
 * numero: "250,00", "12,5%"). Valor vazio vira "—" na tela e "" no CSV.
 */

const EMPTY = "—";

/**
 * "21/09/2026" (dia ISO fica como esta; instante vai para o fuso do espaco,
 * tambem no servidor, que roda em UTC).
 */
export function documentDate(iso: string): string {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: currentSpaceTimeZone() }).format(new Date(iso));
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-10" -> "Outubro de 2026". */
export function competenceLongLabel(competence: string): string {
  const [year, month] = competence.split("-");
  const name = MONTHS[Number(month) - 1];
  return name ? `${name[0].toUpperCase()}${name.slice(1)} de ${year}` : competence;
}

/** "21/09/2026, 14:05" no fuso do espaco. */
export function documentDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: currentSpaceTimeZone(),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function isEmpty(value: DocumentCellValue): value is null | undefined | "" {
  return value === null || value === undefined || value === "";
}

/** "12,5%". */
function percentText(value: number): string {
  return `${String(Math.round(value * 10) / 10).replace(".", ",")}%`;
}

export function displayCell(value: DocumentCellValue, format: DocumentCellFormat = "text"): string {
  if (isEmpty(value)) return EMPTY;
  switch (format) {
    case "money":
      return formatCents(Number(value) || 0);
    case "integer":
      return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
    case "percent":
      return percentText(Number(value) || 0);
    case "date":
      return documentDate(String(value));
    case "datetime":
      return documentDateTime(String(value));
    case "phone":
      return formatPhone(String(value));
    default:
      return String(value);
  }
}

export function csvCell(value: DocumentCellValue, format: DocumentCellFormat = "text"): string {
  if (isEmpty(value)) return "";
  switch (format) {
    case "money":
      return ((Number(value) || 0) / 100).toFixed(2).replace(".", ",");
    case "integer":
      return String(Number(value) || 0);
    case "percent":
      return percentText(Number(value) || 0);
    case "date":
      return documentDate(String(value));
    case "datetime":
      return documentDateTime(String(value));
    case "phone":
      return formatPhone(String(value));
    default:
      return String(value);
  }
}

/** Linha do espaco no cabecalho dos documentos: "Unidade Centro · (11) 93333-4444" (telefone com mascara, achado 45). */
export function unitHeaderLine(unit: { name?: string; phone?: string } | null | undefined): string | undefined {
  const parts = [unit?.name, unit?.phone ? formatPhone(unit.phone) : undefined].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
