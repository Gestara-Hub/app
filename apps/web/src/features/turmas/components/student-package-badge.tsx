"use client";

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Ticket } from "lucide-react";
import type { StudentPackageView } from "@gestarahub/contracts";
import { cn } from "@/lib/utils";

/** Pacote acabado ou vencido aparece por ate 30 dias (depois some da lista). */
const RECENT_DAYS = 30;

/**
 * Pacote que representa o aluno na lista: o em uso que vence primeiro; sem
 * nenhum, o que acabou ou venceu ha pouco (para o aviso de renovar).
 */
export function displayPackage(
  packages: StudentPackageView[],
  today: string = format(new Date(), "yyyy-MM-dd"),
): StudentPackageView | undefined {
  const active = packages.filter((p) => p.status === "active");
  const usable = active
    .filter((p) => p.remaining > 0)
    .sort((a, b) => (a.expiresAt ?? "9999-12-31").localeCompare(b.expiresAt ?? "9999-12-31"));
  if (usable[0]) return usable[0];
  const ago = (iso: string) => differenceInCalendarDays(parseISO(today), parseISO(iso));
  return active
    .filter((p) => {
      if (p.isExpired && p.expiresAt) return ago(p.expiresAt) <= RECENT_DAYS;
      const last = p.usages.reduce((max, u) => (u.date > max ? u.date : max), p.purchasedAt);
      return ago(last) <= RECENT_DAYS;
    })
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))[0];
}

/** Aviso do pacote: "Vencido", "Última aula", "Vence hoje" ou "Vence em 5 dias". */
export function packageWarning(pkg: StudentPackageView): string | null {
  if (pkg.isExpired) return "Vencido";
  if (pkg.isLastLesson) return "Última aula";
  if (pkg.expiresSoon) return pkg.daysToExpire === 0 ? "Vence hoje" : `Vence em ${pkg.daysToExpire} ${pkg.daysToExpire === 1 ? "dia" : "dias"}`;
  return null;
}

/** Selo do pacote do aluno: "Pacote 7 de 10" + o aviso, quando houver. */
export function StudentPackageBadge({ pkg }: { pkg: StudentPackageView }) {
  const warning = packageWarning(pkg);
  const left = Math.max(0, pkg.lessonsTotal - pkg.lessonsUsed);
  const attention = Boolean(warning) || pkg.remaining === 0;
  return (
    <span
      title={`${pkg.name}${pkg.expiresAt ? ` · vale até ${format(parseISO(pkg.expiresAt), "dd/MM/yyyy")}` : ""}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        attention
          ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      )}
    >
      <Ticket className="size-3 shrink-0 opacity-75" />
      <span className="tabular-nums">
        {pkg.isExpired ? "Pacote" : `Pacote ${left} de ${pkg.lessonsTotal}`}
      </span>
      {warning ? (
        <span className="rounded bg-background/60 px-1 text-[10px] font-semibold">{warning}</span>
      ) : null}
    </span>
  );
}
