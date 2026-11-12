import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { clientsService } from "@/services/clients";
import { createClass, createInstructor, createStudent, resetAcademy } from "@/test/academy";
import { turmasService } from "@/services/classes";

// Seletores de aluno enxutos (12/11/2026): so o que a escolha mostra.
const OWNER = { userId: "usr-dono", name: "Dono", profile: "owner" as const };

describe("clientsService.listOptions", () => {
  beforeEach(() => {
    resetAcademy();
    setCurrentActor(OWNER);
  });
  afterEach(() => setCurrentActor(OWNER));

  it("leva só nome, telefone, nascimento, plano e bolsa, em ordem de nome", async () => {
    const bia = await createStudent("Bia");
    const ana = await createStudent("Ana");
    const full = store.clients.find((c) => c.id === ana.id)!;
    Object.assign(full, {
      phone: "+5511999990000",
      birthDate: "2010-05-02",
      cpf: "52998224725",
      address: { street: "Rua A", number: "1", city: "São Paulo", state: "SP", zipCode: "01000000" },
      notes: "anotação interna",
      planId: "plan-1",
      discount: { type: "percent", value: 100, scholarship: true },
      progressions: { m: { levelId: "l1", subLevel: 0, evaluations: [] } },
    });

    const options = await clientsService.listOptions({ status: "active" });

    expect(options.map((o) => o.name)).toEqual(["Ana", "Bia"]);
    expect(options[0]).toEqual({
      id: ana.id,
      name: "Ana",
      status: "active",
      phone: "+5511999990000",
      birthDate: "2010-05-02",
      planId: "plan-1",
      scholarship: true,
    });
    const allowed = new Set(["id", "name", "status", "phone", "birthDate", "planId", "scholarship"]);
    for (const option of options) expect(Object.keys(option).filter((k) => !allowed.has(k))).toEqual([]);
    expect(options[1].id).toBe(bia.id);
  });

  it("filtra pela situação e pela busca de nome ou telefone", async () => {
    await createStudent("Ana Souza");
    const caio = await createStudent("Caio");
    store.clients.find((c) => c.id === caio.id)!.status = "inactive";

    expect((await clientsService.listOptions({ status: "active" })).map((o) => o.name)).toEqual(["Ana Souza"]);
    expect((await clientsService.listOptions({ search: "souza" })).map((o) => o.name)).toEqual(["Ana Souza"]);
  });

  it("professor: só os alunos das turmas dele, sem plano nem bolsa", async () => {
    const carlos = await createInstructor("Carlos");
    const g = await createClass({ name: "Jiu-Jitsu", instructorId: carlos.id, slots: [{ weekday: 1, start: "19:00", end: "20:00" }] });
    const mine = await createStudent("Aluno do Carlos");
    await createStudent("Aluno de outro");
    await turmasService.enroll({ classGroupId: g.id, studentId: mine.id });
    Object.assign(store.clients.find((c) => c.id === mine.id)!, {
      planId: "plan-1",
      discount: { type: "percent", value: 50, scholarship: true },
    });
    store.users.push({
      id: "usr-prof-carlos",
      organizationId: store.organization.id,
      name: "Carlos",
      email: "carlos@teste.local",
      profile: "professional",
      professionalId: carlos.id,
      status: "active",
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    });
    setCurrentActor({ userId: "usr-prof-carlos", name: "Carlos", profile: "professional" });

    const options = await clientsService.listOptions({ status: "active" });

    expect(options.map((o) => o.name)).toEqual(["Aluno do Carlos"]);
    expect(options[0].planId).toBeUndefined();
    expect(options[0].scholarship).toBeUndefined();
  });
});
