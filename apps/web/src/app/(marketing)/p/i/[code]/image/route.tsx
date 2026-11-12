import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { loadTicketPage } from "@/services/server/eventTickets";

/**
 * Ingresso em imagem para guardar no celular (doc product/29 T7 e T8): abre
 * sem internet depois de salvo. Mesmos dados mascarados da pagina.
 */
export const dynamic = "force-dynamic";

function codeLabel(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadTicketPage(code);
  if (!data || (data.ticket.state !== "confirmed" && data.ticket.state !== "payment_pending")) {
    return new Response("Ingresso não encontrado.", { status: 404 });
  }
  const { ticket } = data;
  const url = `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "")}/p/i/${ticket.code}`;
  const qr = await QRCode.toDataURL(url, { width: 520, margin: 1, errorCorrectionLevel: "M" });
  const days = ticket.days.map((d) => {
    const day = format(parseISO(d.date), "EEE, dd/MM", { locale: ptBR });
    return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${d.start} às ${d.end}`;
  });

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#ffffff", padding: 56, color: "#111827" }}>
        <div style={{ fontSize: 26, color: "#6b7280" }}>{ticket.organizationName}</div>
        <div style={{ fontSize: 46, fontWeight: 700, marginTop: 8 }}>{ticket.eventName}</div>
        <div style={{ fontSize: 30, marginTop: 16 }}>{ticket.holderName}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 20, fontSize: 26, color: "#374151" }}>
          {days.map((line) => (
            <div key={line}>{line}</div>
          ))}
          {ticket.address ? <div style={{ marginTop: 6, color: "#6b7280" }}>{ticket.address}</div> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={420} height={420} alt="" />
          <div style={{ fontSize: 34, letterSpacing: 4, marginTop: 14, fontFamily: "monospace" }}>{codeLabel(ticket.code)}</div>
          <div style={{ fontSize: 22, color: "#6b7280", marginTop: 6 }}>
            {ticket.state === "payment_pending" ? "Pagamento pendente · mostre na entrada" : "Mostre na entrada"}
          </div>
        </div>
      </div>
    ),
    { width: 800, height: 1200, headers: { "Cache-Control": "private, no-store" } },
  );
}
