import type { ClassSessionStatus, DateISO, Id, TimeISO } from "@gestarahub/contracts";

/**
 * Atalho da turma para a chamada: a aula de hoje (a que ja comecou mais
 * recente; se nenhuma comecou, a primeira do dia) ou, sem aula hoje, a
 * proxima. Aula cancelada nao conta. Lista em ordem de data e horario.
 */
export interface SessionLike {
  id: Id;
  date: DateISO;
  start: TimeISO;
  status: ClassSessionStatus;
}

export function pickNextSession<T extends SessionLike>(sessions: readonly T[], today: DateISO, now: TimeISO): T | null {
  const open = sessions.filter((s) => s.status !== "canceled" && s.date >= today);
  const todays = open.filter((s) => s.date === today);
  if (todays.length > 0) {
    const started = todays.filter((s) => s.start <= now);
    return started.at(-1) ?? todays[0];
  }
  return open[0] ?? null;
}
