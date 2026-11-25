"use client";

import { useSyncExternalStore } from "react";
import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestSecurityPrompt } from "@/features/auth";

/** Conta nova no Asaas: nao da para usar uma conta que a pessoa ja tenha la (19/11/2026). */
export const NEW_ASAAS_ACCOUNT_NOTICE =
  "O GestaraHub abre uma conta nova no Asaas, só para os recebimentos do espaço. Uma conta que você já tenha no Asaas não serve aqui.";

/** Dica do e-mail financeiro: e-mail com conta no Asaas pode ser recusado. */
export const FINANCE_EMAIL_HINT = "Use um e-mail que ainda não tenha conta no Asaas.";

const STEPS: { title: string; text: string }[] = [
  { title: "Abra o e-mail do Asaas", text: "\"Bem-vindo ao Asaas\", no e-mail financeiro. Veja também o spam." },
  // O link do e-mail vale 10 minutos (e-mail do Asaas, 25/11/2026).
  { title: "Crie sua senha", text: "Em \"Definir senha de acesso\". O link vale 10 minutos; depois, use \"Esqueci minha senha\" no Asaas." },
  { title: "Entre no site ou no app", text: "Em asaas.com ou no app Asaas, com o e-mail financeiro." },
  { title: "Envie os documentos", text: "O Asaas pede para aprovar a conta e liberar os saques." },
];

interface AsaasAccessGuideProps {
  /** E-mail financeiro informado na ativacao (logo depois de ativar). */
  email?: string;
  /** Aviso de conta nova (fora logo depois de ativar: a pessoa acabou de ler). */
  showNotice?: boolean;
  className?: string;
}

/**
 * Como entrar na conta de recebimento no Asaas (doc ajuda/recebimentos-online):
 * logo depois de ativar e, para consultar depois, na aba Configuracoes.
 */
export function AsaasAccessGuide({ email, showNotice = true, className }: AsaasAccessGuideProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {email ? (
        <p className="flex items-start gap-2 text-sm text-foreground">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0 break-words">
            Acesso no Asaas pelo e-mail <strong>{email}</strong>.
          </span>
        </p>
      ) : null}
      <ol className="space-y-2.5">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {showNotice ? <p className="text-xs text-muted-foreground">{NEW_ASAAS_ACCOUNT_NOTICE}</p> : null}
    </div>
  );
}

// Conta recem-criada: a gaveta de ativacao fecha (e a tela troca de estado), entao
// o aviso mora na tela de Recebimentos online e recebe o e-mail por aqui.
let activatedEmail: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Chamado logo depois de ativar: abre os passos de acesso ao Asaas. */
export function announceAsaasAccess(email: string) {
  activatedEmail = email;
  notify();
}

/** Passos de acesso ao Asaas logo depois de ativar a conta de recebimento. */
export function AsaasAccessAfterActivation() {
  const email = useSyncExternalStore(subscribe, () => activatedEmail, () => null);

  function close() {
    activatedEmail = null;
    notify();
    // A conta passa a receber dinheiro: momento de proteger o acesso (doc product/25).
    requestSecurityPrompt("online_payments");
  }

  return (
    <Dialog open={Boolean(email)} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-14 text-left">
          <DialogTitle>Conta criada. Agora, o acesso ao Asaas</DialogTitle>
          <DialogDescription>Faça isto para aprovar a conta e sacar.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <AsaasAccessGuide email={email ?? undefined} showNotice={false} />
          <p className="mt-3 text-xs text-muted-foreground">
            Estes passos ficam em Recebimentos online, na aba Configurações.
          </p>
        </DialogBody>
        <DialogFooter className="shrink-0 border-t border-border/40 px-6 py-4">
          <Button type="button" onClick={close}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
