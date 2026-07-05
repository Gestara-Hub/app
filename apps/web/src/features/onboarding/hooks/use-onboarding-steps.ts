"use client";

import { useClients } from "@/features/clients";
import { useServices } from "@/features/services";
import { useProfessionals } from "@/features/professionals";
import { useAppointments } from "@/features/appointments";
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
  const servicesQuery = useServices();
  const professionalsQuery = useProfessionals();
  const clientsQuery = useClients();
  const appointmentsQuery = useAppointments();

  const isReady =
    !unitQuery.isPending &&
    !servicesQuery.isPending &&
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
      id: "services",
      label: "Cadastrar serviços",
      description: "Adicione o que o seu negócio oferece.",
      href: "/services",
      cta: "Adicionar",
      done: (servicesQuery.data?.length ?? 0) > 0,
      // Categoria do servico e opcional — sem pre-requisito aqui.
    },
    {
      id: "team",
      label: "Montar a equipe",
      description: "Cadastre os profissionais que fazem os atendimentos.",
      href: "/team",
      cta: "Adicionar",
      done: (professionalsQuery.data?.length ?? 0) > 0,
      // Cargo e serviços do profissional sao opcionais — sem pre-requisito aqui.
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
