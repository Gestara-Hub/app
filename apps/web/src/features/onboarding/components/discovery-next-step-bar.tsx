"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth";
import { discoveryBarHiddenKey, setStorageFlag, useStorageFlag } from "@/lib/discovery-flags";
import { DISCOVERY_ICONS } from "../discovery-icons";
import { useDiscovery } from "../hooks/use-discovery";
import { useOnboardingSteps } from "../hooks/use-onboarding-steps";

/**
 * "Proximo passo" no topo de todas as telas, depois da configuracao inicial
 * (modelo de turmas, dono e gerente): o primeiro item pendente do "Descubra o
 * dia a dia" com "Fazer agora", para quem nao volta ao Painel. No Painel o card
 * completo ocupa o lugar. O "X" esconde so esta faixa (o card continua); o
 * "Fechar" do card esconde os dois. Some quando tudo foi feito.
 */
export function DiscoveryNextStepBar() {
  const user = useCurrentUser();
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const { isReady, isComplete, isClasses, areaBillingMode, hasProgressionTrack } = useOnboardingSteps();
  const allowed = user.profile === "owner" || user.profile === "manager";
  const active = allowed && isReady && isComplete && isClasses;
  const discovery = useDiscovery(areaBillingMode, active, hasProgressionTrack);
  const hiddenKey = discoveryBarHiddenKey(user);
  const hidden = useStorageFlag(hiddenKey);

  const isDashboard = pathname === "/" || pathname === "/dashboard";
  if (!active || isDashboard || hidden || discovery.dismissed || !discovery.isReady || discovery.allDone) {
    return null;
  }

  // Bloqueados ("Requer: matrícula") ficam para depois: mostra o que da para fazer.
  const next = discovery.items.find((item) => !item.done && !item.requires);
  if (!next) return null;

  const Icon = DISCOVERY_ICONS[next.id];
  // Ja na tela do passo, a dica basta (o link levaria ao mesmo lugar).
  const isOnStep = `${pathname}${search ? `?${search}` : ""}` === next.href;

  return (
    <aside
      aria-label="Próximo passo"
      className="mx-auto w-full max-w-7xl px-4 pt-3 pb-1 md:px-6 md:pt-4 print:hidden"
    >
      <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs sm:px-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">
            Próximo passo · {discovery.doneCount} de {discovery.total} feitos
          </p>
          <p className="mt-0.5 text-sm font-semibold break-words text-foreground">{next.title}</p>
        </div>
        {isOnStep ? (
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{next.hint}</span>
        ) : (
          <Button asChild className="shrink-0">
            <Link href={next.href}>
              Fazer agora
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setStorageFlag(hiddenKey)}
          aria-label="Esconder próximo passo"
          title="Esconder (o guia continua no Painel)"
          className="-mr-1 shrink-0 text-muted-foreground"
        >
          <X className="size-4" />
        </Button>
      </div>
    </aside>
  );
}
