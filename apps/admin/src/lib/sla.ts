import { addDays } from "date-fns";

/**
 * Meta de resposta do suporte: no maximo 2 dias uteis desde a ultima mensagem da
 * pessoa (decisao do dono, doc technical/26). So lembrete: nao bloqueia nada.
 * Dias uteis = segunda a sexta no horario de Brasilia; feriado nao entra na conta.
 */
export const TARGET_BUSINESS_DAYS = 2;

const DAY_FORMAT = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** "2026-10-24" do instante, em Brasilia. */
export function brasiliaDay(instant: Date): string {
  return DAY_FORMAT.format(instant);
}

function weekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

const isBusinessDay = (day: string) => ![0, 6].includes(weekday(day));

/** Soma dias uteis a um dia ("AAAA-MM-DD"). Comecando em fim de semana, conta a partir da segunda. */
export function addBusinessDays(day: string, count: number): string {
  let current = day;
  let left = count;
  while (left > 0) {
    current = DAY_FORMAT.format(addDays(new Date(`${current}T12:00:00Z`), 1));
    if (isBusinessDay(current)) left -= 1;
  }
  return current;
}

export type SlaState = "ok" | "last_day" | "late";

export interface SlaInfo {
  state: SlaState;
  /** Dia limite da primeira resposta ("AAAA-MM-DD"). */
  dueOn: string;
}

/** Situacao da meta para uma conversa que espera resposta nossa desde `since`. */
export function slaFor(since: Date, now: Date, targetDays = TARGET_BUSINESS_DAYS): SlaInfo {
  const dueOn = addBusinessDays(brasiliaDay(since), targetDays);
  const today = brasiliaDay(now);
  if (today > dueOn) return { state: "late", dueOn };
  if (today === dueOn) return { state: "last_day", dueOn };
  return { state: "ok", dueOn };
}

export const SLA_LABEL: Record<SlaState, string> = { ok: "No prazo", last_day: "Último dia", late: "Atrasado" };
