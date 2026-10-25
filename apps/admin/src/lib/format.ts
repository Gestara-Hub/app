export const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/** "AAAA-MM-DD" para "DD/MM/AAAA". */
export const brDay = (day: string | null | undefined) => (day ? day.split("-").reverse().join("/") : "—");

/** Instante para o campo datetime-local, em horario de Brasilia (sem fuso). */
export function toBrasiliaInput(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date.getTime() - 3 * 3600_000).toISOString().slice(0, 16);
}
