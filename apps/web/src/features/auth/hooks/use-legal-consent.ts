"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { legalConsentService } from "@/services/legalConsent/legalConsentService";
import { useCurrentUser } from "../session-provider";
import type { RecordLegalConsentInput } from "@gestarahub/contracts";

export function useLegalConsent() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();

  const isAlreadyAcceptedInSession = Boolean(
    user.termsAcceptedAt &&
      user.termsVersion ===
        legalConsentService.CURRENT_PLATFORM_TERMS_VERSION,
  );

  const {
    data: consentStatus,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.legalConsent.check(
      user.id,
      "platform_terms",
      legalConsentService.CURRENT_PLATFORM_TERMS_VERSION,
    ),
    queryFn: () =>
      legalConsentService.checkConsent(
        user.id,
        "platform_terms",
        legalConsentService.CURRENT_PLATFORM_TERMS_VERSION,
      ),
    initialData: isAlreadyAcceptedInSession
      ? { accepted: true, acceptedAt: user.termsAcceptedAt }
      : undefined,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const recordConsentMutation = useMutation({
    mutationFn: async (
      customInput?: Partial<RecordLegalConsentInput>,
    ) => {
      return legalConsentService.recordConsent({
        userId: user.id,
        organizationId: user.organizationId,
        consentType: "platform_terms",
        termsVersion: legalConsentService.CURRENT_PLATFORM_TERMS_VERSION,
        metadata: {
          acceptedByUserName: user.name,
          acceptedByUserEmail: user.email,
          ...customInput?.metadata,
        },
        ...customInput,
      });
    },
    onSuccess: (result) => {
      if (result.success && result.acceptedAt) {
        queryClient.setQueryData(
          queryKeys.legalConsent.check(
            user.id,
            "platform_terms",
            legalConsentService.CURRENT_PLATFORM_TERMS_VERSION,
          ),
          { accepted: true, acceptedAt: result.acceptedAt },
        );
        void queryClient.invalidateQueries({
          queryKey: queryKeys.legalConsent.all,
        });
      }
    },
  });

  return {
    isAccepted: consentStatus?.accepted ?? isAlreadyAcceptedInSession,
    acceptedAt: consentStatus?.acceptedAt ?? user.termsAcceptedAt,
    isLoading: isLoading && !isAlreadyAcceptedInSession,
    recordConsent: recordConsentMutation.mutateAsync,
    isSubmitting: recordConsentMutation.isPending,
    refetch,
  };
}
