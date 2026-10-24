"use client";

import { Cake } from "lucide-react";
import { UPCOMING_BIRTHDAY_DAYS, daysUntilBirthday, isBirthdayToday } from "@/lib/birthdays";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Selo de aniversario. Sem `date`, compara com hoje ("Aniversário hoje"); com
 * `date` (ex.: dia da aula no calendario), avisa se faz aniversario naquele dia.
 * `showUpcoming` mostra tambem os proximos dias ("Aniversário em 3 dias"),
 * so quando a referencia e hoje. `compact` encurta o texto ("Aniv. hoje", "Aniv. em 3 dias"); o
 * texto completo fica no title e para leitor de tela (achado 73 do teste de 23/10:
 * "Em 5 dias" sozinho parecia vencimento).
 */
export function BirthdayBadge({
  birthDate,
  date,
  showUpcoming = false,
  compact = false,
}: {
  birthDate?: string;
  date?: string;
  showUpcoming?: boolean;
  compact?: boolean;
}) {
  if (!birthDate) return null;
  const today = dateInSpace();
  const day = date ?? today;

  if (isBirthdayToday(birthDate, day)) {
    const full = day === today ? "Aniversário hoje" : "Aniversário neste dia";
    return (
      <span
        title={full}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-700 dark:text-pink-300"
      >
        <Cake className="size-3" aria-hidden />
        {compact ? (
          <>
            <span aria-hidden>{day === today ? "Aniv. hoje" : "Aniv. neste dia"}</span>
            <span className="sr-only">{full}</span>
          </>
        ) : (
          full
        )}
      </span>
    );
  }

  if (!showUpcoming || day !== today) return null;
  const days = daysUntilBirthday(birthDate, today);
  if (days < 1 || days > UPCOMING_BIRTHDAY_DAYS) return null;
  const full = days === 1 ? "Aniversário amanhã" : `Aniversário em ${days} dias`;
  return (
    <span
      title={full}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
    >
      <Cake className="size-3" aria-hidden />
      {compact ? (
        <>
          <span aria-hidden>{days === 1 ? "Aniv. amanhã" : `Aniv. em ${days} dias`}</span>
          <span className="sr-only">{full}</span>
        </>
      ) : (
        full
      )}
    </span>
  );
}
