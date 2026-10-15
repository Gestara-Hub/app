import type { ClassBillingMode, ClassGroupView } from "@gestarahub/contracts";
import { classBillingMode } from "@gestarahub/core/billing";

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  /** Destino do CTA (deep-link para a tela do passo). */
  href: string;
  cta: string;
  done: boolean;
  /**
   * Existe mas falta o dono conferir (ex.: modalidades criadas no setup). Nao
   * conta como concluido, mas ja libera os passos que dependem dele.
   */
  needsReview?: boolean;
  /** Ids de passos que precisam estar concluidos antes deste (senao, bloqueado). */
  requires?: string[];
}

/** Libera os passos que dependem dele: concluido ou so faltando revisar. */
export function isStepSatisfied(step: OnboardingStep): boolean {
  return step.done || Boolean(step.needsReview);
}

/** O que os passos do modelo de turmas precisam saber do dado real. */
export interface ClassesOnboardingInput {
  hoursSet: boolean;
  /** Regras da mensalidade ja confirmadas (`billingTiming` salvo). */
  billingSet: boolean;
  modalitiesCount: number;
  /** Modalidades criadas no setup que o dono ainda nao conferiu. */
  modalitiesNeedReview: boolean;
  /** Planos de mensalidade ativos. */
  plansCount: number;
  /** Pacotes de aulas ativos do catalogo (Planos e pacotes > Pacotes de aulas). */
  lessonPackagesCount: number;
  professionalsCount: number;
  clientsCount: number;
  classGroups: Pick<ClassGroupView, "id" | "status" | "billingMode" | "enrolledCount">[];
  /**
   * Forma de cobranca padrao da area (`defaultBillingMode` do preset; na
   * "Outra área", a resposta de "Como você cobra?").
   */
  areaBillingMode: ClassBillingMode;
}

/**
 * Passos do modelo de turmas. Mensalidade (regras + planos) so aparece onde
 * ela existe: areas de mensalidade, ou outra area com turma ativa cobrando
 * mensalidade. Area de curso troca a primeira turma pelo primeiro curso e
 * ganha o passo de matricular alunos no curso. Area de pacote ganha o passo
 * de criar um pacote de aulas. Area sem cobranca fica so com o essencial.
 * Na area de mensalidade, o espaco escolhe planos OU pacotes: um dos dois
 * conclui "Criar planos ou pacotes", e so pacote (sem plano) dispensa as
 * regras da mensalidade.
 */
export function buildClassesOnboardingSteps(input: ClassesOnboardingInput): OnboardingStep[] {
  const { areaBillingMode, classGroups, modalitiesNeedReview } = input;
  const isCourseArea = areaBillingMode === "course";
  const isPackageArea = areaBillingMode === "package";
  const isMembershipArea = areaBillingMode === "membership";
  const hasPlans = input.plansCount > 0;
  const hasPackages = input.lessonPackagesCount > 0;
  const hasModalities = input.modalitiesCount > 0;
  const hasMembershipClass = classGroups.some(
    (group) => group.status === "active" && classBillingMode(group) === "membership",
  );
  const showMembershipSteps = areaBillingMode === "membership" || hasMembershipClass;
  const courses = classGroups.filter((group) => classBillingMode(group) === "course");
  // Area de curso que comecou por outra forma (pacote, mensalidade): a 1a
  // matricula em qualquer turma conclui o passo, e o atalho leva a ela.
  const hasCourse = courses.length > 0;
  const activeGroups = classGroups.filter((group) => group.status === "active");
  const enrollTarget =
    courses.find((group) => group.status === "active") ?? activeGroups[0] ?? classGroups[0] ?? null;

  const steps: (OnboardingStep | null)[] = [
    {
      id: "hours",
      label: "Definir horário de funcionamento",
      description: "Configure os dias e horários de funcionamento da unidade.",
      href: "/settings?tab=horarios",
      cta: "Configurar",
      done: input.hoursSet,
    },
    showMembershipSteps
      ? {
          id: "billing",
          label: "Definir regras da mensalidade",
          description: "Configure o regime padrão (pré/pós-pago) e vencimentos.",
          href: "/settings?tab=geral#billing-rules",
          cta: "Configurar",
          // Regras so valem para a mensalidade: so pacote, sem plano, dispensa.
          done: input.billingSet || (isMembershipArea && hasPackages && !hasPlans),
        }
      : null,
    {
      id: "modalities",
      label: "Cadastrar modalidades",
      description: modalitiesNeedReview
        ? "Confira os níveis e as metas das modalidades criadas."
        : "Adicione as modalidades ou atividades oferecidas.",
      href: "/classes/modalities",
      cta: modalitiesNeedReview ? "Revisar" : "Adicionar",
      done: hasModalities && !modalitiesNeedReview,
      needsReview: hasModalities && modalitiesNeedReview,
    },
    showMembershipSteps
      ? {
          id: "plans",
          ...(isMembershipArea
            ? {
                label: "Criar planos ou pacotes",
                description: "Mensalidade, pacote de aulas ou os dois.",
                done: hasPlans || hasPackages,
              }
            : {
                label: "Criar planos de mensalidade",
                description: "Defina os planos para cobrança dos alunos.",
                done: hasPlans,
              }),
          href: "/classes/plans",
          cta: "Criar",
          requires: ["modalities"],
        }
      : null,
    isPackageArea
      ? {
          id: "packages",
          label: "Criar um pacote de aulas",
          description: "Defina quantas aulas, o valor e a validade.",
          href: "/classes/plans?tab=packages",
          cta: "Criar",
          done: hasPackages,
        }
      : null,
    {
      id: "team",
      label: "Cadastrar professores e instrutores",
      description: "Cadastre os professores e instrutores que ministram as aulas.",
      href: "/team",
      cta: "Adicionar",
      done: input.professionalsCount > 0,
    },
    {
      id: "clients",
      label: "Cadastrar alunos",
      description: isCourseArea
        ? "Cadastre os alunos que farão os cursos."
        : "Cadastre os alunos que frequentarão as turmas.",
      href: "/clients",
      cta: "Adicionar",
      done: input.clientsCount > 0,
    },
    {
      id: "classes",
      label: isCourseArea ? "Criar o primeiro curso" : "Criar a primeira turma",
      description: isCourseArea
        ? "Defina o valor, as parcelas e as datas do curso."
        : "A etapa final para abrir as matrículas e ativar o seu painel do dia a dia.",
      href: "/classes",
      cta: "Criar",
      done: classGroups.length > 0,
      requires: ["hours", "modalities", "team", "clients"],
    },
    isCourseArea
      ? {
          id: "enroll",
          label: hasCourse || classGroups.length === 0 ? "Matricular alunos no curso" : "Matricular alunos na turma",
          description: hasCourse || classGroups.length === 0
            ? "Matricule os alunos e gere as parcelas do curso."
            : "Matricule os primeiros alunos na turma.",
          href: enrollTarget ? `/classes/${enrollTarget.id}?enroll=true` : "/classes",
          cta: "Matricular",
          done: classGroups.some((group) => group.enrolledCount > 0),
          requires: ["classes"],
        }
      : null,
  ];

  return steps.filter((step): step is OnboardingStep => step !== null);
}

/** O que os passos do atendimento individual precisam saber do dado real. */
export interface SchedulingOnboardingInput {
  hoursSet: boolean;
  servicesCount: number;
  professionalsCount: number;
  clientsCount: number;
  appointmentsCount: number;
}

export function buildSchedulingOnboardingSteps(input: SchedulingOnboardingInput): OnboardingStep[] {
  return [
    {
      id: "hours",
      label: "Definir horário de funcionamento",
      description: "Configure o expediente da unidade — base da agenda.",
      href: "/settings?tab=horarios",
      cta: "Configurar",
      done: input.hoursSet,
    },
    {
      id: "services",
      label: "Cadastrar serviços",
      description: "Adicione o que o seu negócio oferece.",
      href: "/services",
      cta: "Adicionar",
      done: input.servicesCount > 0,
    },
    {
      id: "team",
      label: "Montar a equipe",
      description: "Cadastre os profissionais que fazem os atendimentos.",
      href: "/team",
      cta: "Adicionar",
      done: input.professionalsCount > 0,
    },
    {
      id: "clients",
      label: "Adicionar clientes",
      description: "Comece a montar sua base de clientes.",
      href: "/clients",
      cta: "Adicionar",
      done: input.clientsCount > 0,
    },
    {
      id: "appointment",
      label: "Criar o primeiro agendamento",
      description: "Agende o primeiro atendimento na sua agenda.",
      href: "/schedule",
      cta: "Criar",
      done: input.appointmentsCount > 0,
      requires: ["services", "team", "clients"],
    },
  ];
}

/** Progresso: concluidos e o proximo passo liberado (sem pre-requisito pendente). */
export function summarizeOnboardingSteps(steps: OnboardingStep[]) {
  const doneCount = steps.filter((step) => step.done).length;
  const satisfiedById = Object.fromEntries(steps.map((s) => [s.id, isStepSatisfied(s)]));
  const isLocked = (step: OnboardingStep) =>
    (step.requires ?? []).some((id) => !satisfiedById[id]);
  const nextStep = steps.find((step) => !step.done && !isLocked(step)) ?? null;
  return {
    doneCount,
    total: steps.length,
    isComplete: doneCount === steps.length,
    nextStep,
  };
}
