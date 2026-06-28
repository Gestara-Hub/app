/** Formatadores de exibicao (UI em pt-BR). */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Centavos -> "R$ 45,00". */
export function formatCents(cents: number): string {
  return BRL.format(cents / 100);
}

/** Minutos -> "30 min", "1h", "1h 30min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

/** ISO -> "27/06/2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}
