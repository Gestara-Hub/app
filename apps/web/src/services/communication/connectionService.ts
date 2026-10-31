import type { UpdateConnectionSettingsPayload, WhatsAppConnectionView } from "@gestarahub/contracts";
import { whatsappNumber } from "@/lib/whatsapp";
import { apiError, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { logWarn } from "@/lib/log";
import { auditLogService } from "../audit/auditLogService";
import { assertFeature } from "../subscription/subscriptionService";
import { ensureConnection, connectionView, officialSendingAvailable } from "./communicationRules";
import { whatsappClient } from "./whatsappClient";

/** Conexao do WhatsApp: status, ligar e desligar a API oficial e ajustes. */
export const connectionService = {
  getConnection(): Promise<WhatsAppConnectionView> {
    return readOp(async () => {
      return connectionView();
    });
  },
  /**
   * Conecta o numero do espaco a API oficial (Pro).
   * Se chamado via Meta Embedded Signup com phoneNumberId, consulta e valida
   * o número oficial na Meta.
   */
  connectOfficial(input?: { code?: string; phoneNumberId?: string; wabaId?: string }): Promise<WhatsAppConnectionView> {
    return writeOp(async () => {
      assertFeature("messaging");
      if (!officialSendingAvailable()) {
        throw apiError(
          "SERVICE_UNAVAILABLE",
          "O envio automático pelo número do seu espaço chega em breve. Até lá, use o envio assistido.",
          { httpStatus: 409 },
        );
      }
      const connection = ensureConnection();

      let displayName = store.organization.name;
      // Numero confirmado pela Meta no cadastro guiado (Embedded Signup).
      let phoneFromMeta: string | null = null;
      if (input?.phoneNumberId && whatsappClient.isConfigured()) {
        try {
          const details = await whatsappClient.getPhoneNumberDetails(input.phoneNumberId);
          phoneFromMeta = whatsappNumber(details?.displayPhoneNumber);
          if (details?.verifiedName) displayName = details.verifiedName;
        } catch (err) {
          logWarn("[connectionService] Falha ao obter detalhes do número na Meta:", err);
        }
      }

      // Sem numero de verdade, nao conecta: nunca o id do numero na Meta nem um numero inventado.
      const phone = phoneFromMeta ?? whatsappNumber(store.unit.phone);
      if (!phone) {
        throw validationError([
          {
            field: "phoneNumber",
            message: input?.phoneNumberId
              ? "Não foi possível confirmar o número na Meta. Tente de novo ou cadastre o telefone do espaço em Configurações."
              : "Cadastre o telefone do espaço em Configurações antes de conectar.",
          },
        ]);
      }

      // Unidade sem telefone: guarda o numero confirmado pela Meta (E.164).
      if (!store.unit.phone && phoneFromMeta) {
        store.unit.phone = `+${phoneFromMeta}`;
      }

      connection.officialStatus = "connected";
      connection.phoneNumber = phone;
      connection.displayName = displayName;
      connection.connectedAt = nowIso();

      auditLogService.record({
        action: "updated",
        target: { type: "communication_session", label: "WhatsApp oficial" },
        predicate: input?.phoneNumberId
          ? `conectou o WhatsApp oficial do espaço pelo cadastro guiado da Meta (${phone})`
          : "conectou o WhatsApp oficial do espaço",
      });
      return connectionView();
    });
  },
  disconnectOfficial(): Promise<WhatsAppConnectionView> {
    return writeOp(async () => {
      assertFeature("messaging");
      const connection = ensureConnection();
      connection.officialStatus = "not_connected";
      delete connection.phoneNumber;
      delete connection.displayName;
      delete connection.connectedAt;

      auditLogService.record({
        action: "updated",
        target: { type: "communication_session", label: "WhatsApp oficial" },
        predicate: "desconectou o WhatsApp oficial do espaço",
      });
      return connectionView();
    });
  },
  updateConnectionSettings(payload: UpdateConnectionSettingsPayload): Promise<WhatsAppConnectionView> {
    return writeOp(async () => {
      assertFeature("messaging");
      const connection = ensureConnection();
      if (payload.allowedSendHours) {
        const { start, end } = payload.allowedSendHours;
        if (!start || !end || start >= end) {
          throw validationError([{ field: "allowedSendHours", message: "O início precisa ser antes do fim." }]);
        }
        connection.allowedSendHours = { start, end };
      }

      return connectionView();
    });
  },
};
