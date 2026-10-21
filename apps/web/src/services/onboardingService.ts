import type { DiscoveryMilestones } from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import { simulateRead } from "@/mocks/helpers";
import { delegateAll } from "./world/delegate";

/**
 * Leituras do onboarding que nao cabem num service de entidade. Hoje: os
 * marcos do card "Descubra o dia a dia" (Dashboard, depois da configuracao
 * inicial), calculados do store numa unica leitura. Na API real vira um
 * endpoint de agregados (EXISTS por tabela, filtrando o tenant).
 */
export const onboardingServiceImpl = {
  getDiscoveryMilestones(): Promise<DiscoveryMilestones> {
    return simulateRead(() => {
      const enrollClassGroupId = store.classGroups
        .filter((group) => group.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))[0]?.id;
      const charges = store.charges ?? [];
      const clients = store.clients ?? [];
      return {
        hasEnrollment: (store.enrollments ?? []).some((e) => e.status === "active"),
        enrollClassGroupId,
        hasAttendance: (store.attendances ?? []).length > 0,
        hasPaidCharge: charges.some((c) => c.status === "paid"),
        hasPaidCourseInstallment: charges.some((c) => c.kind === "course" && c.status === "paid"),
        hasPackageSale: (store.studentPackages ?? []).length > 0,
        hasMessage: (store.messageLogs ?? []).length > 0,
        hasProgressRecord: clients.some((client) =>
          Object.values(client.progressions ?? {}).some(
            (progression) =>
              (progression.evaluations?.length ?? 0) > 0 ||
              (progression.goals?.length ?? 0) > 0 ||
              (progression.promotionHistory?.length ?? 0) > 0,
          ),
        ),
      };
    });
  },
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const onboardingService = delegateAll("onboarding", onboardingServiceImpl);
