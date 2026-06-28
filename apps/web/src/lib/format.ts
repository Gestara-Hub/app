/** Formatadores de exibicao (UI em pt-BR). */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Centavos -> "R$ 45,00". */
export function formatCentavos(centavos: number): string {
  return BRL.format(centavos / 100);
}

/** Minutos -> "30 min", "1h", "1h 30min". */
export function formatDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h ${resto}min`;
}

/** ISO -> "27/06/2026". */
export function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}
