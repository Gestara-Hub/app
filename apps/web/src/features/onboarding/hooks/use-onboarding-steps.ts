"use client";

import { useClients } from "@/features/clients";
import { useServices } from "@/features/services";
import { useProfessionals } from "@/features/professionals";
import { useAppointments } from "@/features/appointments";
import { useUnit } from "@/features/settings";
import { useModel } from "@/features/auth";
import { useCategories } from "@/features/categories";
import { useClassGroups, usePlans } from "@/features/turmas";

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  /** Destino do CTA (deep-link para a tela do passo). */
  href: string;
  cta: string;
  done: boolean;
  /** Ids de passos que precisam estar concluidos antes deste (senao, bloqueado). */
  requires?: string[];
}

/**
 * Passos do onboarding com conclusao derivada do dado real (nao manual): cada
 * passo se marca sozinho quando a entidade correspondente passa a existir.
 * Contextualizado ao modelo operacional (atendimento individual vs turmas/academia).
 */
export function useOnboardingSteps() {
  const model = useModel();
  const unitQuery = useUnit();
  const servicesQuery = useServices();
  const professionalsQuery = useProfessionals();
  const clientsQuery = useClients();
  const appointmentsQuery = useAppointments();
  const categoriesQuery = useCategories();
  const classGroupsQuery = useClassGroups();
  const plansQuery = usePlans();

  const isClasses = model === "classes";

  const hoursSet = Boolean(
    unitQuery.data?.businessHours?.some((day) => !day.closed),
  );

  let steps: OnboardingStep[] = [];
  let isReady = false;

  if (isClasses) {
    isReady =
      !unitQuery.isPending &&
      !professionalsQuery.isPending &&
      !categoriesQuery.isPending &&
      !classGroupsQuery.isPending &&
      !clientsQuery.isPending &&
      !plansQuery.isPending;

    steps = [
      {
        id: "hours",
        label: "Definir horário de funcionamento",
        description: "Configure o expediente da unidade.",
        href: "/settings?tab=horarios",
        cta: "Configurar",
        done: hoursSet,
      },
      {
        id: "modalities",
        label: "Cadastrar modalidades",
        description: "Adicione as modalidades ou cursos oferecidos (ex: Inglês, Dança, Natação).",
        href: "/classes/modalities",
        cta: "Adicionar",
        done: (categoriesQuery.data?.length ?? 0) > 0,
      },
      {
        id: "plans",
        label: "Criar planos de mensalidade",
        description: "Defina os planos para cobrança dos alunos.",
        href: "/classes/plans",
        cta: "Criar",
        done: (plansQuery.data?.length ?? 0) > 0,
      },
      {
        id: "team",
        label: "Cadastrar professores e instrutores",
        description: "Cadastre os professores e instrutores que ministram as aulas.",
        href: "/team",
        cta: "Adicionar",
        done: (professionalsQuery.data?.length ?? 0) > 0,
      },
      {
        id: "clients",
        label: "Cadastrar alunos",
        description: "Cadastre os alunos que frequentarão as turmas.",
        href: "/clients",
        cta: "Adicionar",
        done: (clientsQuery.data?.length ?? 0) > 0,
      },
      {
        id: "classes",
        label: "Criar a primeira turma",
        description: "Defina os horários, capacidade e dias das aulas.",
        href: "/classes",
        cta: "Criar",
        done: (classGroupsQuery.data?.length ?? 0) > 0,
        requires: ["team", "clients"],
      },
    ];
  } else {
    isReady =
      !unitQuery.isPending &&
      !servicesQuery.isPending &&
      !professionalsQuery.isPending &&
      !clientsQuery.isPending &&
      !appointmentsQuery.isPending;

    steps = [
      {
        id: "hours",
        label: "Definir horário de funcionamento",
        description: "Configure o expediente da unidade — base da agenda.",
        href: "/settings?tab=horarios",
        cta: "Configurar",
        done: hoursSet,
      },
      {
        id: "services",
        label: "Cadastrar serviços",
        description: "Adicione o que o seu negócio oferece.",
        href: "/services",
        cta: "Adicionar",
        done: (servicesQuery.data?.length ?? 0) > 0,
      },
      {
        id: "team",
        label: "Montar a equipe",
        description: "Cadastre os profissionais que fazem os atendimentos.",
        href: "/team",
        cta: "Adicionar",
        done: (professionalsQuery.data?.length ?? 0) > 0,
      },
      {
        id: "clients",
        label: "Adicionar clientes",
        description: "Comece a montar sua base de clientes.",
        href: "/clients",
        cta: "Adicionar",
        done: (clientsQuery.data?.length ?? 0) > 0,
      },
      {
        id: "appointment",
        label: "Criar o primeiro agendamento",
        description: "Agende o primeiro atendimento na sua agenda.",
        href: "/schedule",
        cta: "Criar",
        done: (appointmentsQuery.data?.length ?? 0) > 0,
        requires: ["services", "team", "clients"],
      },
    ];
  }

  const doneCount = steps.filter((step) => step.done).length;
  const doneById = Object.fromEntries(steps.map((s) => [s.id, s.done]));
  const isLocked = (step: OnboardingStep) =>
    (step.requires ?? []).some((id) => !doneById[id]);
  const nextStep = steps.find((step) => !step.done && !isLocked(step)) ?? null;

  return {
    steps,
    doneCount,
    total: steps.length,
    isReady,
    isComplete: doneCount === steps.length,
    isClasses,
    nextStep,
  };
}
