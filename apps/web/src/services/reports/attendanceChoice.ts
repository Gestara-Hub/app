/**
 * Lista de presenca sem turma escolhida: abre na aula mais recente que tem
 * chamada feita (senao, a mais recente com alunos), nao numa aula vazia de um
 * curso encerrado (achado 51 do teste de 23/10).
 */
export interface AttendanceCandidate {
  classGroupId: string;
  className: string;
  /** Ultima aula do mes ate hoje. */
  session: { id: string; date: string; start: string };
  rosterCount: number;
  markedCount: number;
}

export function pickAttendanceCandidate(candidates: readonly AttendanceCandidate[]): AttendanceCandidate | undefined {
  const latestFirst = (a: AttendanceCandidate, b: AttendanceCandidate) =>
    `${b.session.date} ${b.session.start}`.localeCompare(`${a.session.date} ${a.session.start}`) ||
    a.className.localeCompare(b.className, "pt-BR");
  const withMarks = candidates.filter((c) => c.markedCount > 0).sort(latestFirst);
  if (withMarks.length > 0) return withMarks[0];
  const withRoster = candidates.filter((c) => c.rosterCount > 0).sort(latestFirst);
  return withRoster[0];
}
