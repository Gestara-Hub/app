import { format, parseISO, startOfWeek } from "date-fns";

const STORAGE_KEY = "gestarahub:classes-calendar-query";
const CALENDAR_PATH = "/classes/calendar";

/** Guarda a ultima query do calendario (semana e filtros) nesta aba do navegador. */
export function rememberCalendarQuery(query: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, query);
  } catch {
    // Sem storage (aba privada, bloqueio): o link cai no fallback.
  }
}

/**
 * Link de volta ao calendario a partir de uma aula: a ultima query usada ou,
 * sem ela, a semana da propria aula.
 */
export function calendarHrefFor(sessionDate: string): string {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored ? `${CALENDAR_PATH}?${stored}` : CALENDAR_PATH;
  } catch {
    // Segue para o fallback.
  }
  const week = format(startOfWeek(parseISO(sessionDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
  return `${CALENDAR_PATH}?week=${week}`;
}
