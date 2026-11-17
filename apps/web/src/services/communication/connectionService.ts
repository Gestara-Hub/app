import type {
  ConnectOfficialWhatsAppPayload,
  UpdateConnectionSettingsPayload,
  WhatsAppConnectionView,
} from "@gestarahub/contracts";
import { whatsappNumber } from "@/lib/whatsapp";
import { apiError, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { assertFeature } from "../subscription/subscriptionService";
import { ensureConnection, connectionView, officialSendingAvailable } from "./communicationRules";
import { getWhatsAppCredentialsGateway, platformNumberFallbackAllowed } from "./whatsappCredentialsGateway";
import { syncMetaTemplates } from "./metaTemplatesSync";
import { logWarn } from "@/lib/log";

/** Conexao do WhatsApp: status, ligar e desligar a API oficial e ajustes. */
export const connectionService = {
  getConnection(): Promise<WhatsAppConnectionView> {
    return readOp(async () => {
      return connectionView();
    });
  },
  /**
   * Conecta o numero do espaco a API oficial (Pro). Com o cadastro guiado da
   * Meta, o servidor troca o codigo pelo token do espaco e guarda as
   * credenciais (doc technical/07 §1.1); so entao fica "Conectado". Sem o
   * cadastro guiado, so fora de producao (numero de testes do ambiente).
   */
  connectOfficial(input?: ConnectOfficialWhatsAppPayload): Promise<WhatsAppConnectionView> {
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
      const gateway = getWhatsAppCredentialsGateway();
      const fromSignup = Boolean(input?.code && input.phoneNumberId && input.wabaId);

      let displayName = store.organization.name;
      // Numero confirmado pela Meta no cadastro guiado (Embedded Signup).
      let phoneFromMeta: string | null = null;
      if (fromSignup && gateway) {
        const confirmed = await gateway.connect({
          organizationId: store.organization.id,
          code: input!.code!,
          phoneNumberId: input!.phoneNumberId!,
          wabaId: input!.wabaId!,
          businessId: input?.businessId,
          onboarding: input?.onboarding ?? "coexistence",
        });
        phoneFromMeta = whatsappNumber(confirmed.displayPhoneNumber);
        if (confirmed.verifiedName) displayName = confirmed.verifiedName;
        // Modelos de cada gatilho na conta do espaco (doc technical/07 §1.4): a
        // Meta analisa em minutos; falha num modelo nao impede a conexao.
        const config = await gateway.configFor(store.organization.id);
        if (config) {
          try {
            await syncMetaTemplates(config);
          } catch (err) {
            logWarn("[connectionService] Modelos não enviados à Meta ao conectar:", err);
          }
        }
      } else if (!platformNumberFallbackAllowed()) {
        // Em producao, so com as credenciais do proprio numero.
        throw apiError("SERVICE_UNAVAILABLE", "Conclua a conexão na janela da Meta para ligar o envio automático.", {
          httpStatus: 409,
        });
      }

      // Sem numero de verdade, nao conecta: nunca o id do numero na Meta nem um numero inventado.
      const phone = phoneFromMeta ?? whatsappNumber(store.unit.phone);
      if (!phone) {
        throw validationError([
          {
            field: "phoneNumber",
            message: fromSignup
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
        predicate: fromSignup
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
      // Cancela os avisos na conta do espaco e apaga token e PIN do Vault.
      await getWhatsAppCredentialsGateway()?.disconnect(store.organization.id);
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
