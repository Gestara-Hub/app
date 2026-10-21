import type { ClassGroup } from "@gestarahub/contracts";
import { classBillingMode } from "@gestarahub/core/billing";

/** Turma de pacote ou de mensalidade aceita pacote; sem cobranca e curso, nunca. */
export function acceptsPackages(g: Pick<ClassGroup, "billingMode">): boolean {
  const mode = classBillingMode(g);
  return mode === "package" || mode === "membership";
}
