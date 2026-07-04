"use client";

import { useClients } from "@/features/clients";
import { useCategories } from "@/features/categories";
import { useServices } from "@/features/services";
import { useProfessionals } from "@/features/professionals";
import { useAppointments } from "@/features/appointments";
import { useRoles } from "@/features/roles";
import { useUnit } from "@/features/settings";

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
 * `isReady` so fica true quando todas as leituras resolveram, para nao piscar
 * um progresso incompleto.
 */
export function useOnboardingSteps() {
  const unitQuery = useUnit();
  const categoriesQuery = useCategories();
  const servicesQuery = useServices();
  const rolesQuery = useRoles();
  const professionalsQuery = useProfessionals();
  const clientsQuery = useClients();
  const appointmentsQuery = useAppointments();

  const isReady =
    !unitQuery.isPending &&
    !categoriesQuery.isPending &&
    !servicesQuery.isPending &&
    !rolesQuery.isPending &&
    !professionalsQuery.isPending &&
    !clientsQuery.isPending &&
    !appointmentsQuery.isPending;

  const hoursSet = Boolean(
    unitQuery.data?.businessHours?.some((day) => !day.closed),
  );

  const steps: OnboardingStep[] = [
    {
      id: "hours",
      label: "Definir horário de funcionamento",
      description: "Configure o expediente da unidade — base da agenda.",
      href: "/settings?tab=horarios",
      cta: "Configurar",
      done: hoursSet,
    },
    {
      id: "categories",
      label: "Cadastrar categorias",
      description: "Agrupe seus serviços em categorias — o serviço é vinculado a uma.",
      href: "/services?manage=categories",
      cta: "Adicionar",
      done: (categoriesQuery.data?.length ?? 0) > 0,
    },
    {
      id: "services",
      label: "Cadastrar serviços",
      description: "Adicione o que o seu negócio oferece.",
      href: "/services",
      cta: "Adicionar",
      done: (servicesQuery.data?.length ?? 0) > 0,
      // Cadastrar servico exige uma categoria (categoryId obrigatorio).
      requires: ["categories"],
    },
    {
      id: "roles",
      label: "Cadastrar cargos",
      description: "Defina os cargos da equipe — o profissional é vinculado a um.",
      href: "/team?manage=roles",
      cta: "Adicionar",
      done: (rolesQuery.data?.length ?? 0) > 0,
    },
    {
      id: "team",
      label: "Montar a equipe",
      description: "Cadastre os profissionais que realizam os serviços.",
      href: "/team",
      cta: "Adicionar",
      done: (professionalsQuery.data?.length ?? 0) > 0,
      // Cadastrar profissional exige ao menos um servico (serviceIds) e um cargo
      // existente (roleId — o form so seleciona, nao cria).
      requires: ["services", "roles"],
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
      // Um agendamento precisa de cliente + profissional + servico.
      requires: ["services", "team", "clients"],
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;

  return {
    steps,
    doneCount,
    total: steps.length,
    isReady,
    isComplete: doneCount === steps.length,
  };
}
