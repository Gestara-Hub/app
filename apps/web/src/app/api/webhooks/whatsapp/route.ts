import { NextResponse } from "next/server";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp";
import { handleWhatsAppWebhookPayload } from "@/services/communication/whatsappWebhook";
import { logError, logWarn, reportError } from "@/lib/log";

/**
 * Webhook oficial da Meta WhatsApp Cloud API.
 * - GET: validação de desafio (challenge) da Meta para confirmar o webhook.
 * - POST: recebimento de confirmações de entrega, leitura e falha de mensagens em tempo real.
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

  if (!verifyToken) {
    logWarn("[WhatsApp Webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurada no ambiente.");
    return NextResponse.json({ error: "Webhook verify token not configured." }, { status: 503 });
  }

  // A Meta envia hub.mode='subscribe' e hub.verify_token
  if (mode === "subscribe" && token === verifyToken) {
    // A resposta precisa ser exatamente o valor de hub.challenge em texto puro
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  logWarn("[WhatsApp Webhook] Tentativa de verificação com token inválido:", { mode, token });
  return NextResponse.json({ error: "Forbidden: Invalid verify token" }, { status: 403 });
}

export async function POST(req: Request) {
  let payload: WhatsAppWebhookPayload;

  try {
    payload = (await req.json()) as WhatsAppWebhookPayload;
  } catch (err) {
    logError("[WhatsApp Webhook] Erro ao ler JSON do payload:", err);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ error: "Invalid object type" }, { status: 400 });
  }

  try {
    const result = await handleWhatsAppWebhookPayload(payload);
    return NextResponse.json({
      success: true,
      statusesProcessed: result.statusesProcessed,
      messagesReceived: result.messagesReceived,
    });
  } catch (error) {
    const reference = await reportError("webhook.whatsapp", error, {
      source: "webhook",
      context: { object: payload.object },
    });
    // Respondemos 200 mesmo em erro não crítico para evitar retenção desnecessária pela Meta
    return NextResponse.json({ success: false, errorReference: reference }, { status: 200 });
  }
}
