"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { teamWordsFor } from "@/lib/team-words";
import { onboardingService } from "@/services/settings/onboardingService";
import { useBusinessSegment, useOrganization, useUnit } from "@/features/settings";
import { useModel } from "@/features/auth";
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
  const segmentTeam = teamWordsFor(true, segment.teacherTitle);
  const unitQuery = useUnit();
  const orgQuery = useOrganization();
  // Uma leitura com as contagens (antes: dez listas inteiras em toda pagina).
  const snapshotQuery = useQuery({
    queryKey: queryKeys.onboarding.snapshot,
    queryFn: () => onboardingService.getOnboardingSnapshot(),
  });
  const snapshot = snapshotQuery.data;

  const isClasses = model === "classes";
  const areaBillingMode = isClasses ? segment.defaultBillingMode : "membership";
  const isCourseArea = areaBillingMode === "course";
  const hasProgressionTrack = isClasses && segment.progressionTemplate !== null;

  const hoursSet = Boolean(
    unitQuery.data?.businessHours?.some((day) => !day.closed),
  );

  let steps: OnboardingStep[];
  let isReady: boolean;

  if (isClasses) {
    isReady = !unitQuery.isPending && !orgQuery.isPending && !snapshotQuery.isPending;

    steps = buildClassesOnboardingSteps({
      hoursSet,
      billingSet: Boolean(orgQuery.data?.settings?.billingTiming),
      modalitiesCount: snapshot?.modalitiesCount ?? 0,
      modalitiesNeedReview: orgQuery.data?.settings?.modalitiesReviewed === false,
      // So os ativos contam (inativo nao se vende nem se atribui).
      plansCount: snapshot?.activePlansCount ?? 0,
      lessonPackagesCount: snapshot?.activeLessonPackagesCount ?? 0,
      professionalsCount: snapshot?.professionalsCount ?? 0,
      clientsCount: snapshot?.clientsCount ?? 0,
      classGroups: snapshot?.classGroups ?? [],
      areaBillingMode,
      teamWords: segmentTeam,
    });
  } else {
    isReady = !unitQuery.isPending && !snapshotQuery.isPending;

    steps = buildSchedulingOnboardingSteps({
      hoursSet,
      servicesCount: snapshot?.servicesCount ?? 0,
      professionalsCount: snapshot?.professionalsCount ?? 0,
      clientsCount: snapshot?.clientsCount ?? 0,
      appointmentsCount: snapshot?.appointmentsCount ?? 0,
    });
  }

  const summary = summarizeOnboardingSteps(steps);
  // Passos prontos: as gravacoes deixam de reler a contagem (ver `createQueryClient`).
  const queryClient = useQueryClient();
  const setupDone = isReady && summary.isComplete;
  useEffect(() => {
    queryClient.setQueryData(queryKeys.onboarding.setupDone, setupDone);
  }, [queryClient, setupDone]);

  return {
    steps,
    ...summary,
    isReady,
    isClasses,
    isCourseArea,
    areaBillingMode,
    hasProgressionTrack,
  };
}
