"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAnalyticsConfigured, setAnalyticsConsent } from "@/lib/analytics";
import { useAnalyticsConsent } from "@/lib/analytics-consent";

/**
 * Aviso de cookies de analise de uso (LGPD), no padrao de mercado: barra fixa
 * na base da tela, largura toda, ate a pessoa escolher. Aparece em todas as
 * paginas, so quando o PostHog esta configurado. Recusar tem o mesmo tamanho
 * de aceitar. Fica abaixo dos modais (z-40).
 */
export function AnalyticsConsentBanner() {
  const consent = useAnalyticsConsent();
  if (!isAnalyticsConfigured || consent !== "unset") return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] print:hidden"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 md:flex-row md:items-center md:gap-8 lg:px-8">
        <div className="flex flex-1 items-start gap-3">
          <Cookie className="mt-0.5 hidden size-5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground sm:text-base">
              Usamos cookies para melhorar sua experiência
            </p>
            <p className="text-sm text-muted-foreground">
              Eles mostram como o site é usado. Nada do que você digita é gravado.{" "}
              <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
                Política de privacidade
              </Link>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" className="flex-1 px-6 md:flex-none" onClick={() => setAnalyticsConsent("denied")}>
            Recusar
          </Button>
          <Button className="flex-1 px-6 md:flex-none" onClick={() => setAnalyticsConsent("granted")}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
