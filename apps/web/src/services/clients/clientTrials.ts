import type { Client, Id, TrialOutcome, TrialStudentView } from "@gestarahub/contracts";
import { trialOutcome } from "@gestarahub/core/trials";
import { store } from "@/services/world/store";
import { parseSessionId } from "../classes/classShared";

/**
 * Aula experimental e conversao por aluno (09/11/2026): a regra e do core
 * (`trialOutcome`); aqui so se junta o que esta no espaco. O dia da
 * experimental e o da aula (vem do id da sessao), nao o da reserva.
 */

const trialReservationsOf = (studentId: Id) =>
  (store.reservations ?? []).filter((r) => r.studentId === studentId && r.kind === "trial" && r.status === "reserved");

export function trialOutcomeOf(client: Client, today: string): TrialOutcome {
  const trials = trialReservationsOf(client.id);
  if (trials.length === 0) return { stage: "none", trialCount: 0 };
  return trialOutcome(
    {
      trialDates: trials.map((r) => parseSessionId(r.sessionId)?.date ?? r.reservedAt.slice(0, 10)),
      enrollments: store.enrollments.filter((e) => e.studentId === client.id),
      packages: (store.studentPackages ?? []).filter((p) => p.studentId === client.id),
      planStartDate: client.planId ? client.planStartDate : undefined,
    },
    today,
  );
}

/** Quem fez experimental (ainda sem voltar ou ja convertido), do mais recente para o mais antigo. */
export function trialStudents(clients: Client[], today: string): TrialStudentView[] {
  const groupName = new Map(store.classGroups.map((g) => [g.id, g.name]));
  return clients
    .map((client): TrialStudentView | null => {
      const outcome = trialOutcomeOf(client, today);
      if (outcome.stage === "none") return null;
      const classGroupNames = Array.from(
        new Set(trialReservationsOf(client.id).map((r) => groupName.get(r.classGroupId) ?? "").filter(Boolean)),
      );
      return {
        ...outcome,
        studentId: client.id,
        studentName: client.name,
        ...(client.phone ? { phone: client.phone } : {}),
        classGroupNames,
      };
    })
    .filter((v): v is TrialStudentView => v !== null)
    .sort((a, b) => (b.lastTrialAt ?? b.firstTrialAt ?? "").localeCompare(a.lastTrialAt ?? a.firstTrialAt ?? ""));
}
