import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const dateTime = (date: Date | null | undefined) => (date ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—");
export const dateOnly = (date: Date | null | undefined) => (date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "—");
export const ago = (date: Date | null | undefined) => (date ? formatDistanceToNowStrict(date, { locale: ptBR, addSuffix: true }) : "Nunca");

/** "AAAA-MM-DD" para "DD/MM/AAAA". */
export const brDay = (day: string | null | undefined) => (day ? day.split("-").reverse().join("/") : "—");

/** Instante para o campo datetime-local, em horario de Brasilia (sem fuso). */
export function toBrasiliaInput(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date.getTime() - 3 * 3600_000).toISOString().slice(0, 16);
}
