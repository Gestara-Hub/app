import { ArrowUpRight, CheckCircle2, Wallet } from "lucide-react";
import { META_BILLING_URL, META_COST_POINTS } from "@/lib/whatsapp/meta-cost";
import { cn } from "@/lib/utils";

/**
 * Quem paga o WhatsApp automatico (doc technical/07 §1.5): bloco unico na
 * Conexao (antes e depois de conectar) e na confirmacao do plano. `showLink`
 * mostra o atalho para cadastrar o pagamento na Meta.
 */
export function MetaCostNotice({
  showLink = true,
  paymentOk,
  className,
}: {
  showLink?: boolean;
  /** Situacao na Meta sem bloqueio por pagamento: versao curta, com os detalhes recolhidos. */
  paymentOk?: boolean;
  className?: string;
}) {
  if (paymentOk) {
    return (
      <div className={cn("flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm", className)}>
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 space-y-2">
          <p className="font-semibold text-foreground">Pagamento das mensagens em dia na Meta</p>
          <p className="break-words text-muted-foreground">
            A Meta cobra cada mensagem automática no cartão da sua conta do WhatsApp. O GestaraHub não cobra por elas.
          </p>
          <details className="group">
            <summary className="cursor-pointer font-medium text-primary hover:underline">Como funciona a cobrança</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              {META_COST_POINTS.map((point) => (
                <li key={point} className="break-words">
                  {point}
                </li>
              ))}
            </ul>
          </details>
          {showLink ? (
            <a
              href={META_BILLING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Ver faturamento na Meta
              <ArrowUpRight className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm", className)}>
      <Wallet className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 space-y-2">
        <p className="font-semibold text-foreground">Quem paga as mensagens automáticas: você, direto à Meta</p>
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
          {META_COST_POINTS.map((point) => (
            <li key={point} className="break-words">
              {point}
            </li>
          ))}
        </ul>
        {showLink ? (
          <a
            href={META_BILLING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Cadastrar pagamento na Meta
            <ArrowUpRight className="size-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
