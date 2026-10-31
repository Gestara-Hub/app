"use server";

import { apiError, forbiddenError, validationError } from "@gestarahub/core/api-error";
import { runAction, type ActionResult } from "../server/action";
import { requireTenant } from "../server/tenant";
import { whatsappClient, WhatsAppApiError } from "./whatsappClient";

export interface SendTestWhatsAppMessagePayload {
  to: string;
  type: "template" | "text";
  messageText?: string;
}

export interface SendTestWhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  details: string;
}

/** Ferramenta de desenvolvimento: fora de producao (o build de producao tambem esconde o botao). */
const whatsappTestToolEnabled = () => process.env.NODE_ENV !== "production";

/**
 * Mensagem de teste real pela API oficial da Meta, com as credenciais do
 * ambiente (o numero da plataforma). So fora de producao e so para quem
 * gerencia a comunicacao do espaco: sem isso, qualquer pessoa mandaria
 * mensagem pelo numero da plataforma.
 */
export async function sendTestWhatsAppMessageAction(
  payload: SendTestWhatsAppMessagePayload,
): Promise<ActionResult<SendTestWhatsAppMessageResult>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    ctx.require("communication:manage");
    if (!whatsappTestToolEnabled()) throw forbiddenError("O envio de teste só funciona no ambiente de testes.");
    if (!whatsappClient.isConfigured()) {
      throw apiError(
        "SERVICE_UNAVAILABLE",
        "Credenciais da Meta não encontradas no ambiente (WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no .env.local).",
        { httpStatus: 503 },
      );
    }

    const cleanTo = String(payload?.to ?? "").trim();
    if (!cleanTo) {
      throw validationError([{ field: "to", message: "Informe o número de telefone de destino com DDD." }]);
    }

    try {
      if (payload.type === "template") {
        // O template 'hello_world' vem pré-aprovado por padrão em todas as contas de teste da Meta
        const res = await whatsappClient.sendTemplateMessage(cleanTo, "hello_world", {
          languageCode: "en_US",
        });
        return {
          success: true,
          messageId: res.messages?.[0]?.id,
          details: "Modelo 'hello_world' enviado com sucesso pela Meta Cloud API!",
        };
      }

      const text =
        payload.messageText?.trim() ||
        "Olá! Esta é uma mensagem de teste enviada pelo GestaraHub via Meta WhatsApp Cloud API.";

      const res = await whatsappClient.sendTextMessage(cleanTo, text);
      return {
        success: true,
        messageId: res.messages?.[0]?.id,
        details: "Mensagem de texto enviada com sucesso pela Meta Cloud API!",
      };
    } catch (err: unknown) {
      // ApiError: a mensagem chega a tela (erro comum vira "erro inesperado" com codigo).
      const metaError = (message: string) => apiError("CONFLICT", message, { httpStatus: 409 });
      if (err instanceof WhatsAppApiError) {
        if (err.code === 131047) {
          throw metaError(
            "A Meta bloqueou o texto livre porque a janela de 24 horas não está aberta com esse número. Use a opção 'Modelo oficial (hello_world)' para enviar a qualquer momento.",
          );
        }
        if (err.code === 131030) {
          throw metaError(
            "Esse número não está na lista de destinatários de teste da Meta. No Meta for Developers, vá em WhatsApp > API Setup > Para (To) e adicione seu número.",
          );
        }
        if (err.code === 190) {
          throw metaError(
            "O token temporário da Meta expirou. Gere um novo token em WhatsApp > API Setup e atualize o WHATSAPP_API_TOKEN no .env.local.",
          );
        }
        throw metaError(`A Meta recusou o envio (código ${err.code}): ${err.message}`);
      }
      throw err;
    }
  }, "communication:test-whatsapp");
}
