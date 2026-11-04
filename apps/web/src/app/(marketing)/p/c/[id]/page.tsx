import type { Metadata } from "next";
import { PublicLegalFooter } from "@/components/shared/public-legal-footer";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AlertCircle, Clock } from "lucide-react";
import logoLightImage from "@/assets/logo-light.svg";
import logoDarkImage from "@/assets/logo-dark.svg";
import { loadChargeInvoice } from "@/services/server/paymentPage";
import { ChargeInvoiceCheckout } from "./charge-invoice-checkout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fatura de Pagamento | GestaraHub",
  robots: { index: false, follow: false },
};

export default async function ChargeInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await loadChargeInvoice(id);

  if (!invoice) notFound();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 px-4 py-10 print:min-h-0 print:bg-white print:py-0">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Image
            src={logoLightImage}
            alt="GestaraHub"
            className="h-6 w-auto dark:hidden"
            priority
          />
          <Image
            src={logoDarkImage}
            alt="GestaraHub"
            className="hidden h-6 w-auto dark:block"
            priority
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg print:shadow-none">
          {invoice.state === "unavailable" ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                <AlertCircle className="size-6" />
              </div>
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-foreground">
                  Pagamento online indisponível
                </h1>
                <p className="text-xs text-muted-foreground">
                  O espaço <strong className="text-foreground">{invoice.organizationName}</strong> ainda não ativou recebimentos online. Entre em contato direto com a recepção para combinar o pagamento.
                </p>
              </div>
            </div>
          ) : invoice.state === "canceled" ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Clock className="size-6" />
              </div>
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-foreground">
                  Cobrança cancelada
                </h1>
                <p className="text-xs text-muted-foreground">
                  Esta cobrança foi cancelada ou substituída por <strong className="text-foreground">{invoice.organizationName}</strong>.
                </p>
              </div>
            </div>
          ) : (
            <ChargeInvoiceCheckout invoice={invoice} />
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Pagamento seguro processado pela plataforma GestaraHub, com a Asaas Gestão Financeira IP S.A. como instituição de pagamento.
        </p>
        <PublicLegalFooter />
      </div>
    </div>
  );
}
