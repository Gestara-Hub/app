import { beforeEach, describe, expect, it } from "vitest";
import type { FileAttachment, UserProfile } from "@gestarahub/contracts";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { personDocumentsService } from "@/services/personDocuments";
import { turmasService } from "@/services/classes";
import { categoriesService } from "@/services/catalog/categoriesService";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * Documentos da ficha (doc product/28, 04/11/2026): atestado, termo, CREF.
 * Hoje nos testes: 22/09/2026.
 */

const file = (id: string): FileAttachment => ({
  id,
  name: `${id}.pdf`,
  contentType: "application/pdf",
  sizeBytes: 1200,
  uploadedAt: "2026-09-20T12:00:00.000Z",
});

function actAs(profile: UserProfile, professionalId?: string) {
  const id = `usr-${profile}-${professionalId ?? "x"}`;
  if (!store.users.some((u) => u.id === id)) {
    store.users.push({
      id,
      organizationId: store.organization.id,
      name: `Usuário ${profile}`,
      email: `${id}@teste.com`,
      profile,
      professionalId,
      status: "active",
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    });
  }
  setCurrentActor({ userId: id, name: `Usuário ${profile}`, profile });
}

async function setup() {
  const modality = await categoriesService.create({ name: "Natação" });
  const instructor = await createInstructor("Prof Natação", modality.id);
  const group = await turmasService.create({
    name: "Natação Manhã",
    modalityId: modality.id,
    instructorId: instructor.id,
    capacity: 10,
    meetingSlots: [{ weekday: 2, start: "07:00", end: "08:00" }],
    startDate: "2026-09-01",
    status: "active",
  });
  const ana = await createStudent("Ana");
  const outsider = await createStudent("Bruno");
  await turmasService.enroll({ classGroupId: group.id, studentId: ana.id });
  return { instructor, ana, outsider };
}

beforeEach(() => resetAcademy());

describe("documentos do aluno", () => {
  it("anexa, lista com a validade e entra na auditoria", async () => {
    const { ana } = await setup();
    actAs("attendant");
    await personDocumentsService.create({ ownerKind: "client", ownerId: ana.id, kind: "liability_waiver", file: file("termo") });
    await personDocumentsService.create({
      ownerKind: "client",
      ownerId: ana.id,
      kind: "medical_certificate",
      file: file("atestado"),
      expiresOn: "2026-10-10",
      notes: " Liberada para natação. ",
    });
    const docs = await personDocumentsService.list("client", ana.id);
    expect(docs.map((d) => d.label)).toEqual(["Atestado médico", "Termo de responsabilidade"]);
    expect(docs[0]).toMatchObject({ expiry: "expiring", daysToExpire: 18, notes: "Liberada para natação." });
    expect(docs[1]).toMatchObject({ expiry: "none" });
    expect(store.auditLog.some((e) => e.summary.includes("anexou Atestado médico na ficha de Ana"))).toBe(true);
  });

  it("tipo de outro dono, ou Outro sem nome, não salva", async () => {
    const { ana } = await setup();
    await expect(
      personDocumentsService.create({ ownerKind: "client", ownerId: ana.id, kind: "professional_registration", file: file("x") }),
    ).rejects.toMatchObject({ fields: [{ field: "kind" }] });
    await expect(
      personDocumentsService.create({ ownerKind: "client", ownerId: ana.id, kind: "other", title: "  ", file: file("y") }),
    ).rejects.toMatchObject({ fields: [{ field: "title", message: "Dê um nome ao documento." }] });
  });

  it("o professor vê só os documentos dos alunos das turmas dele e não mexe", async () => {
    const { instructor, ana, outsider } = await setup();
    await personDocumentsService.create({ ownerKind: "client", ownerId: ana.id, kind: "medical_certificate", file: file("a") });
    await personDocumentsService.create({ ownerKind: "client", ownerId: outsider.id, kind: "medical_certificate", file: file("b") });
    actAs("professional", instructor.id);
    expect(await personDocumentsService.list("client", ana.id)).toHaveLength(1);
    await expect(personDocumentsService.list("client", outsider.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      personDocumentsService.create({ ownerKind: "client", ownerId: ana.id, kind: "contract", file: file("c") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("excluir tira da ficha", async () => {
    const { ana } = await setup();
    const doc = await personDocumentsService.create({ ownerKind: "client", ownerId: ana.id, kind: "contract", file: file("c") });
    await personDocumentsService.remove(doc.id);
    expect(await personDocumentsService.list("client", ana.id)).toHaveLength(0);
    expect(store.auditLog.some((e) => e.summary.includes("tirou Contrato da ficha de Ana"))).toBe(true);
  });
});

describe("documentos do instrutor", () => {
  it("só proprietário e gerente veem e mexem", async () => {
    const { instructor } = await setup();
    actAs("manager");
    await personDocumentsService.create({
      ownerKind: "professional",
      ownerId: instructor.id,
      kind: "professional_registration",
      file: file("cref"),
      expiresOn: "2027-03-01",
    });
    expect(await personDocumentsService.list("professional", instructor.id)).toMatchObject([{ expiry: "valid" }]);
    actAs("attendant");
    await expect(personDocumentsService.list("professional", instructor.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      personDocumentsService.create({ ownerKind: "professional", ownerId: instructor.id, kind: "contract", file: file("k") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("vencimentos (sino)", () => {
  it("lista vencidos e vencendo; o atestado renovado tira o aviso do antigo", async () => {
    const { ana, outsider, instructor } = await setup();
    await personDocumentsService.create({ ownerKind: "client", ownerId: ana.id, kind: "medical_certificate", file: file("old"), expiresOn: "2026-09-01" });
    await personDocumentsService.create({ ownerKind: "client", ownerId: outsider.id, kind: "medical_certificate", file: file("b"), expiresOn: "2026-10-01" });
    await personDocumentsService.create({ ownerKind: "professional", ownerId: instructor.id, kind: "professional_registration", file: file("cref"), expiresOn: "2026-09-20" });
    let expiring = await personDocumentsService.listExpiring();
    expect(expiring.map((d) => [d.ownerName, d.expiry, d.daysToExpire])).toEqual([
      ["Ana", "expired", -21],
      ["Prof Natação", "expired", -2],
      ["Bruno", "expiring", 9],
    ]);

    await personDocumentsService.create({ ownerKind: "client", ownerId: ana.id, kind: "medical_certificate", file: file("new"), expiresOn: "2027-09-01" });
    expiring = await personDocumentsService.listExpiring();
    expect(expiring.some((d) => d.ownerName === "Ana")).toBe(false);

    // Atendente: alunos sim, equipe nao. Professor: so os alunos dele.
    actAs("attendant");
    expect((await personDocumentsService.listExpiring()).map((d) => d.ownerName)).toEqual(["Bruno"]);
    actAs("professional", instructor.id);
    expect(await personDocumentsService.listExpiring()).toEqual([]);
  });
});
