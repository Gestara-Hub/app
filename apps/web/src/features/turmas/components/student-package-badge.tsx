"use client";

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Ticket } from "lucide-react";
import type { StudentPackageView } from "@gestarahub/contracts";
import { cn } from "@/lib/utils";

/** Pacote acabado ou vencido aparece por ate 30 dias (depois some da lista). */
const RECENT_DAYS = 30;

/**
 * Pacotes que representam o aluno na lista: todos os que estao em uso (com
 * saldo), ordenados pelo que vence primeiro; sem nenhum em uso, o que acabou
 * ou venceu ha pouco (para o aviso de renovar).
 */
export function displayPackages(
  packages: StudentPackageView[],
  today: string = format(new Date(), "yyyy-MM-dd"),
): StudentPackageView[] {
  const active = packages.filter((p) => p.status === "active");
  const usable = active
    .filter((p) => p.remaining > 0)
    .sort((a, b) => (a.expiresAt ?? "9999-12-31").localeCompare(b.expiresAt ?? "9999-12-31"));
  if (usable.length > 0) return usable;
  const ago = (iso: string) => differenceInCalendarDays(parseISO(today), parseISO(iso));
  const recentEnded = active
    .filter((p) => {
      if (p.isExpired && p.expiresAt) return ago(p.expiresAt) <= RECENT_DAYS;
      const last = p.usages.reduce((max, u) => (u.date > max ? u.date : max), p.purchasedAt);
      return ago(last) <= RECENT_DAYS;
    })
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))[0];
  return recentEnded ? [recentEnded] : [];
}

/**
 * Pacote principal do aluno: o em uso que vence primeiro; sem nenhum, o que
 * acabou ou venceu ha pouco.
 */
export function displayPackage(
  packages: StudentPackageView[],
  today: string = format(new Date(), "yyyy-MM-dd"),
): StudentPackageView | undefined {
  return displayPackages(packages, today)[0];
}

/** Aviso do pacote: "Vencido", "Última aula", "Vence hoje" ou "Vence em 5 dias". */
export function packageWarning(pkg: StudentPackageView): string | null {
  if (pkg.isExpired) return "Vencido";
  if (pkg.isLastLesson) return "Última aula";
  if (pkg.expiresSoon) return pkg.daysToExpire === 0 ? "Vence hoje" : `Vence em ${pkg.daysToExpire} ${pkg.daysToExpire === 1 ? "dia" : "dias"}`;
  return null;
}

/** Selo unico do pacote do aluno na lista: soma os pacotes em uso ("Restam 13 de 14") para nao poluir a linha. */
export function StudentPackageBadge({
  pkg,
  packages,
}: {
  pkg?: StudentPackageView;
  packages?: StudentPackageView[];
}) {
  const list = packages ? displayPackages(packages) : pkg ? [pkg] : [];
  const primary = list[0];
  if (!primary) return null;

  const totalLessons = list.reduce((sum, item) => sum + item.lessonsTotal, 0);
  const usedLessons = list.reduce((sum, item) => sum + item.lessonsUsed, 0);
  const left = Math.max(0, totalLessons - usedLessons);
  // "Última aula" so quando resta 1 no total; vencimento olha o pacote que vence primeiro.
  const warning =
    list.length > 1
      ? left === 1
        ? "Última aula"
        : primary.expiresSoon
          ? primary.daysToExpire === 0
            ? "Vence hoje"
            : `Vence em ${primary.daysToExpire} ${primary.daysToExpire === 1 ? "dia" : "dias"}`
          : null
      : packageWarning(primary);
  const attention = Boolean(warning) || left === 0;
  const tooltip =
    list.length > 1
      ? list
          .map((item) => `${item.name} (${Math.max(0, item.lessonsTotal - item.lessonsUsed)}/${item.lessonsTotal})`)
          .join(" · ")
      : `${primary.name}${primary.expiresAt ? ` · vale até ${format(parseISO(primary.expiresAt), "dd/MM/yyyy")}` : ""}`;

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        attention
          ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      )}
    >
      <Ticket className="size-3 shrink-0 opacity-75" />
      <span className="tabular-nums">
        {/* "Restam": "Pacote 1 de 10" parecia a 1a aula (ao lado de "9 de 10 usadas"). */}
        {primary.isExpired && list.length === 1
          ? "Pacote"
          : `${left === 1 ? "Resta" : "Restam"} ${left} de ${totalLessons}`}
      </span>
      {warning ? (
        <span className="rounded bg-background/60 px-1 text-[10px] font-semibold">{warning}</span>
      ) : null}
    </span>
  );
}
