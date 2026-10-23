"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { queryKeys } from "@/lib/queryKeys";
import { communicationService } from "@/services/communication";
import { useUserPreferences } from "@/features/preferences";
import { buildReminders, pendingReminders, type ReminderGroup } from "../reminders";

/**
 * Lembretes de hoje (doc product/25): uma leitura no servidor e o motor puro.
 * O painel, o sino e o envio em sequencia usam este mesmo hook.
 */
export function useReminders(today: string) {
  const { preferences, updatePreferences } = useUserPreferences();
  const query = useQuery({
    queryKey: queryKeys.communication.reminders,
    queryFn: () => communicationService.getReminderSources(),
  });
  const snoozes = preferences.reminderSnoozes;
  const groups: ReminderGroup[] = useMemo(
    () => (query.data ? buildReminders(query.data, { today, snoozes }) : []),
    [query.data, today, snoozes],
  );

  /** "Lembrar amanhã" (ou depois de N dias). */
  function snooze(key: string, days = 1) {
    const until = format(addDays(parseISO(today), days), "yyyy-MM-dd");
    updatePreferences({ reminderSnoozes: { ...cleaned(snoozes, today), [key]: until } });
  }

  /** "Não lembrar" deste item. */
  function ignore(key: string) {
    updatePreferences({ reminderSnoozes: { ...cleaned(snoozes, today), [key]: "never" } });
  }

  return {
    groups,
    pending: pendingReminders(groups),
    canBilling: query.data?.canBilling ?? false,
    isPending: query.isPending,
    snooze,
    ignore,
  };
}

/** Tira os adiamentos que ja passaram (a preferencia nao cresce para sempre). */
function cleaned(snoozes: Record<string, string> | undefined, today: string): Record<string, string> {
  return Object.fromEntries(Object.entries(snoozes ?? {}).filter(([, until]) => until === "never" || until > today));
}
