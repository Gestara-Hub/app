"use server";

import { apiError, forbiddenError, validationError } from "@gestarahub/core/api-error";
import { runAction, type ActionResult } from "../server/action";
import { requireTenant } from "../server/tenant";
import { whatsappClient, WhatsAppApiError } from "./whatsappClient";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

    const { data: conn } = await createSupabaseAdminClient()
      .from("whatsapp_connections")
      .select("phone_number")
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    const digitsTo = cleanTo.replace(/\D/g, "");
    const digitsSender = String(conn?.phone_number ?? "").replace(/\D/g, "");
    if (digitsSender && (digitsTo === digitsSender || (digitsSender.length >= 8 && digitsTo.endsWith(digitsSender.slice(-8))))) {
      throw validationError([
        {
          field: "to",
          message:
            "O número de destino não pode ser o mesmo número do espaço conectado. Digite o número do seu celular pessoal ou de outro aparelho para receber o teste.",
        },
      ]);
    }

    try {
      if (payload.type === "template") {
        // Modelo aprovado da propria conta (01/11/2026): "hello_world" so existe
        // na conta de sandbox da Meta; numa conta real a Meta recusa com 132001.
        // Prefere as boas-vindas (2 parametros: nome e espaco); cai no hello_world
        // quando a conta e a de sandbox.
        const approved = (await whatsappClient.listTemplates()).filter((t) => t.status === "APPROVED");
        const welcome = approved.find((t) => t.name === "welcome_student");
        const hello = approved.find((t) => t.name === "hello_world");
        if (welcome) {
          const { data: org } = await createSupabaseAdminClient()
            .from("organizations")
            .select("name")
            .eq("id", ctx.organizationId)
            .maybeSingle();
          const res = await whatsappClient.sendTemplateMessage(cleanTo, "welcome_student", {
            languageCode: "pt_BR",
            bodyParameters: ["você", String(org?.name ?? "GestaraHub")],
          });
          return {
            success: true,
            messageId: res.messages?.[0]?.id,
            details: "Modelo aprovado 'welcome_student' enviado pela Meta Cloud API.",
          };
        }
        if (hello) {
          const res = await whatsappClient.sendTemplateMessage(cleanTo, "hello_world", { languageCode: "en_US" });
          return {
            success: true,
            messageId: res.messages?.[0]?.id,
            details: "Modelo 'hello_world' enviado pela Meta Cloud API.",
          };
        }
        throw apiError("CONFLICT", "A conta da Meta não tem um modelo aprovado para o teste (boas-vindas ou hello_world).", {
          httpStatus: 409,
        });
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
        if (err.code === 100) {
          throw metaError(
            "A Meta recusou o envio (parâmetro inválido). Certifique-se de que o número de destino possui DDD, é uma conta de WhatsApp ativa e não é o mesmo número do espaço conectado.",
          );
        }
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
