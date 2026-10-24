import { describe, expect, it } from "vitest";
import { INSTRUCTOR_WORDS, TEACHER_WORDS } from "@/lib/team-words";
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
    lessonPackagesCount: 0,
    professionalsCount: 0,
    teamWords: INSTRUCTOR_WORDS,
    clientsCount: 0,
    classGroups: [],
    areaBillingMode: "membership",
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
    const steps = buildClassesOnboardingSteps(input({ areaBillingMode: "course" }));
    expect(steps.map((s) => s.id)).toEqual(["hours", "modalities", "team", "clients", "classes", "enroll"]);
    expect(steps.find((s) => s.id === "classes")?.label).toBe("Criar o primeiro curso");
    expect(steps.find((s) => s.id === "enroll")?.label).toBe("Matricular alunos no curso");
    expect(steps.find((s) => s.id === "enroll")?.requires).toEqual(["classes"]);
  });

  it("turma ativa cobrando mensalidade traz os dois passos de volta", () => {
    expect(ids(input({ areaBillingMode: "course", classGroups: [group("t1", { billingMode: "membership" })] }))).toEqual([
      "hours", "billing", "modalities", "plans", "team", "clients", "classes", "enroll",
    ]);
    // Turma antiga sem billingMode cobra mensalidade.
    expect(ids(input({ areaBillingMode: "course", classGroups: [group("t1")] }))).toContain("plans");
  });

  it("turma de mensalidade inativa, curso ou sem cobrança não trazem os passos", () => {
    const groups = [
      group("t1", { billingMode: "membership", status: "inactive" }),
      group("c1", { billingMode: "course" }),
      group("f1", { billingMode: "free" }),
    ];
    const steps = ids(input({ areaBillingMode: "course", classGroups: groups }));
    expect(steps).not.toContain("billing");
    expect(steps).not.toContain("plans");
  });

  it("matricular conclui com aluno matriculado em qualquer turma", () => {
    const base = input({ ...READY_UNTIL_CLASSES, areaBillingMode: "course" });
    expect(stepOf({ ...base, classGroups: [group("c1", { billingMode: "course" })] }, "enroll")?.done).toBe(false);
    expect(
      stepOf({ ...base, classGroups: [group("c1", { billingMode: "course", enrolledCount: 1 })] }, "enroll")?.done,
    ).toBe(true);
    // Area de curso que comecou por uma turma de pacote: a matricula nela conta.
    const pkg = stepOf({ ...base, classGroups: [group("p1", { billingMode: "package", enrolledCount: 1 })] }, "enroll");
    expect(pkg?.done).toBe(true);
    expect(pkg?.label).toBe("Matricular alunos na turma");
  });

  it("sem curso, matricular leva à turma ativa e fala em turma", () => {
    const base = input({ areaBillingMode: "course" });
    const step = stepOf({ ...base, classGroups: [group("p1", { billingMode: "package" })] }, "enroll");
    expect(step?.href).toBe("/classes/p1?enroll=true");
    expect(step?.label).toBe("Matricular alunos na turma");
    expect(step?.done).toBe(false);
  });

  it("matricular leva ao curso ativo com a matrícula aberta", () => {
    const base = input({ areaBillingMode: "course" });
    expect(stepOf(base, "enroll")?.href).toBe("/classes");
    const groups = [
      group("old", { billingMode: "course", status: "inactive" }),
      group("c2", { billingMode: "course" }),
    ];
    expect(stepOf({ ...base, classGroups: groups }, "enroll")?.href).toBe("/classes/c2?enroll=true");
  });

  it("progresso: criar o curso deixa a matrícula como próximo passo; matricular conclui", () => {
    const base = input({ ...READY_UNTIL_CLASSES, areaBillingMode: "course" });

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
    expect(steps.find((s) => s.id === "plans")).toMatchObject({
      label: "Criar planos ou pacotes",
      href: "/classes/plans",
      done: false,
    });
  });

  it("planos ou pacotes: um plano ativo ou um pacote ativo conclui", () => {
    expect(stepOf(input({ plansCount: 1 }), "plans")?.done).toBe(true);
    expect(stepOf(input({ lessonPackagesCount: 1 }), "plans")?.done).toBe(true);
    expect(stepOf(input(), "plans")?.done).toBe(false);
  });

  it("regras da mensalidade: só pacote, sem plano, dispensa; com plano, continuam pedidas", () => {
    expect(stepOf(input({ lessonPackagesCount: 1 }), "billing")?.done).toBe(true);
    expect(stepOf(input({ lessonPackagesCount: 1, plansCount: 1 }), "billing")?.done).toBe(false);
    expect(stepOf(input({ plansCount: 1 }), "billing")?.done).toBe(false);
    expect(stepOf(input({ billingSet: true }), "billing")?.done).toBe(true);
  });

  it("só com pacotes, a configuração fecha sem regras da mensalidade", () => {
    const summary = summarizeOnboardingSteps(
      buildClassesOnboardingSteps(
        input({
          ...READY_UNTIL_CLASSES,
          billingSet: false,
          plansCount: 0,
          lessonPackagesCount: 2,
          classGroups: [group("p1", { billingMode: "package" })],
        }),
      ),
    );
    expect(summary.isComplete).toBe(true);
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

describe("área de pacote (defaultBillingMode package)", () => {
  it("troca mensalidade e planos pelo pacote de aulas", () => {
    const steps = buildClassesOnboardingSteps(input({ areaBillingMode: "package" }));
    expect(steps.map((s) => s.id)).toEqual(["hours", "modalities", "packages", "team", "clients", "classes"]);
    const packages = steps.find((s) => s.id === "packages");
    expect(packages).toMatchObject({
      label: "Criar um pacote de aulas",
      href: "/classes/plans?tab=packages",
      done: false,
    });
    expect(steps.find((s) => s.id === "classes")?.label).toBe("Criar a primeira turma");
  });

  it("o pacote conclui quando existe um no catálogo", () => {
    expect(stepOf(input({ areaBillingMode: "package", lessonPackagesCount: 1 }), "packages")?.done).toBe(true);
  });

  it("turma ativa de mensalidade traz regras e planos de volta", () => {
    expect(ids(input({ areaBillingMode: "package", classGroups: [group("t1", { billingMode: "membership" })] }))).toEqual([
      "hours", "billing", "modalities", "plans", "packages", "team", "clients", "classes",
    ]);
    // Fora da area de mensalidade, o passo e so de planos e o pacote nao dispensa as regras.
    const withMembership = input({
      areaBillingMode: "package",
      lessonPackagesCount: 1,
      classGroups: [group("t1", { billingMode: "membership" })],
    });
    expect(stepOf(withMembership, "plans")).toMatchObject({ label: "Criar planos de mensalidade", done: false });
    expect(stepOf(withMembership, "billing")?.done).toBe(false);
    expect(ids(input({ areaBillingMode: "package", classGroups: [group("p1", { billingMode: "package" })] }))).not.toContain("plans");
  });

  it("progresso fecha com pacote e turma criados", () => {
    const summary = summarizeOnboardingSteps(
      buildClassesOnboardingSteps(
        input({
          ...READY_UNTIL_CLASSES,
          areaBillingMode: "package",
          lessonPackagesCount: 1,
          classGroups: [group("p1", { billingMode: "package" })],
        }),
      ),
    );
    expect(summary.total).toBe(6);
    expect(summary.isComplete).toBe(true);
  });
});

describe("área sem cobrança (defaultBillingMode free)", () => {
  it("fica só com o essencial: sem mensalidade, planos, pacote ou matrícula", () => {
    expect(ids(input({ areaBillingMode: "free" }))).toEqual(["hours", "modalities", "team", "clients", "classes"]);
  });

  it("turma ativa de mensalidade traz regras e planos de volta", () => {
    expect(ids(input({ areaBillingMode: "free", classGroups: [group("t1", { billingMode: "membership" })] }))).toContain("billing");
  });
});

describe("outra área segue \"Como você cobra?\"", () => {
  const stepsFor = (billing?: "membership" | "course" | "package" | "free") =>
    ids(input({ areaBillingMode: getSegmentPreset("custom", "levels", billing).defaultBillingMode }));

  it("sem resposta (tenant antigo) segue como mensalidade", () => {
    expect(stepsFor(undefined)).toEqual(["hours", "billing", "modalities", "plans", "team", "clients", "classes"]);
  });

  it("curso, pacote e sem cobrança mudam os passos", () => {
    expect(stepsFor("course")).toEqual(["hours", "modalities", "team", "clients", "classes", "enroll"]);
    expect(stepsFor("package")).toContain("packages");
    expect(stepsFor("package")).not.toContain("plans");
    expect(stepsFor("free")).toEqual(["hours", "modalities", "team", "clients", "classes"]);
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

describe("palavra de quem dá aula nos primeiros passos", () => {
  it("usa a palavra da área no passo da equipe", () => {
    const step = (words: ClassesOnboardingInput["teamWords"]) =>
      buildClassesOnboardingSteps(input({ teamWords: words })).find((s) => s.id === "team");
    expect(step(INSTRUCTOR_WORDS)?.label).toBe("Cadastrar instrutores");
    expect(step(TEACHER_WORDS)?.label).toBe("Cadastrar professores");
  });
});
