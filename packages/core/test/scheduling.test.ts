import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ClassGroup, ClassMeetingSlot } from "@gestarahub/contracts";
import {
  findInstructorConflicts,
  instructorConflictMessage,
  rangesOverlap,
} from "../src/scheduling.ts";

type GroupLike = Pick<ClassGroup, "id" | "name" | "status" | "instructorId" | "meetingSlots">;

const slot = (weekday: ClassMeetingSlot["weekday"], start: string, end: string): ClassMeetingSlot => ({
  weekday,
  start,
  end,
});

const group = (over: Partial<GroupLike> = {}): GroupLike => ({
  id: "grp-1",
  name: "Jiu-jitsu Kids",
  status: "active",
  instructorId: "prof-a",
  meetingSlots: [slot(1, "14:00", "15:00")],
  ...over,
});

describe("rangesOverlap (intervalo meio-aberto)", () => {
  it("sobreposicao parcial e contencao", () => {
    assert.equal(rangesOverlap("14:00", "15:00", "14:30", "15:30"), true);
    assert.equal(rangesOverlap("14:00", "16:00", "14:30", "15:00"), true);
    assert.equal(rangesOverlap("14:30", "15:00", "14:00", "16:00"), true);
    assert.equal(rangesOverlap("14:00", "15:00", "14:00", "15:00"), true);
  });

  it("bordas encostadas nao conflitam, nos dois sentidos", () => {
    assert.equal(rangesOverlap("14:00", "15:00", "15:00", "16:00"), false);
    assert.equal(rangesOverlap("15:00", "16:00", "14:00", "15:00"), false);
  });

  it("intervalos disjuntos", () => {
    assert.equal(rangesOverlap("08:00", "09:00", "10:00", "11:00"), false);
  });
});

describe("findInstructorConflicts", () => {
  it("mesmo instrutor + mesmo dia + sobreposicao = conflito", () => {
    const g = group();
    const s = slot(1, "14:30", "15:30");
    const result = findInstructorConflicts([s], "prof-a", [g]);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
      slot: s,
      group: { id: "grp-1", name: "Jiu-jitsu Kids" },
      groupSlot: g.meetingSlots[0],
    });
  });

  it("outro instrutor nao conflita", () => {
    assert.deepEqual(findInstructorConflicts([slot(1, "14:00", "15:00")], "prof-b", [group()]), []);
  });

  it("outro dia da semana nao conflita", () => {
    assert.deepEqual(findInstructorConflicts([slot(2, "14:00", "15:00")], "prof-a", [group()]), []);
  });

  it("bordas encostadas 14:00-15:00 x 15:00-16:00 nao conflitam", () => {
    assert.deepEqual(findInstructorConflicts([slot(1, "15:00", "16:00")], "prof-a", [group()]), []);
    const later = group({ meetingSlots: [slot(1, "15:00", "16:00")] });
    assert.deepEqual(findInstructorConflicts([slot(1, "14:00", "15:00")], "prof-a", [later]), []);
  });

  it("turma inativa nao conflita", () => {
    const g = group({ status: "inactive" });
    assert.deepEqual(findInstructorConflicts([slot(1, "14:00", "15:00")], "prof-a", [g]), []);
  });

  it("excludeGroupId ignora a propria turma", () => {
    assert.deepEqual(
      findInstructorConflicts([slot(1, "14:00", "15:00")], "prof-a", [group()], "grp-1"),
      [],
    );
  });

  it("sem instrutor retorna vazio", () => {
    assert.deepEqual(findInstructorConflicts([slot(1, "14:00", "15:00")], "", [group({ instructorId: "" })]), []);
  });

  it("um conflito por encontro, so nos encontros que conflitam", () => {
    const slots = [slot(1, "14:00", "15:00"), slot(3, "14:00", "15:00"), slot(5, "09:00", "10:00")];
    const groups = [
      group(),
      group({ id: "grp-2", name: "Muay Thai", meetingSlots: [slot(1, "14:00", "15:00"), slot(3, "14:30", "15:30")] }),
    ];
    const result = findInstructorConflicts(slots, "prof-a", groups);
    assert.equal(result.length, 2);
    assert.equal(result[0].slot, slots[0]);
    assert.equal(result[0].group.id, "grp-1");
    assert.equal(result[1].slot, slots[1]);
    assert.equal(result[1].group.id, "grp-2");
    assert.deepEqual(result[1].groupSlot, slot(3, "14:30", "15:30"));
  });
});

describe("instructorConflictMessage", () => {
  it("menciona dia, horarios da turma existente e o nome da turma", () => {
    const g = group({ meetingSlots: [slot(2, "18:00", "19:00")] });
    const [conflict] = findInstructorConflicts([slot(2, "18:30", "19:30")], "prof-a", [g]);
    const msg = instructorConflictMessage("Carla", conflict);
    assert.equal(
      msg,
      'Carla já dá aula Terça das 18:00 às 19:00 na turma "Jiu-jitsu Kids". Escolha outro horário ou outro professor.',
    );
  });
});
