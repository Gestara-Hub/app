import { describe, expect, it } from "vitest";
import type { ClassGroupView } from "@gestarahub/contracts";
import { getSegmentPreset } from "@/lib/business-segment-presets";
import {
  buildClassesOnboardingSteps,
  buildSchedulingOnboardingSteps,
  summarizeOnboardingSteps,
  type ClassesOnboardingInput,
} from "../onboarding-steps";

type Group = ClassesOnboardingInput["classGroups"][number];

function group(id: string, extra: Partial<Pick<ClassGroupView, "status" | "billingMode" | "enrolledCount">> = {}): Group {
  return { id, status: "active", enrolledCount: 0, ...extra };
}

function input(extra: Partial<ClassesOnboardingInput> = {}): ClassesOnboardingInput {
  return {
    hoursSet: false,
    billingSet: false,
    modalitiesCount: 0,
    modalitiesNeedReview: false,
    plansCount: 0,
    professionalsCount: 0,
    clientsCount: 0,
    classGroups: [],
    isCourseArea: false,
    ...extra,
  };
}

const ids = (i: ClassesOnboardingInput) => buildClassesOnboardingSteps(i).map((s) => s.id);
const stepOf = (i: ClassesOnboardingInput, id: string) =>
  buildClassesOnboardingSteps(i).find((s) => s.id === id);

/** Tudo pronto ate a primeira turma/curso, faltando so o fim. */
const READY_UNTIL_CLASSES = {
  hoursSet: true,
  billingSet: true,
  modalitiesCount: 2,
  plansCount: 1,
  professionalsCount: 1,
  clientsCount: 3,
};

describe("área de curso (defaultBillingMode course)", () => {
  it("gastronomia, artes e cursos de beleza são áreas de curso; custom segue mensalidade", () => {
    expect(getSegmentPreset("gastronomy").defaultBillingMode).toBe("course");
    expect(getSegmentPreset("arts_crafts").defaultBillingMode).toBe("course");
    expect(getSegmentPreset("beauty_courses").defaultBillingMode).toBe("course");
    expect(getSegmentPreset("custom").defaultBillingMode).toBe("membership");
  });

  it("esconde regras e planos da mensalidade e mostra os passos do curso", () => {
    const steps = buildClassesOnboardingSteps(input({ isCourseArea: true }));
    expect(steps.map((s) => s.id)).toEqual(["hours", "modalities", "team", "clients", "classes", "enroll"]);
    expect(steps.find((s) => s.id === "classes")?.label).toBe("Criar o primeiro curso");
    expect(steps.find((s) => s.id === "enroll")?.label).toBe("Matricular alunos no curso");
    expect(steps.find((s) => s.id === "enroll")?.requires).toEqual(["classes"]);
  });

  it("turma ativa cobrando mensalidade traz os dois passos de volta", () => {
    expect(ids(input({ isCourseArea: true, classGroups: [group("t1", { billingMode: "membership" })] }))).toEqual([
      "hours", "billing", "modalities", "plans", "team", "clients", "classes", "enroll",
    ]);
    // Turma antiga sem billingMode cobra mensalidade.
    expect(ids(input({ isCourseArea: true, classGroups: [group("t1")] }))).toContain("plans");
  });

  it("turma de mensalidade inativa, curso ou sem cobrança não trazem os passos", () => {
    const groups = [
      group("t1", { billingMode: "membership", status: "inactive" }),
      group("c1", { billingMode: "course" }),
      group("f1", { billingMode: "free" }),
    ];
    const steps = ids(input({ isCourseArea: true, classGroups: groups }));
    expect(steps).not.toContain("billing");
    expect(steps).not.toContain("plans");
  });

  it("matricular só conclui com aluno ativo em um curso", () => {
    const base = input({ ...READY_UNTIL_CLASSES, isCourseArea: true });
    expect(stepOf({ ...base, classGroups: [group("c1", { billingMode: "course" })] }, "enroll")?.done).toBe(false);
    // Matricula em turma de mensalidade nao conta.
    expect(
      stepOf({ ...base, classGroups: [group("c1", { billingMode: "course" }), group("t1", { enrolledCount: 4 })] }, "enroll")?.done,
    ).toBe(false);
    expect(
      stepOf({ ...base, classGroups: [group("c1", { billingMode: "course", enrolledCount: 1 })] }, "enroll")?.done,
    ).toBe(true);
  });

  it("matricular leva ao curso ativo com a matrícula aberta", () => {
    const base = input({ isCourseArea: true });
    expect(stepOf(base, "enroll")?.href).toBe("/classes");
    const groups = [
      group("old", { billingMode: "course", status: "inactive" }),
      group("c2", { billingMode: "course" }),
    ];
    expect(stepOf({ ...base, classGroups: groups }, "enroll")?.href).toBe("/classes/c2?enroll=true");
  });

  it("progresso: criar o curso deixa a matrícula como próximo passo; matricular conclui", () => {
    const base = input({ ...READY_UNTIL_CLASSES, isCourseArea: true });

    const beforeCourse = summarizeOnboardingSteps(buildClassesOnboardingSteps(base));
    expect(beforeCourse.total).toBe(6);
    expect(beforeCourse.doneCount).toBe(4);
    expect(beforeCourse.nextStep?.id).toBe("classes");

    const withCourse = summarizeOnboardingSteps(
      buildClassesOnboardingSteps({ ...base, classGroups: [group("c1", { billingMode: "course" })] }),
    );
    expect(withCourse.doneCount).toBe(5);
    expect(withCourse.nextStep?.id).toBe("enroll");
    expect(withCourse.isComplete).toBe(false);

    const enrolled = summarizeOnboardingSteps(
      buildClassesOnboardingSteps({ ...base, classGroups: [group("c1", { billingMode: "course", enrolledCount: 2 })] }),
    );
    expect(enrolled.isComplete).toBe(true);
    expect(enrolled.nextStep).toBeNull();
  });
});

describe("área de mensalidade (sem mudança)", () => {
  it("mantém os 7 passos, com a turma no fim e sem matrícula", () => {
    const steps = buildClassesOnboardingSteps(input());
    expect(steps.map((s) => s.id)).toEqual(["hours", "billing", "modalities", "plans", "team", "clients", "classes"]);
    expect(steps.find((s) => s.id === "billing")?.label).toBe("Definir regras da mensalidade");
    expect(steps.find((s) => s.id === "billing")?.href).toBe("/settings?tab=geral#billing-rules");
    expect(steps.find((s) => s.id === "classes")?.label).toBe("Criar a primeira turma");
  });

  it("curso numa área de mensalidade não muda os passos", () => {
    expect(ids(input({ classGroups: [group("c1", { billingMode: "course", enrolledCount: 1 })] }))).not.toContain("enroll");
  });

  it("conclusão segue o dado real", () => {
    const empty = summarizeOnboardingSteps(buildClassesOnboardingSteps(input()));
    expect(empty.doneCount).toBe(0);
    expect(empty.nextStep?.id).toBe("hours");

    const done = summarizeOnboardingSteps(
      buildClassesOnboardingSteps(input({ ...READY_UNTIL_CLASSES, classGroups: [group("t1")] })),
    );
    expect(done.isComplete).toBe(true);
    expect(done.doneCount).toBe(7);
  });

  it("modalidades a revisar liberam os planos sem contar como concluídas", () => {
    const steps = buildClassesOnboardingSteps(
      input({ hoursSet: true, billingSet: true, modalitiesCount: 2, modalitiesNeedReview: true }),
    );
    const modalities = steps.find((s) => s.id === "modalities");
    expect(modalities).toMatchObject({ done: false, needsReview: true, cta: "Revisar" });
    expect(summarizeOnboardingSteps(steps).nextStep?.id).toBe("modalities");
  });

  it("revisar sem modalidade cadastrada não vale", () => {
    expect(stepOf(input({ modalitiesNeedReview: true }), "modalities")?.needsReview).toBe(false);
  });

  it("passo bloqueado não é o próximo", () => {
    // Horario feito, modalidades nao: planos (requer modalidades) fica bloqueado.
    const steps = buildClassesOnboardingSteps(input({ hoursSet: true, billingSet: true }));
    expect(summarizeOnboardingSteps(steps).nextStep?.id).toBe("modalities");
  });
});

describe("atendimento individual", () => {
  it("cinco passos com o agendamento no fim", () => {
    const steps = buildSchedulingOnboardingSteps({
      hoursSet: true,
      servicesCount: 1,
      professionalsCount: 1,
      clientsCount: 0,
      appointmentsCount: 0,
    });
    expect(steps.map((s) => s.id)).toEqual(["hours", "services", "team", "clients", "appointment"]);
    const summary = summarizeOnboardingSteps(steps);
    expect(summary.doneCount).toBe(3);
    expect(summary.nextStep?.id).toBe("clients");
  });
});
