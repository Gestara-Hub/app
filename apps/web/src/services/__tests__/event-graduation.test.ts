import type { EventView } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { PROGRESSION_TEMPLATES } from "@/lib/progression-tracks";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { turmasService } from "@/services/classes";
import { clientsService } from "@/services/clients";
import { eventsService } from "@/services/events";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * Evento de graduacao (doc product/30 §4, 13/11/2026): a opcao no evento, a
 * graduacao ligada ao evento, os aptos da modalidade e os certificados de
 * quem graduou. Hoje nos testes: 22/09/2026.
 */

const WHITE = PROGRESSION_TEMPLATES.bjj_adult.track.levels[0];
let bjj: string;

async function exam(overrides: Partial<Parameters<typeof eventsService.create>[0]> = {}): Promise<EventView> {
  return eventsService.create({
    name: "Exame de faixa",
    modalityId: bjj,
    instructors: [{ id: "i-mestre", guestName: "Mestre Rui" }],
    billingMode: "free",
    graduation: true,
    federationFeeCents: 6000,
    sessions: [{ date: "2026-09-22", start: "09:00", end: "12:00" }],
    ...overrides,
  });
}

beforeEach(async () => {
  resetAcademy();
  bjj = (await categoriesService.create({ name: "Jiu-Jitsu", progressionTrack: structuredClone(PROGRESSION_TEMPLATES.bjj_adult.track) })).id;
});

describe("evento de graduacao: cadastro", () => {
  it("pede modalidade com trilha; o repasse so fica no evento de graduacao", async () => {
    const yoga = await categoriesService.create({ name: "Yoga" });
    await expect(exam({ modalityId: yoga.id })).rejects.toMatchObject({
      fields: [{ field: "graduation", message: "Escolha uma modalidade com trilha de níveis." }],
    });
    await expect(exam({ modalityId: undefined })).rejects.toMatchObject({ fields: [{ field: "graduation" }] });

    const event = await exam();
    expect(event).toMatchObject({ graduation: true, federationFeeCents: 6000 });
    const plain = await eventsService.update(event.id, { graduation: false });
    expect(plain.graduation).toBe(false);
    expect(plain.federationFeeCents).toBeUndefined();
  });
});

describe("evento de graduacao: graduar", () => {
  it("cada registro fica ligado ao evento; so de quem esta inscrito", async () => {
    const event = await exam();
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    await eventsService.register({ eventId: event.id, studentId: ana.id });

    await expect(
      clientsService.promoteStudents({
        modalityId: bjj,
        eventId: event.id,
        date: "2026-09-22",
        items: [
          { studentId: ana.id, toLevelId: WHITE.id, toSubLevel: 1 },
          { studentId: bia.id, toLevelId: WHITE.id, toSubLevel: 1 },
        ],
      }),
    ).rejects.toMatchObject({ fields: [{ field: "items", message: "Bia não está inscrito no evento." }] });

    await clientsService.promoteStudents({
      modalityId: bjj,
      eventId: event.id,
      date: "2026-09-22",
      examiner: "Mestre Rui",
      items: [{ studentId: ana.id, toLevelId: WHITE.id, toSubLevel: 1 }],
    });
    const entry = (await clientsService.getById(ana.id)).progressions?.[bjj]?.promotionHistory[0];
    expect(entry).toMatchObject({ eventId: event.id, examiner: "Mestre Rui", toSubLevel: 1 });
  });

  it("evento que nao e de graduacao, ou de outra modalidade, nao liga", async () => {
    const event = await exam({ graduation: false, federationFeeCents: undefined });
    const ana = await createStudent("Ana");
    await eventsService.register({ eventId: event.id, studentId: ana.id });
    await expect(
      clientsService.promoteStudents({
        modalityId: bjj,
        eventId: event.id,
        date: "2026-09-22",
        items: [{ studentId: ana.id, toLevelId: WHITE.id, toSubLevel: 1 }],
      }),
    ).rejects.toMatchObject({ fields: [{ field: "eventId", message: "Este evento não é de graduação nesta modalidade." }] });
  });
});

describe("aptos da modalidade", () => {
  it("sem lista, traz os alunos ativos nas turmas da modalidade", async () => {
    const instructor = await createInstructor("Prof", bjj);
    const group = await turmasService.create({
      name: "Jiu-Jitsu Noite",
      modalityId: bjj,
      instructorId: instructor.id,
      capacity: 10,
      meetingSlots: [{ weekday: 2, start: "19:00", end: "20:00" }],
      startDate: "2026-09-01",
      status: "active",
    });
    const ana = await createStudent("Ana");
    await createStudent("Fora da turma");
    await turmasService.enroll({ classGroupId: group.id, studentId: ana.id });

    const { candidates } = await clientsService.listPromotionCandidates(bjj);
    expect(candidates.map((c) => c.studentName)).toEqual(["Ana"]);
  });
});

describe("certificados de quem graduou no evento", () => {
  it("emite um por graduacao do evento, em ordem de nome (Pro)", async () => {
    store.organization.subscription = { tier: "pro" };
    const event = await exam();
    const students = [await createStudent("Bia"), await createStudent("Ana")];
    for (const s of students) await eventsService.register({ eventId: event.id, studentId: s.id });
    await clientsService.promoteStudents({
      modalityId: bjj,
      eventId: event.id,
      date: "2026-09-22",
      items: students.map((s) => ({ studentId: s.id, toLevelId: WHITE.id, toSubLevel: 1 })),
    });

    const batch = await clientsService.issueEventGraduationCertificates(event.id);
    expect(batch.eventName).toBe("Exame de faixa");
    expect(batch.items.map((i) => i.certificate.studentName)).toEqual(["Ana", "Bia"]);
    expect(batch.items.every((i) => i.issued.status === "valid")).toBe(true);
    // De novo: os mesmos codigos (nao emite outro).
    const again = await clientsService.issueEventGraduationCertificates(event.id);
    expect(again.items.map((i) => i.issued.code)).toEqual(batch.items.map((i) => i.issued.code));
  });
});
