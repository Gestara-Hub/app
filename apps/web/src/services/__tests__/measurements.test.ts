import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { measurementsService } from "@/services/measurements";
import { turmasService } from "@/services/classes";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * Testes e medidas (doc 21 §2.4, fase B de 31/10/2026): a modalidade define as
 * medidas, a avaliacao e por aluno, a ficha mostra a evolucao. Hoje: 22/09/2026.
 */

const MEASURES = [
  { id: "", name: "Peso", unit: "kg", better: "lower" as const },
  { id: "", name: "Prancha", unit: "s", better: "higher" as const },
];

async function setup() {
  const modality = await categoriesService.create({ name: "Funcional", measurements: { enabled: true, measures: MEASURES } });
  const instructor = await createInstructor("Prof Funcional", modality.id);
  const group = await turmasService.create({
    name: "Funcional Manhã",
    modalityId: modality.id,
    instructorId: instructor.id,
    capacity: 10,
    meetingSlots: [{ weekday: 2, start: "07:00", end: "08:00" }],
    startDate: "2026-09-01",
    status: "active",
  });
  const ana = await createStudent("Ana");
  await turmasService.enroll({ classGroupId: group.id, studentId: ana.id });
  const [peso, prancha] = modality.measurements!.measures;
  return { modality, instructor, ana, peso, prancha };
}

beforeEach(() => resetAcademy());

describe("modalidade: testes e medidas", () => {
  it("guarda as medidas limpas, com id para as novas", async () => {
    const { modality } = await setup();
    expect(modality.measurements?.enabled).toBe(true);
    expect(modality.measurements?.measures.map((m) => [m.name, m.unit, m.better])).toEqual([
      ["Peso", "kg", "lower"],
      ["Prancha", "s", "higher"],
    ]);
    expect(modality.measurements?.measures.every((m) => m.id.length > 0)).toBe(true);
  });

  it("ligada sem medida, ou com nome repetido, não salva", async () => {
    await expect(
      categoriesService.create({ name: "Pilates", measurements: { enabled: true, measures: [] } }),
    ).rejects.toMatchObject({ fields: [{ field: "measurements", message: "Adicione pelo menos uma medida." }] });
    await expect(
      categoriesService.create({
        name: "Natação",
        measurements: { enabled: true, measures: [MEASURES[0], { ...MEASURES[1], name: "peso" }] },
      }),
    ).rejects.toMatchObject({ fields: [{ field: "measurements" }] });
  });
});

describe("avaliação do aluno", () => {
  it("registra, mostra a evolução pela direção de cada medida e entra na auditoria", async () => {
    const { modality, ana, peso, prancha } = await setup();
    await measurementsService.create({ studentId: ana.id, modalityId: modality.id, date: "2026-09-01", values: { [peso.id]: 80, [prancha.id]: 30 } });
    await measurementsService.create({
      studentId: ana.id,
      modalityId: modality.id,
      date: "2026-09-22",
      values: { [peso.id]: "78,5" as unknown as number, [prancha.id]: 45 },
      notes: " Sem dor no joelho. ",
    });
    const view = await measurementsService.getStudentMeasurements(ana.id);
    expect(view.modalities).toHaveLength(1);
    const [weight, plank] = view.modalities[0].progress;
    expect(weight).toMatchObject({ latest: { value: 78.5 }, previous: { value: 80 }, change: -1.5, improved: true });
    expect(plank).toMatchObject({ change: 15, improved: true });
    expect(view.modalities[0].history[0].notes).toBe("Sem dor no joelho.");
    expect(store.auditLog.some((e) => e.summary.includes("registrou testes e medidas de Ana · Funcional"))).toBe(true);
  });

  it("valida data, valores e medidas de fora", async () => {
    const { modality, ana, peso } = await setup();
    await expect(
      measurementsService.create({ studentId: ana.id, modalityId: modality.id, date: "2026-12-01", values: { [peso.id]: 80 } }),
    ).rejects.toMatchObject({ fields: [{ field: "date", message: "A data não pode ser futura." }] });
    await expect(
      measurementsService.create({ studentId: ana.id, modalityId: modality.id, date: "2026-09-01", values: {} }),
    ).rejects.toMatchObject({ fields: [{ field: "values", message: "Preencha pelo menos uma medida." }] });
    await expect(
      measurementsService.create({ studentId: ana.id, modalityId: modality.id, date: "2026-09-01", values: { outra: 1 } }),
    ).rejects.toMatchObject({ fields: [{ field: "values.outra" }] });
  });

  it("editar e excluir", async () => {
    const { modality, ana, peso } = await setup();
    const m = await measurementsService.create({ studentId: ana.id, modalityId: modality.id, date: "2026-09-01", values: { [peso.id]: 80 } });
    await measurementsService.update(m.id, { values: { [peso.id]: 79 }, notes: "" });
    expect(store.studentMeasurements?.[0].values).toEqual({ [peso.id]: 79 });
    await measurementsService.remove(m.id);
    expect(store.studentMeasurements).toHaveLength(0);
  });

  it("professor: só nos alunos das turmas dele; atendente não registra", async () => {
    const { modality, instructor, ana, peso } = await setup();
    const outsider = await createStudent("Bia");
    store.users.push({
      id: "usr-prof",
      organizationId: store.organization.id,
      name: "Prof",
      email: "prof@teste.local",
      profile: "professional",
      professionalId: instructor.id,
      status: "active",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    setCurrentActor({ userId: "usr-prof", name: "Prof", profile: "professional" });
    await measurementsService.create({ studentId: ana.id, modalityId: modality.id, date: "2026-09-01", values: { [peso.id]: 80 } });
    await expect(
      measurementsService.create({ studentId: outsider.id, modalityId: modality.id, date: "2026-09-01", values: { [peso.id]: 70 } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(measurementsService.getStudentMeasurements(outsider.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    setCurrentActor({ userId: "usr-att", name: "Atendente", profile: "attendant" });
    await expect(
      measurementsService.create({ studentId: ana.id, modalityId: modality.id, date: "2026-09-01", values: { [peso.id]: 80 } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
