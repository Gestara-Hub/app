import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Download, Send } from "lucide-react";
import logoLightImage from "@/assets/logo-light.svg";
import logoDarkImage from "@/assets/logo-dark.svg";
import { Button } from "@/components/ui/button";
import { PublicLegalFooter } from "@/components/shared/public-legal-footer";
import { cn } from "@/lib/utils";
import { whatsappShareLink } from "@/lib/whatsapp";
import { loadTicketPage } from "@/services/server/eventTickets";
import { StaffCheckIn } from "./staff-check-in";
import { TicketCard } from "./ticket-card";
import { TicketStatus } from "./ticket-status";

/**
 * Ingresso do evento (doc product/29 T1 a T7): publico, dados mascarados,
 * nenhuma gravacao sem login. A equipe logada ve o resultado e confirma a entrada.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ingresso | GestaraHub",
  robots: { index: false, follow: false },
};

function appUrl(path: string): string {
  return `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "")}${path}`;
}

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  /** `nova=1`: acabou de se inscrever (vem da pagina do evento); `email=1`: o link foi para o e-mail. */
  searchParams: Promise<{ nova?: string; email?: string }>;
}) {
  const { code } = await params;
  const query = await searchParams;
  const data = await loadTicketPage(code);
  if (!data) notFound();
  const { ticket, staff } = data;
  const url = appUrl(`/p/i/${ticket.code}`);
  const valid = ticket.state === "confirmed" || ticket.state === "payment_pending";

  return (
    // Fundo solido: e a cor dos recortes do picote no cartao.
    <div className="flex min-h-screen flex-col items-center bg-muted px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        <div className="flex justify-center">
          <Image src={logoLightImage} alt="GestaraHub" className="h-9 w-auto dark:hidden" priority />
          <Image src={logoDarkImage} alt="GestaraHub" className="hidden h-9 w-auto dark:block" priority />
        </div>

        {staff ? (
          staff.sessionId ? (
            <StaffCheckIn sessionId={staff.sessionId} code={ticket.code} />
          ) : (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Nenhum dia desta inscrição é hoje.
            </p>
          )
        ) : null}

        {!staff ? <TicketStatus ticket={ticket} isNew={query.nova === "1"} emailSent={query.email === "1"} /> : null}

        <TicketCard ticket={ticket} url={url} />

        {(valid || ticket.state === "reserved") && !ticket.reservationExpired && !staff ? (
          <div className={cn("grid grid-cols-1 gap-2", valid && "sm:grid-cols-2")}>
            {valid ? (
              <Button asChild variant={ticket.payChargeId ? "outline" : "default"}>
                <a href={`/p/i/${ticket.code}/image`} download={`ingresso-${ticket.code}.png`}>
                  <Download className="size-4" />
                  Salvar ingresso
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <a href={whatsappShareLink(`Meu ingresso para ${ticket.eventName}: ${url}`)} target="_blank" rel="noopener noreferrer">
                <Send className="size-4" />
                Enviar no WhatsApp
              </a>
            </Button>
          </div>
        ) : null}

        <PublicLegalFooter />
      </div>
    </div>
  );
}
