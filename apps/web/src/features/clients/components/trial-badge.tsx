"use client";

import type { TrialOutcome } from "@gestarahub/contracts";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";

/**
 * Selo da aula experimental (09/11/2026): quem ainda nao voltou aparece como
 * "Experimental"; quem virou aluno nao ganha selo (ja e aluno como os outros).
 */
export function TrialBadge({ trial, compact = false }: { trial: TrialOutcome | undefined; compact?: boolean }) {
  if (!trial || trial.stage !== "trial") return null;
  const since = trial.lastTrialAt ?? trial.firstTrialAt;
  const label = compact || !since ? "Experimental" : `Experimental · ${format(parseISO(since), "dd/MM")}`;
  return (
    <Badge
      variant="outline"
      className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      title={trial.trialCount > 1 ? `${trial.trialCount} aulas experimentais` : "1 aula experimental"}
    >
      {label}
    </Badge>
  );
}
