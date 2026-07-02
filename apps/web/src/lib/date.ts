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
