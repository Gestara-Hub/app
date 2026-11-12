import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { clientsService, clientsServiceImpl } from "@/services/clients";
import { turmasService } from "@/services/classes";
import { sliceFor } from "@/services/world/registry";
import { checkSlice } from "@/services/world/sliceCheck";
import { createClass, createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * Selo "Visitante" em Alunos (doc product/29, decisao 2; 11/11/2026): so
 * inscricao em evento, sem matricula, plano, pacote nem aula experimental.
 */

function registration(id: string, studentId: string, status: "confirmed" | "waitlist" | "canceled" = "confirmed") {
  return { id, eventId: "ev-1", studentId, scope: "full" as const, status, amountCents: 0, installments: 1, registeredAt: "2026-09-10T12:00:00.000Z" };
}

let ids: Record<string, string>;

beforeEach(async () => {
  resetAcademy();
  const visitante = await createStudent("Vera Visitante");
  const aluno = await createStudent("Alan Aluno");
  const desistiu = await createStudent("Davi Desistiu");
  const espera = await createStudent("Eva Espera");
  const group = await createClass({ name: "Noite", instructorId: (await createInstructor("Carlos")).id, slots: [{ weekday: 2, start: "19:00", end: "20:00" }] });
  await turmasService.enroll({ classGroupId: group.id, studentId: aluno.id });
  store.eventRegistrations = [
    registration("r1", visitante.id),
    registration("r2", aluno.id),
    registration("r3", desistiu.id, "canceled"),
    registration("r4", espera.id, "waitlist"),
  ];
  ids = { visitante: visitante.id, aluno: aluno.id, desistiu: desistiu.id, espera: espera.id };
});

describe("visitantes", () => {
  it("so quem veio por evento e nao tem outro vinculo", async () => {
    const visitors = await clientsService.listVisitorIds();
    expect(new Set(visitors)).toEqual(new Set([ids.visitante, ids.espera]));
  });

  it("filtro da lista de Alunos", async () => {
    const page = await clientsService.listPaginated({ visitor: true });
    expect(page.items.map((c) => c.name).sort()).toEqual(["Eva Espera", "Vera Visitante"]);
  });

  it("recortes conferidos contra o espaco inteiro", async () => {
    for (const [name, args, call] of [
      ["clients.listVisitorIds", [], () => clientsServiceImpl.listVisitorIds()],
      ["clients.listPaginated", [{ visitor: true }], () => clientsServiceImpl.listPaginated({ visitor: true })],
    ] as const) {
      const slice = await sliceFor(name);
      if (!slice) throw new Error(`${name} sem recorte`);
      await checkSlice(name, slice, args as unknown as unknown[], call as () => Promise<unknown>);
    }
  });
});
