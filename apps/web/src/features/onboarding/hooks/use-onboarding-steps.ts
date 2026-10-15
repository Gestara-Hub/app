"use client";

import { useClients } from "@/features/clients";
import { useServices } from "@/features/services";
import { useProfessionals } from "@/features/professionals";
import { useAppointments } from "@/features/appointments";
import { useBusinessSegment, useOrganization, useUnit } from "@/features/settings";
import { useModel } from "@/features/auth";
import { useCategories } from "@/features/categories";
import { useClassGroups, useLessonPackages, usePlans } from "@/features/turmas";
import {
  buildClassesOnboardingSteps,
  buildSchedulingOnboardingSteps,
  summarizeOnboardingSteps,
  type OnboardingStep,
} from "../onboarding-steps";

export { isStepSatisfied, type OnboardingStep } from "../onboarding-steps";

/**
 * Passos do onboarding com conclusao derivada do dado real (nao manual): cada
 * passo se marca sozinho quando a entidade correspondente passa a existir.
 * Contextualizado ao modelo operacional (atendimento individual vs turmas) e,
 * nas turmas, a forma de cobranca da area (mensalidade, curso, pacote ou
 * sem cobranca).
 * A montagem dos passos fica em `../onboarding-steps` (pura, testada).
 */
export function useOnboardingSteps() {
  const model = useModel();
  const segment = useBusinessSegment();
  const unitQuery = useUnit();
  const orgQuery = useOrganization();
  const servicesQuery = useServices();
  const professionalsQuery = useProfessionals();
  const clientsQuery = useClients();
  const appointmentsQuery = useAppointments();
  const categoriesQuery = useCategories();
  const classGroupsQuery = useClassGroups();
  const plansQuery = usePlans();
  const lessonPackagesQuery = useLessonPackages();

  const isClasses = model === "classes";
  const areaBillingMode = isClasses ? segment.defaultBillingMode : "membership";
  const isCourseArea = areaBillingMode === "course";

  const hoursSet = Boolean(
    unitQuery.data?.businessHours?.some((day) => !day.closed),
  );

  let steps: OnboardingStep[];
  let isReady: boolean;

  if (isClasses) {
    isReady =
      !unitQuery.isPending &&
      !orgQuery.isPending &&
      !professionalsQuery.isPending &&
      !categoriesQuery.isPending &&
      !classGroupsQuery.isPending &&
      !clientsQuery.isPending &&
      !plansQuery.isPending &&
      !lessonPackagesQuery.isPending;

    steps = buildClassesOnboardingSteps({
      hoursSet,
      billingSet: Boolean(orgQuery.data?.settings?.billingTiming),
      modalitiesCount: categoriesQuery.data?.length ?? 0,
      modalitiesNeedReview: orgQuery.data?.settings?.modalitiesReviewed === false,
      // So os ativos contam (inativo nao se vende nem se atribui).
      plansCount: plansQuery.data?.filter((p) => p.status === "active").length ?? 0,
      lessonPackagesCount: lessonPackagesQuery.data?.filter((p) => p.status === "active").length ?? 0,
      professionalsCount: professionalsQuery.data?.length ?? 0,
      clientsCount: clientsQuery.data?.length ?? 0,
      classGroups: classGroupsQuery.data ?? [],
      areaBillingMode,
    });
  } else {
    isReady =
      !unitQuery.isPending &&
      !servicesQuery.isPending &&
      !professionalsQuery.isPending &&
      !clientsQuery.isPending &&
      !appointmentsQuery.isPending;

    steps = buildSchedulingOnboardingSteps({
      hoursSet,
      servicesCount: servicesQuery.data?.length ?? 0,
      professionalsCount: professionalsQuery.data?.length ?? 0,
      clientsCount: clientsQuery.data?.length ?? 0,
      appointmentsCount: appointmentsQuery.data?.length ?? 0,
    });
  }

  return {
    steps,
    ...summarizeOnboardingSteps(steps),
    isReady,
    isClasses,
    isCourseArea,
    areaBillingMode,
  };
}
