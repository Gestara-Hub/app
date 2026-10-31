import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { clientsService } from "@/services/clients";
import { turmasService } from "@/services/classes";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * Revisao geral de 31/10/2026 (achado S2): pelo caminho da aula, o professor
 * registrava evolucao em qualquer aluno; e as escritas da evolucao devolviam o
 * cadastro inteiro (CPF, endereco, desconto) ao professor.
 */

beforeEach(() => resetAcademy());

async function setup() {
  const modality = await categoriesService.create({ name: "Jiu-Jitsu" });
  const teacher = await createInstructor("Prof Ana", modality.id);
  const group = await turmasService.create({
    name: "Turma da Ana",
    modalityId: modality.id,
    instructorId: teacher.id,
    capacity: 10,
    meetingSlots: [{ weekday: 2, start: "08:00", end: "09:00" }],
    startDate: "2026-09-01",
    status: "active",
  });
  const mine = await createStudent("Aluno da Ana");
  const other = await createStudent("Aluno de fora");
  store.clients.find((c) => c.id === mine.id)!.cpf = "52998224725";
  await turmasService.enroll({ classGroupId: group.id, studentId: mine.id });
  store.users.push({
    id: "usr-prof-ana",
    organizationId: store.organization.id,
    name: "Prof Ana",
    email: "ana@teste.local",
    profile: "professional",
    professionalId: teacher.id,
    status: "active",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
  setCurrentActor({ userId: "usr-prof-ana", name: "Prof Ana", profile: "professional" });
  return { modality, group, mine, other, sessionId: `${group.id}~2026-09-22~08:00` };
}

describe("professor: evolução pela aula", () => {
  it("registra no aluno da turma e recebe o aluno sem CPF", async () => {
    const { modality, group, mine, sessionId } = await setup();
    const updated = await clientsService.addClassRecord({
      studentId: mine.id,
      modalityId: modality.id,
      classGroupId: group.id,
      sessionId,
      date: "2026-09-22",
      tone: "positive",
      note: "Boa aula",
    });
    expect(updated.cpf).toBeUndefined();
  });

  it("não registra em aluno de fora da turma, mesmo passando a aula dele", async () => {
    const { modality, group, other, sessionId } = await setup();
    await expect(
      clientsService.addClassRecord({
        studentId: other.id,
        modalityId: modality.id,
        classGroupId: group.id,
        sessionId,
        date: "2026-09-22",
        tone: "positive",
        note: "x",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("visão de graduação: só dos alunos dele", async () => {
    const { mine, other } = await setup();
    await expect(clientsService.getProgressionOverview(mine.id)).resolves.toMatchObject({ studentId: mine.id });
    await expect(clientsService.getProgressionOverview(other.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
