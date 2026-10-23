import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { formatCents } from "@gestarahub/core/format";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";
import { loadPaymentPage, type PaymentPageView } from "@/services/server/paymentPage";
import { CopyPixButton } from "./copy-pix-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento | GestaraHub",
  // Pagina de uma cobranca: fora dos buscadores.
  robots: { index: false, follow: false },
};

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/**
 * Pagina publica da cobranca online (/p/<codigo>): Pix com QR e copia e cola,
 * ida a fatura do cartao enquanto vale, ou o aviso de vencida ou ja paga.
 */
export default async function PaymentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const view = await loadPaymentPage(code);
  if (!view) notFound();
  // Cartao (fatura do parceiro): enquanto vale, segue direto para pagar.
  if (view.state === "open" && view.method !== "pix" && view.linkUrl) redirect(view.linkUrl);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Image src={logoLightImage} alt="GestaraHub" className="h-10 w-auto dark:hidden" priority />
          <Image src={logoDarkImage} alt="GestaraHub" className="hidden h-10 w-auto dark:block" priority />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <PaymentBody view={view} />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Pagamento processado por um parceiro de pagamentos regulado.
        </p>
      </div>
    </div>
  );
}

function PaymentBody({ view }: { view: PaymentPageView }) {
  const header = (
    <div className="space-y-1 text-center">
      <p className="text-sm text-muted-foreground">{view.organizationName}</p>
      <h1 className="break-words text-lg font-semibold text-foreground">{view.label}</h1>
      <p className="text-3xl font-extrabold tracking-tight text-foreground">{formatCents(view.amountCents)}</p>
    </div>
  );

  if (view.state === "paid") {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-foreground">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p>Esta cobrança já está paga. Obrigado!</p>
        </div>
      </div>
    );
  }

  if (view.state === "expired" || view.method !== "pix" || !view.pixCopyPaste) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
          <Clock className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p>
            Este link venceu. Peça um novo para <strong className="font-semibold">{view.organizationName}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      {view.pixQrCodeBase64 ? (
        <div className="flex justify-center">
          {/* QR do Pix gerado pelo parceiro (imagem em base64). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${view.pixQrCodeBase64}`}
            alt="QR Code do Pix"
            className="size-52 rounded-lg border border-border bg-white p-2"
          />
        </div>
      ) : null}
      <p className="text-center text-sm text-muted-foreground">
        Abra o app do seu banco, escolha Pix e leia o QR Code ou cole o código.
      </p>
      <p className="break-all rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
        {view.pixCopyPaste}
      </p>
      <CopyPixButton code={view.pixCopyPaste} />
      <p className="text-center text-xs text-muted-foreground">Válido até {dateTime(view.expiresAt)}.</p>
    </div>
  );
}
