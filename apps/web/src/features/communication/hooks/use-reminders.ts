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
    /** Alunos com troca de nivel pela idade (so a contagem; a lista e do Painel). */
    levelChanges: query.data?.levelChanges?.length ?? 0,
    isPending: query.isPending,
    snooze,
    ignore,
  };
}

/**
 * Sino fora do Painel (12/11/2026): so o numero e as chaves de atencao, montados
 * no servidor. A lista inteira (~35 KB) vem so ao abrir o sino ou no Painel.
 */
export function useReminderSummary(today: string, enabled = true) {
  const { preferences } = useUserPreferences();
  const snoozes = cleaned(preferences.reminderSnoozes, today);
  return useQuery({
    queryKey: queryKeys.communication.reminderSummary(today, snoozes),
    queryFn: () => communicationService.getReminderSummary({ today, snoozes }),
    enabled,
    // Trocar o adiamento muda a chave: segura o numero de antes ate chegar o novo.
    placeholderData: (previous) => previous,
  });
}

/** Tira os adiamentos que ja passaram (a preferencia nao cresce para sempre). */
function cleaned(snoozes: Record<string, string> | undefined, today: string): Record<string, string> {
  return Object.fromEntries(Object.entries(snoozes ?? {}).filter(([, until]) => until === "never" || until > today));
}
