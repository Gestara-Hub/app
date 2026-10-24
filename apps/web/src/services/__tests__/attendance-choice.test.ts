import { describe, expect, it } from "vitest";
import { pickAttendanceCandidate, type AttendanceCandidate } from "../reports/attendanceChoice";

const candidate = (over: Partial<AttendanceCandidate> & Pick<AttendanceCandidate, "className">): AttendanceCandidate => ({
  classGroupId: over.className,
  session: { id: `${over.className}-s`, date: "2026-10-20", start: "19:00" },
  rosterCount: 3,
  markedCount: 0,
  ...over,
});

describe("Lista de presença: aula escolhida ao abrir (achado 51)", () => {
  it("prefere a aula mais recente com chamada feita, não a primeira turma da lista", () => {
    const picked = pickAttendanceCandidate([
      candidate({ className: "Curso relâmpago", rosterCount: 0, session: { id: "a", date: "2026-10-20", start: "10:00" } }),
      candidate({ className: "Jiu-Jitsu", markedCount: 2, session: { id: "b", date: "2026-10-22", start: "19:00" } }),
      candidate({ className: "Boxe", markedCount: 3, session: { id: "c", date: "2026-10-21", start: "19:00" } }),
    ]);
    expect(picked?.className).toBe("Jiu-Jitsu");
  });

  it("sem chamada em nenhuma, cai na mais recente com alunos", () => {
    const picked = pickAttendanceCandidate([
      candidate({ className: "A", rosterCount: 0 }),
      candidate({ className: "B", session: { id: "b", date: "2026-10-21", start: "08:00" } }),
      candidate({ className: "C", session: { id: "c", date: "2026-10-22", start: "08:00" } }),
    ]);
    expect(picked?.className).toBe("C");
  });

  it("sem aula nem aluno, não escolhe nada (o relatório usa a primeira turma)", () => {
    expect(pickAttendanceCandidate([candidate({ className: "A", rosterCount: 0 })])).toBeUndefined();
    expect(pickAttendanceCandidate([])).toBeUndefined();
  });
});
