import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock, FileText, MessageCircle } from "lucide-react";
import { formatCents } from "@gestarahub/core/format";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";
import { loadPaymentPage, type PaymentPageView } from "@/services/server/paymentPage";
import { CopyPixButton } from "./copy-pix-button";
import { CopyCodeButton, SaveReceiptButton } from "./paid-actions";
import { PixQrCode } from "@/components/shared/pix-qr-code";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 px-4 py-10 print:min-h-0 print:bg-white print:py-0">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Image src={logoLightImage} alt="GestaraHub" className="h-10 w-auto dark:hidden" priority />
          <Image src={logoDarkImage} alt="GestaraHub" className="hidden h-10 w-auto dark:block" priority />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg print:shadow-none">
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

  if (view.state === "paid") return <PaidBody view={view} />;

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
      {view.pixCopyPaste ? (
        <div className="flex justify-center">
          {/* Desenhado a partir do copia e cola (o banco nao guarda a imagem). */}
          <div className="size-52 rounded-lg border border-border bg-white p-3">
            <PixQrCode value={view.pixCopyPaste} />
          </div>
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

const fullDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/**
 * Cobranca paga: confirmacao e os dados do pagamento (valor, a que se refere,
 * quando e como pagou, codigo), comprovante do parceiro e contato do espaco.
 * Pagina publica: nada do aluno.
 */
function PaidBody({ view }: { view: PaymentPageView }) {
  const paid = view.paid;
  // Valor e espaco ficam no topo (uma vez so); a tabela traz o resto.
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Referente a",
      value: paid?.competenceLabel ? `${view.label} · ${paid.competenceLabel}` : view.label,
    },
    // Taxa repassada: por que o valor pago e maior que a cobranca.
    ...(paid?.breakdown
      ? [
          { label: view.label, value: formatCents(paid.breakdown.baseCents) },
          { label: "Taxa do pagamento online", value: formatCents(paid.breakdown.feeCents) },
        ]
      : []),
    ...(paid?.paidAt ? [{ label: "Pago em", value: fullDateTime(paid.paidAt) }] : []),
    ...(paid ? [{ label: "Forma de pagamento", value: paid.methodLabel }] : []),
    {
      label: "Código do pagamento",
      value: (
        <span className="inline-flex items-center gap-1">
          <span className="font-mono">{view.code}</span>
          <CopyCodeButton code={view.code} />
        </span>
      ),
    },
  ];
  const contactText = encodeURIComponent(
    `Olá! Tenho uma dúvida sobre o pagamento ${view.code} (${view.label}, ${formatCents(view.amountCents)}).`,
  );

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Pagamento confirmado</h1>
        <p className="text-3xl font-extrabold tracking-tight text-foreground">{formatCents(view.amountCents)}</p>
        <p className="text-sm text-muted-foreground">
          Obrigado! <span className="break-words">{view.organizationName}</span> já registrou o seu pagamento.
        </p>
      </div>

      <dl className="divide-y divide-border rounded-xl border border-border text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 break-words text-right font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2 print:hidden">
        <SaveReceiptButton />
        {view.contactWhatsapp ? (
          <a
            href={`https://wa.me/${view.contactWhatsapp}?text=${contactText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle className="size-4" aria-hidden />
            Dúvidas? Falar com o espaço
          </a>
        ) : null}
        {paid?.receiptUrl ? (
          <a
            href={paid.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 pt-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <FileText className="size-3.5" aria-hidden />
            Ver comprovante da instituição de pagamento
          </a>
        ) : null}
      </div>
    </div>
  );
}
