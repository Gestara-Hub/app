import type { ReactNode } from "react";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Destino padrao do botao: aba "Plano GestaraHub" das Configuracoes. */
export const PLAN_SETTINGS_HREF = "/settings?tab=plano";

/**
 * Tela de upsell de um recurso pago ("Disponível no Plano Pro"). Renderizada
 * pela page server quando o perfil tem a permissao mas o tier do tenant nao tem
 * o recurso (ver docs/technical/05, secao 3.4). Sem imports de features: o
 * conteudo (titulo, beneficios) vem por props.
 *
 * `canManagePlan=false` (ex.: gerente, que nao abre Configuracoes) troca o
 * botao por um aviso para falar com o proprietario.
 */
export function FeatureLocked({
  title,
  description,
  benefits,
  icon,
  canManagePlan = true,
  href = PLAN_SETTINGS_HREF,
  actionLabel = "Ver Plano Pro",
}: {
  /** Nome do recurso, ex.: "Financeiro". */
  title: string;
  description?: string;
  /** Beneficios curtos (uma linha cada). */
  benefits?: readonly string[];
  icon?: ReactNode;
  canManagePlan?: boolean;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <Card className="mx-auto w-full max-w-xl border-dashed">
      <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
        <div className="relative flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon ?? <Lock className="size-7" aria-hidden />}
          {icon ? (
            <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
            </span>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">
            Disponível no Plano Pro
          </p>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {benefits && benefits.length > 0 ? (
          <ul className="w-full max-w-sm space-y-2 text-left">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {canManagePlan ? (
          <Button asChild>
            <Link href={href}>{actionLabel}</Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Fale com o proprietário da conta para ativar o Plano Pro.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
