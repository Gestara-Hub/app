/** Data de hoje (local) em 'YYYY-MM-DD'. "Hoje" real da UI. */
export function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Hora atual (local) em 'HH:mm'. */
export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * `true` se a data ('YYYY-MM-DD') + horario ('HH:mm') forem anteriores a agora.
 * Compara strings (formato fixo). Sem data, retorna `false` (nada a checar).
 */
export function isPastSlot(date: string | undefined, start: string): boolean {
  if (!date) return false;
  const today = todayISO();
  if (date < today) return true;
  if (date > today) return false;
  return Boolean(start) && start < nowTime();
}

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function utcDayOf(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Data curta e relativa (pt-BR) para listas e historicos:
 * - "hoje", "ontem", "há 3 dias" (ate 6 dias); no futuro "amanhã", "em 3 dias";
 * - "28 jan" no mesmo ano;
 * - "01/2026" em outro ano.
 * Com `relative: false`, so a forma curta ("28 jan" / "01/2026").
 */
export function relativeDateLabel(
  iso: string,
  opts: { today?: string; relative?: boolean } = {},
): string {
  if (!iso || iso.length < 10) return iso ?? "";
  const today = opts.today ?? todayISO();
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (opts.relative !== false) {
    const diff = Math.round((utcDayOf(today) - utcDayOf(iso)) / 86_400_000);
    if (diff === 0) return "hoje";
    if (diff === 1) return "ontem";
    if (diff === -1) return "amanhã";
    if (diff > 1 && diff <= 6) return `há ${diff} dias`;
    if (diff < -1 && diff >= -6) return `em ${-diff} dias`;
  }
  if (y === Number(today.slice(0, 4))) return `${d} ${MONTHS_SHORT[m - 1]}`;
  return `${String(m).padStart(2, "0")}/${y}`;
}

/**
 * Tempo desde um instante, para "Atualizado ..." (pt-BR): "agora mesmo" (menos
 * de 1 minuto), "há 5 min", "há 2 h", "há 3 dias". Instante no futuro (relogio
 * adiantado) conta como agora.
 */
export function elapsedLabel(fromMs: number, nowMs: number = Date.now()): string {
  const minutes = Math.floor(Math.max(0, nowMs - fromMs) / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}
