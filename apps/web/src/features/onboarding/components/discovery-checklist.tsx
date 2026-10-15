"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Layers,
  Lock,
  MessageCircle,
  ReceiptText,
  TrendingUp,
  UserPlus,
  Wallet,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ClassBillingMode } from "@gestarahub/contracts";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth";
import { cn } from "@/lib/utils";
import type { DiscoveryItemId } from "../discovery-items";
import { useDiscovery } from "../hooks/use-discovery";

const ICONS: Record<DiscoveryItemId, LucideIcon> = {
  enroll: UserPlus,
  attendance: CalendarCheck,
  membership_payment: Wallet,
  course_installments: ReceiptText,
  package_sale: Layers,
  message: MessageCircle,
  progress: TrendingUp,
  finance: WalletCards,
};

/**
 * "Descubra o dia a dia": depois da configuracao inicial, no lugar dos
 * Primeiros passos (Dashboard, turmas). Opcional: "Fechar" esconde de vez
 * (por organizacao e usuario) e some sozinho quando tudo foi feito.
 * Proprietario e gerente; cada item exige a permissao da acao.
 */
export function DiscoveryChecklist({ areaBillingMode }: { areaBillingMode: ClassBillingMode }) {
  const user = useCurrentUser();
  const allowed = user.profile === "owner" || user.profile === "manager";
  const { items, doneCount, total, allDone, isReady, dismissed, dismiss } = useDiscovery(
    areaBillingMode,
    allowed,
  );

  if (!allowed || dismissed || !isReady || total === 0 || allDone) return null;

  const pct = Math.round((doneCount / total) * 100);

  return (
    <section
      data-tour="discovery-checklist"
      aria-labelledby="discovery-title"
      className="mb-8 w-full rounded-xl border bg-card p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="discovery-title" className="text-base font-bold tracking-tight text-foreground">
            Descubra o dia a dia
          </h2>
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
            {doneCount} de {total} feitos
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismiss}
          className="-mr-2 -mt-1 h-8 shrink-0 gap-1.5 text-xs text-muted-foreground"
        >
          <X className="size-3.5" />
          Fechar
        </Button>
      </div>

      <div
        role="progressbar"
        aria-label="Progresso do dia a dia"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={doneCount}
        className="mt-3 h-1 overflow-hidden rounded-full bg-primary/10"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = ICONS[item.id];
          const locked = !item.done && Boolean(item.requires);
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                item.done
                  ? "border-border/60 bg-muted/20"
                  : locked
                    ? "border-border/50 bg-muted/10 opacity-60"
                    : "border-border/80 bg-card",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  item.done
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {item.done ? <Check className="size-4 stroke-[3]" /> : <Icon className="size-4" />}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    item.done ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {locked ? (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      Requer: {item.requires}
                    </span>
                  ) : (
                    item.hint
                  )}
                </p>
              </div>

              <div className="shrink-0">
                {item.done ? (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Feito
                  </span>
                ) : locked ? (
                  <Lock className="size-4 text-muted-foreground/60" aria-label="Bloqueado" />
                ) : (
                  <Link
                    href={item.href}
                    aria-label={`Fazer agora: ${item.title}`}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    Fazer agora
                    <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
