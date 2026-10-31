import type { ClassGroupView } from "@gestarahub/contracts";
import { beforeEach, describe, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { turmasService, turmasServiceImpl } from "@/services/classes";
import { communicationServiceImpl } from "@/services/communication";
import { sliceFor } from "@/services/world/registry";
import { checkSlice } from "@/services/world/sliceCheck";
import { createClass, createInstructor, createStudent, resetAcademy, sessionIdOf } from "@/test/academy";

/**
 * Smoke de 31/10/2026: o professor que substitui uma aula de outra turma passa
 * pelas substituicoes para ver a lista de espera e as faltas seguidas (achado
 * S4). O recorte desses metodos nao carregava as substituicoes e o servidor
 * refazia a leitura com o espaco inteiro. Aqui o recorte roda contra o espaco
 * inteiro, como no `WORLD_SLICE_CHECK=1`. Hoje: 22/09/2026 (terca).
 */

const MON = { weekday: 1 as const, start: "15:00", end: "16:00" };

let tarde: ClassGroupView;

async function check(name: string, args: unknown[], call: () => Promise<unknown>): Promise<void> {
  const slice = await sliceFor(name);
  if (!slice) throw new Error(`${name} sem recorte`);
  await checkSlice(name, slice, args, call);
}

beforeEach(async () => {
  resetAcademy();
  const carlos = await createInstructor("Carlos");
  const eva = await createInstructor("Eva");
  tarde = await createClass({ name: "Tarde", instructorId: eva.id, slots: [MON] });
  const ana = await createStudent("Ana");
  await turmasService.enroll({ classGroupId: tarde.id, studentId: ana.id });
  await turmasService.substituteInstructor(sessionIdOf(tarde.id, "2026-09-21", MON.start), { instructorId: carlos.id });
  store.users.push({
    id: "usr-carlos", organizationId: store.organization.id, name: "Carlos", email: "carlos@teste.local", profile: "professional",
    professionalId: carlos.id, status: "active", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  });
  setCurrentActor({ userId: "usr-carlos", name: "Carlos", profile: "professional" });
});

describe("recorte com o professor substituto", () => {
  it("lista de espera da turma em que substitui", async () => {
    await check("turmas.listWaitlist", [tarde.id], () => turmasServiceImpl.listWaitlist(tarde.id));
  });

  it("lembretes (faltas seguidas) com a turma em que substitui", async () => {
    await check("communication.getReminderSources", [], () => communicationServiceImpl.getReminderSources());
  });
});
