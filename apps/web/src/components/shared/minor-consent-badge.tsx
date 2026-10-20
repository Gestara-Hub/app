"use client";

import { ShieldAlert } from "lucide-react";
import type { Client } from "@gestarahub/contracts";
import { todayISO } from "@gestarahub/core/date";
import { ageAt } from "@/lib/progression-tracks";

/**
 * Verifica se um aluno é menor de 18 anos e está com a autorização dos pais/responsável pendente (Art. 14 da LGPD).
 */
export function isMinorConsentPending(
  client?: Pick<Client, "birthDate" | "minorConsentStatus"> | null,
): boolean {
  if (!client) return false;

  // Se já foi confirmado por WhatsApp ou termo físico em papel, não está pendente
  if (
    client.minorConsentStatus === "confirmed_whatsapp" ||
    client.minorConsentStatus === "confirmed_paper"
  ) {
    return false;
  }

  // Se o status já estiver explicitamente como "pending"
  if (client.minorConsentStatus === "pending") {
    return true;
  }

  // Se a data de nascimento indicar que é menor de 18 anos
  const age = ageAt(client.birthDate, todayISO());
  return age !== null && age < 18;
}

/**
 * Selo sutil âmbar indicando pendência de autorização de menor de idade nos termos da LGPD.
 * Usado na listagem de alunos, na lista de matriculados da turma e na lista de chamada da aula.
 */
export function MinorConsentBadge({
  client,
  compact = false,
}: {
  client?: Pick<Client, "birthDate" | "minorConsentStatus"> | null;
  compact?: boolean;
}) {
  if (!isMinorConsentPending(client)) return null;

  const title = "Autorização de menor pendente (Artigo 14 da LGPD)";

  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
    >
      <ShieldAlert className="size-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <span>{compact ? "Termo pendente" : "Termo de menor pendente"}</span>
    </span>
  );
}
