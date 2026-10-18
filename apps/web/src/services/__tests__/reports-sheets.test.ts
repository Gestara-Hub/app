import type { AttendanceReportData, ChurnReportData, StudentRosterReportData } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/mocks/store";
import { reportsService } from "@/services/reportsService";
import { subscriptionService } from "@/services/subscriptionService";
import { turmasService } from "@/services/turmasService";
import { createClass, createInstructor, createStudent, resetAcademy, sessionIdOf } from "@/test/academy";

/**
 * Relatorios da rodada de testes de 18/10/2026 (Prioridade 2): lista de
 * presenca por turma e aula, relacao de alunos do mes e retencao pelas
 * matriculas. Hoje congelado em 22/09/2026 (terca); aulas de segunda.
 */

const MON = { weekday: 1 as const, start: "18:00", end: "19:00" };

async function attendance(filter: Record<string, string> = {}): Promise<AttendanceReportData> {
  const report = await reportsService.generateReport("attendance_sheet", { competence: "2026-09", ...filter });
  if (report.type !== "attendance_sheet") throw new Error("relatorio errado");
  return report.data;
}

beforeEach(() => resetAcademy());

describe("lista de presença", () => {
  it("mostra a última aula do mês da turma, com a marcação de cada aluno", async () => {
    const teacher = await createInstructor("Carlos");
    const g = await createClass({ name: "Adulto", instructorId: teacher.id, slots: [MON] });
    const ana = await createStudent("Ana");
    const beto = await createStudent("Beto");
    // Matriculados antes das aulas do mes (a lista mostra quem estava na turma no dia).
    vi.setSystemTime(new Date("2026-09-01T12:00:00"));
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: beto.id });
    vi.setSystemTime(new Date("2026-09-22T12:00:00"));
    const last = sessionIdOf(g.id, "2026-09-21", MON.start);
    await turmasService.markAttendance({ sessionId: last, studentId: ana.id, status: "present" });

    const data = await attendance();
    expect(data).toMatchObject({ classGroupId: g.id, sessionId: last, totalPresent: 1, totalUnmarked: 1 });
    expect(data.sessionOptions.map((s) => s.date)).toEqual(["2026-09-14", "2026-09-21"]);
    expect(data.rows.map((r) => `${r.studentName} ${r.status}`)).toEqual(["Ana present", "Beto unmarked"]);
  });

  it("escolhe a turma e a aula", async () => {
    const teacher = await createInstructor("Carlos");
    const a = await createClass({ name: "A Kids", instructorId: teacher.id, slots: [MON] });
    const b = await createClass({ name: "B Adulto", instructorId: teacher.id, slots: [{ ...MON, start: "20:00", end: "21:00" }] });
    const ana = await createStudent("Ana");
    await turmasService.enroll({ classGroupId: b.id, studentId: ana.id });
    const first = sessionIdOf(b.id, "2026-09-14", "20:00");
    await turmasService.markAttendance({ sessionId: first, studentId: ana.id, status: "justified" });

    expect((await attendance()).classGroupId).toBe(a.id);
    const data = await attendance({ classGroupId: b.id, sessionId: first });
    expect(data).toMatchObject({ sessionId: first, sessionDate: "2026-09-14", totalJustified: 1 });
  });

  it("mês antes da turma começar não tem aula (nada de todos 'Ausente')", async () => {
    const teacher = await createInstructor("Carlos");
    await createClass({ name: "Adulto", instructorId: teacher.id, slots: [MON] });
    const data = await attendance({ competence: "2026-08" });
    expect(data.sessionId).toBeUndefined();
    expect(data.rows).toEqual([]);
  });
});

describe("relação de alunos do mês", () => {
  it("só quem já estava cadastrado no mês escolhido", async () => {
    const ana = await createStudent("Ana");
    store.clients.find((c) => c.id === ana.id)!.createdAt = "2026-08-10T12:00:00.000Z";
    await createStudent("Beto"); // cadastrado hoje (22/09)
    const report = await reportsService.generateReport("students_roster", { competence: "2026-08" });
    const data = report.data as StudentRosterReportData;
    expect(data.rows.map((r) => r.name)).toEqual(["Ana"]);
  });
});

describe("retenção pelas matrículas", () => {
  it("início + novos − saíram = fim", async () => {
    await subscriptionService.setTier("pro");
    const teacher = await createInstructor("Carlos");
    const g = await createClass({ name: "Adulto", instructorId: teacher.id, slots: [MON] });
    vi.setSystemTime(new Date("2026-08-20T12:00:00"));
    const ana = await createStudent("Ana");
    const beto = await createStudent("Beto");
    const anaEnrollment = await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: beto.id });
    vi.setSystemTime(new Date("2026-09-10T12:00:00"));
    await turmasService.cancelEnrollment(anaEnrollment.id);
    const caio = await createStudent("Caio");
    await turmasService.enroll({ classGroupId: g.id, studentId: caio.id });
    vi.setSystemTime(new Date("2026-09-22T12:00:00"));

    const report = await reportsService.generateReport("churn_retention", { competence: "2026-09" });
    const data = report.data as ChurnReportData;
    expect(data).toMatchObject({
      activeStudentsStart: 2,
      newEnrollments: 1,
      cancellations: 1,
      activeStudentsEnd: 2,
      netGrowth: 0,
      churnRatePercent: 50,
      retentionRatePercent: 50,
    });
    expect(data.modalitiesBreakdown).toEqual([{ modalityName: "Adulto", activeCount: 2, churnRatePercent: 50 }]);
  });
});
