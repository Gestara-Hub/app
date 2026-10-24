"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserPreferences } from "@/features/preferences";
import { getTwoFactorStatusAction } from "@/app/(auth)/two-factor-actions";
import { useCurrentUser, useModel } from "../session-provider";
import {
  canAskSecurity,
  onSecurityPromptRequest,
  takePendingSecurityPrompt,
  usedLongEnough,
  type SecurityPromptReason,
} from "../security-prompt";
import { TwoFactorDialog } from "./two-factor-dialog";
import { dateInSpace } from "@gestarahub/core/date";

const COPY: Record<SecurityPromptReason, string> = {
  online_payments: "Sua conta agora recebe pagamentos. Proteja o acesso.",
  first_invite: "Mais pessoas acessam os dados dos alunos. Proteja sua conta.",
  password_reset: "Senha nova criada. Que tal uma proteção a mais?",
  seven_days: "Proteja sua conta com uma etapa a mais no login.",
};

/** Ja perguntou nesta aba (o aviso dos 7 dias sai uma vez por acesso). */
const ASKED_KEY = "gestarahub:security-prompt:asked";

function askedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

function markAsked(): void {
  try {
    window.sessionStorage.setItem(ASKED_KEY, "1");
  } catch {
    // Sem armazenamento: pode perguntar de novo na proxima tela.
  }
}

/**
 * Aviso da verificacao em duas etapas (doc product/25, secao 5): pagamento
 * online ativado, primeiro convite, senha nova e 7 dias de uso. Só dono e
 * gerente do modelo de turmas; nunca na configuracao inicial, nunca para conta só do Google nem
 * para quem ja ligou. "Agora não" volta em 30 dias, no maximo 3 vezes.
 */
export function SecurityPromptHost() {
  const user = useCurrentUser();
  const pathname = usePathname();
  const { preferences, updatePreferences, remoteLoaded } = useUserPreferences();
  const [reason, setReason] = useState<SecurityPromptReason | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const checking = useRef(false);
  const today = dateInSpace();
  const state = preferences.securityPrompt;
  // So conta de verdade (modelo de turmas no banco): a barbearia segue no modo demonstracao, sem login real.
  const model = useModel();
  const eligibleProfile = model === "classes" && (user.profile === "owner" || user.profile === "manager");
  const inSetup = pathname?.startsWith("/setup") ?? false;

  // Primeiro dia no app (conta os 7 dias). So depois das preferencias do
  // servidor: antes, "sem data" seria so a copia local ainda vazia.
  useEffect(() => {
    if (remoteLoaded && eligibleProfile && !state?.firstSeenAt) {
      updatePreferences({ securityPrompt: { ...state, firstSeenAt: today } });
    }
  }, [remoteLoaded, eligibleProfile, state, today, updatePreferences]);

  async function ask(next: SecurityPromptReason) {
    if (!eligibleProfile || inSetup || reason || checking.current || !canAskSecurity(state, today)) return;
    checking.current = true;
    try {
      const status = await getTwoFactorStatusAction();
      if (!status.ok || status.googleOnly || status.demo || status.enabled) return;
      markAsked();
      setReason(next);
    } finally {
      checking.current = false;
    }
  }

  // Pedidos das acoes (pagamento online, convite) e o que ficou para este acesso.
  useEffect(() => onSecurityPromptRequest((next) => void ask(next)));
  useEffect(() => {
    if (!remoteLoaded || !eligibleProfile || inSetup) return;
    const pending = takePendingSecurityPrompt();
    if (pending) void ask(pending);
    else if (usedLongEnough(state, today) && !askedThisSession()) void ask("seven_days");
    // So ao entrar (depois das preferencias do servidor) e ao sair da configuracao inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteLoaded, eligibleProfile, inSetup]);

  function dismiss() {
    updatePreferences({
      securityPrompt: { ...state, dismissCount: (state?.dismissCount ?? 0) + 1, lastDismissedAt: today },
    });
    setReason(null);
  }

  return (
    <>
      <Dialog open={reason !== null} onOpenChange={(open) => (!open ? dismiss() : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="size-5" />
            </span>
            <DialogTitle>Ative a verificação em duas etapas</DialogTitle>
            <DialogDescription>{reason ? COPY[reason] : ""}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Depois da senha, o login pede um código do celular ou do e-mail. Senha vazada sozinha não entra.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={dismiss}>
              Agora não
            </Button>
            <Button
              type="button"
              onClick={() => {
                setReason(null);
                setEnrolling(true);
              }}
            >
              Ativar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TwoFactorDialog open={enrolling} onOpenChange={setEnrolling} />
    </>
  );
}
