import { formatCents, plural, pluralWord } from "@gestarahub/core/format";

/**
 * Troca de plano do aluno (achado 28 do teste de 23/10): o que a confirmacao
 * mostra antes de salvar. A regra que cancela e recria as mensalidades vive no
 * servico (`clientLifecycleService`); aqui so se descreve o efeito.
 */

interface ChargeLike {
  status: string;
  amountCents: number;
  periodStart?: string;
  dueDate: string;
}

const shortDate = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

/** Mensalidades em aberto que o plano novo substitui (periodo a partir do inicio). */
export function replacedMembershipCharges(
  charges: readonly ChargeLike[],
  startDate: string,
): { count: number; totalCents: number } {
  const replaced = charges.filter(
    (c) =>
      (c.status === "pending" || c.status === "overdue" || c.status === "waived") &&
      (c.periodStart ?? c.dueDate) >= startDate,
  );
  return { count: replaced.length, totalCents: replaced.reduce((sum, c) => sum + c.amountCents, 0) };
}

/** Texto da confirmacao ao pausar a assinatura (a regra vive em `clientLifecycleService`). */
export function pauseDescription(): string {
  return "A assinatura fica parada: sem mensalidade nova até voltar, e o lembrete de WhatsApp deixa de sair. As mensalidades dos próximos períodos deixam de valer. O que já foi pago não muda.";
}

/** A mensalidade em aberto do periodo em curso, para o dono cancelar ou manter. */
export function pausedChargeDescription(
  charges: readonly { amountCents: number; dueDate: string; status: string }[],
): string {
  const list = charges
    .map((c) => `${formatCents(c.amountCents)} (vence ${shortDate(c.dueDate)})`)
    .join(" e ");
  return `${pluralWord(charges.length, "A mensalidade", "As mensalidades")} em curso ${pluralWord(charges.length, "está", "estão")} em aberto: ${list}. Cancelar tira ${pluralWord(charges.length, "a cobrança", "as cobranças")} da lista; manter deixa ${pluralWord(charges.length, "a cobrança", "as cobranças")} valendo.`;
}

export function planSwitchDescription(input: {
  fromPlan: string;
  toPlan: string;
  startDate: string;
  replaced: { count: number; totalCents: number };
  firstCharge?: { amountCents: number; dueDate: string };
}): string {
  const { fromPlan, toPlan, startDate, replaced, firstCharge } = input;
  const parts = [`O plano muda de ${fromPlan} para ${toPlan}, valendo a partir de ${shortDate(startDate)}.`];
  parts.push(
    replaced.count > 0
      ? `${plural(replaced.count, "mensalidade em aberto", "mensalidades em aberto")} (${formatCents(replaced.totalCents)}) ${pluralWord(replaced.count, "deixa", "deixam")} de valer e ${pluralWord(replaced.count, "é refeita", "são refeitas")} pelo plano novo.`
      : "Não há mensalidade em aberto para refazer.",
  );
  if (firstCharge) {
    parts.push(
      firstCharge.amountCents > 0
        ? `A primeira cobrança do plano novo é de ${formatCents(firstCharge.amountCents)}, com vencimento em ${shortDate(firstCharge.dueDate)}.`
        : "A primeira cobrança do plano novo sai isenta.",
    );
  }
  parts.push("O que já foi pago não muda.");
  return parts.join(" ");
}
