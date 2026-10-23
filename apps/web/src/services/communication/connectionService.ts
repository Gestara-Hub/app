import type { UpdateConnectionSettingsPayload, WhatsAppConnectionView } from "@gestarahub/contracts";
import { whatsappNumber } from "@/lib/whatsapp";
import { nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { assertFeature } from "../subscription/subscriptionService";
import { ensureConnection, connectionView } from "./communicationRules";

/** Conexao do WhatsApp: status, ligar e desligar a API oficial e ajustes. */
export const connectionService = {
  getConnection(): Promise<WhatsAppConnectionView> {
    return readOp(async () => {
      return connectionView();
    });
  },
  /**
   * Conecta o numero do espaco a API oficial (Pro). No mock, o cadastro guiado
   * da Meta e simulado e ja volta conectado com o telefone da unidade.
   */
  connectOfficial(): Promise<WhatsAppConnectionView> {
    return writeOp(async () => {
      assertFeature("messaging");
      const connection = ensureConnection();
      const phone = whatsappNumber(store.unit.phone);
      if (!phone) {
        throw validationError([
          { field: "phoneNumber", message: "Cadastre o telefone do espaço em Configurações antes de conectar." },
        ]);
      }
      connection.officialStatus = "connected";
      connection.phoneNumber = phone;
      connection.displayName = store.organization.name;
      connection.connectedAt = nowIso();

      auditLogService.record({
        action: "updated",
        target: { type: "communication_session", label: "WhatsApp oficial" },
        predicate: "conectou o WhatsApp oficial do espaço",
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
