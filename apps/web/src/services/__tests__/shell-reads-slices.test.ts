import type { ClassGroupView } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { turmasService, turmasServiceImpl } from "@/services/classes";
import { communicationServiceImpl } from "@/services/communication";
import { onlinePaymentsServiceImpl } from "@/services/onlinePayments";
import { onboardingServiceImpl } from "@/services/settings/onboardingService";
import { settingsServiceImpl } from "@/services/settings/settingsService";
import { sliceFor } from "@/services/world/registry";
import { checkSlice } from "@/services/world/sliceCheck";
import { createClass, createInstructor, createPlan, createStudent, resetAcademy, sessionIdOf } from "@/test/academy";

/**
 * Leituras do topo, do sino e do Painel (toda pagina) com recorte (11/11/2026):
 * antes montavam o espaco inteiro a cada pagina. Cada recorte roda contra o
 * espaco inteiro e o resultado tem de ser igual. Hoje: 22/09/2026 (terca).
 */

const TUE = { weekday: 2 as const, start: "18:00", end: "19:00" };
let group: ClassGroupView;

async function check(name: string, args: unknown[], call: () => Promise<unknown>): Promise<void> {
  const slice = await sliceFor(name);
  if (!slice) throw new Error(`${name} sem recorte`);
  await checkSlice(name, slice, args, call);
}

beforeEach(async () => {
  resetAcademy();
  await createPlan("monthly", 15000);
  const carlos = await createInstructor("Carlos");
  group = await createClass({ name: "Noite", instructorId: carlos.id, slots: [TUE] });
  const ana = await createStudent("Ana");
  const bia = await createStudent("Bia");
  await turmasService.enroll({ classGroupId: group.id, studentId: ana.id });
  await turmasService.enroll({ classGroupId: group.id, studentId: bia.id });
  const today = sessionIdOf(group.id, "2026-09-22", TUE.start);
  await turmasService.markAttendance({ sessionId: today, studentId: ana.id, status: "present" });
  await turmasService.markAttendance({ sessionId: today, studentId: bia.id, status: "absent" });
  // Marcacao de outro dia: nao entra no resumo de hoje.
  await turmasService.markAttendance({ sessionId: sessionIdOf(group.id, "2026-09-15", TUE.start), studentId: ana.id, status: "present" });
});

describe("recortes das leituras de toda pagina", () => {
  it("organizacao e unidade", async () => {
    await check("settings.getOrganization", [], () => settingsServiceImpl.getOrganization());
    await check("settings.getUnit", [], () => settingsServiceImpl.getUnit());
  });

  it("barra da configuracao inicial", async () => {
    await check("onboarding.getOnboardingSnapshot", [], () => onboardingServiceImpl.getOnboardingSnapshot());
  });

  it("conexao do WhatsApp e pagamentos contestados (sino)", async () => {
    await check("communication.getConnection", [], () => communicationServiceImpl.getConnection());
    await check("onlinePayments.listDisputed", [], () => onlinePaymentsServiceImpl.listDisputed());
  });

  it("resumo de presencas do dia (Painel) conta so as aulas do dia", async () => {
    await check("turmas.getAttendanceSummary", ["2026-09-22"], () => turmasServiceImpl.getAttendanceSummary("2026-09-22"));
    expect(await turmasServiceImpl.getAttendanceSummary("2026-09-22")).toEqual({ present: 1, absent: 1, justified: 0, total: 2 });
    expect(store.attendances).toHaveLength(3);
  });
});
