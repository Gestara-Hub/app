"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAnalyticsConfigured, setAnalyticsConsent } from "@/lib/analytics";
import { useAnalyticsConsent } from "@/lib/analytics-consent";

/**
 * Aviso de cookies de analise de uso (LGPD), no padrao de mercado: cartao em
 * destaque na base da tela ate a pessoa escolher (a barra fina passava
 * despercebida). Aparece em todas as paginas, so quando o PostHog esta
 * configurado. Recusar tem o mesmo tamanho de aceitar. Fica abaixo dos modais (z-40).
 */
export function AnalyticsConsentBanner() {
  const consent = useAnalyticsConsent();
  if (!isAnalyticsConfigured || consent !== "unset") return null;

  // Cartao flutuante em destaque (como nos sites grandes), sem bloquear a pagina.
  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6 print:hidden"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-2xl ring-1 ring-black/5 sm:p-6 md:flex-row md:items-center md:gap-8 dark:ring-white/10">
        <div className="flex flex-1 items-start gap-4">
          <span className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
            <Cookie className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-foreground sm:text-lg">
              Usamos cookies para melhorar sua experiência
            </p>
            <p className="text-sm text-muted-foreground sm:text-base">
              Eles mostram como o site é usado. Nada do que você digita é gravado.{" "}
              <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
                Política de privacidade
              </Link>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-3">
          <Button variant="outline" className="flex-1 px-8 md:flex-none" onClick={() => setAnalyticsConsent("denied")}>
            Recusar
          </Button>
          <Button className="flex-1 px-8 md:flex-none" onClick={() => setAnalyticsConsent("granted")}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
