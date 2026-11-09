import type { TrialConversionReportData } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { makeSessionId } from "@/services/classes/classShared";
import { turmasService } from "@/services/classes";
import { categoriesService } from "@/services/catalog/categoriesService";
import { clientsService } from "@/services/clients";
import { reportsService } from "@/services/reports";
import { subscriptionService } from "@/services/subscription/subscriptionService";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/** Aulas experimentais e conversao (09/11/2026). Hoje nos testes: 22/09/2026. */

async function report(competence: string): Promise<TrialConversionReportData> {
  const result = await reportsService.generateReport("trial_conversion", { competence });
  if (result.type !== "trial_conversion") throw new Error("relatorio errado");
  return result.data;
}

describe("relatório de aulas experimentais", () => {
  beforeEach(async () => {
    resetAcademy();
    await subscriptionService.setTier("pro");
  });

  it("conta quem experimentou no mês, quem virou aluno e quem ainda não voltou", async () => {
    const modality = await categoriesService.create({ name: "Natação" });
    const instructor = await createInstructor("Prof", modality.id);
    const group = await turmasService.create({
      name: "Natação Manhã",
      modalityId: modality.id,
      instructorId: instructor.id,
      capacity: 10,
      meetingSlots: [{ weekday: 2, start: "07:00", end: "08:00" }],
      startDate: "2026-08-01",
      status: "active",
    });
    const trial = (studentId: string, date: string) =>
      turmasService.reserveSession({ classGroupId: group.id, sessionId: makeSessionId(group.id, date, "07:00"), studentId, kind: "trial" });

    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    const caio = await createStudent("Caio");
    await trial(ana.id, "2026-09-01");
    await trial(ana.id, "2026-09-08");
    await trial(bia.id, "2026-09-15");
    await trial(caio.id, "2026-08-11");
    // Ana virou aluna pela matricula; Bia e Caio nao voltaram.
    await turmasService.enroll({ classGroupId: group.id, studentId: ana.id });

    const data = await report("2026-09");
    expect(data).toMatchObject({
      trialsInMonth: 2,
      convertedFromMonth: 1,
      conversionRatePercent: 50,
      pendingTotal: 2,
      convertedBy: { enrollment: 1, plan: 0, package: 0 },
    });
    expect(data.converted).toMatchObject([{ studentName: "Ana", convertedBy: "enrollment", firstTrialAt: "2026-09-01" }]);
    expect(data.pending.map((p) => p.studentName)).toEqual(["Bia", "Caio"]);
    expect(data.pending[0]).toMatchObject({ classGroupNames: ["Natação Manhã"], trialCount: 1, daysSinceTrial: 7 });

    // Lista de alunos: o filtro e a ficha seguem a mesma regra.
    const trials = await clientsService.listTrials();
    expect(trials.map((t) => [t.studentName, t.stage])).toEqual([
      ["Bia", "trial"],
      ["Ana", "converted"],
      ["Caio", "trial"],
    ]);
    expect((await clientsService.listPaginated({ trial: "trial" })).items.map((c) => c.name)).toEqual(["Bia", "Caio"]);
  });

  it("quem já era aluno antes da experimental não entra", async () => {
    const modality = await categoriesService.create({ name: "Judô" });
    const instructor = await createInstructor("Prof", modality.id);
    const group = await turmasService.create({
      name: "Judô",
      modalityId: modality.id,
      instructorId: instructor.id,
      capacity: 10,
      meetingSlots: [{ weekday: 2, start: "19:00", end: "20:00" }],
      startDate: "2026-08-01",
      status: "active",
    });
    const other = await turmasService.create({
      name: "Judô Sábado",
      modalityId: modality.id,
      instructorId: instructor.id,
      capacity: 10,
      meetingSlots: [{ weekday: 6, start: "10:00", end: "11:00" }],
      startDate: "2026-08-01",
      status: "active",
    });
    const dan = await createStudent("Dan");
    await turmasService.enroll({ classGroupId: group.id, studentId: dan.id });
    // Ja aluno: experimenta outra turma, nao vira "experimental".
    await turmasService.reserveSession({ classGroupId: other.id, sessionId: makeSessionId(other.id, "2026-09-26", "10:00"), studentId: dan.id, kind: "trial" });
    expect((await report("2026-09")).trialsInMonth).toBe(0);
    expect(await clientsService.listTrials()).toEqual([]);
  });
});
