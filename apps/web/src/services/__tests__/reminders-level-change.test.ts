import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { clientsService } from "@/services/clients";
import { communicationService } from "@/services/communication";
import { turmasService } from "@/services/classes";
import { createClass, createInstructor, resetAcademy } from "@/test/academy";

/**
 * Troca de nivel pela idade nos lembretes (11/11/2026): o sino conta por aqui,
 * sem baixar a lista de alunos. Mesma regra do Painel: passou da idade do nivel,
 * matriculado numa turma da modalidade. Hoje: 22/09/2026.
 */

let modalityId: string;

async function studentOnKids(name: string, phone: string) {
  const s = await clientsService.create({ name, phone, status: "active", birthDate: "2018-05-10" });
  await clientsService.addClassRecord({ studentId: s.id, modalityId, date: "2026-09-20", tone: "general", note: "Primeira aula" });
  // Fez 14 anos (a data de nascimento foi corrigida): passou do Kids (ate 12).
  const stored = store.clients.find((c) => c.id === s.id)!;
  stored.birthDate = "2012-05-10";
  return s;
}

beforeEach(async () => {
  resetAcademy();
  const modality = await categoriesService.create({
    name: "Lutinha",
    progressionTrack: {
      enabled: true,
      criteriaType: "attendance",
      style: "levels",
      levels: [
        { id: "kids", name: "Kids", maxSubLevels: 0, maxAge: 12 },
        { id: "adult", name: "Adulto", maxSubLevels: 0, minAge: 13 },
      ],
    },
  });
  modalityId = modality.id;
});

describe("lembretes: troca de nivel pela idade", () => {
  it("conta so quem passou da idade e esta matriculado na modalidade", async () => {
    const group = await createClass({
      name: "Lutinha 18h",
      instructorId: (await createInstructor("Carlos", modalityId)).id,
      slots: [{ weekday: 1, start: "18:00", end: "19:00" }],
    });
    const enrolled = await studentOnKids("Davi", "11977770001");
    await studentOnKids("Eva", "11977770002"); // nao matriculada: fica de fora
    await turmasService.enroll({ classGroupId: group.id, studentId: enrolled.id });

    const sources = await communicationService.getReminderSources();
    expect(sources.levelChanges).toEqual([{ studentId: enrolled.id, modalityId }]);
  });

  it("sem idade estourada, nada a trocar", async () => {
    expect((await communicationService.getReminderSources()).levelChanges).toEqual([]);
  });
});
