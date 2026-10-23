import type { OnlinePaymentSettings } from "@gestarahub/contracts";
import { readOp, writeOp, persistLocal } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { assertFeature } from "../subscription/subscriptionService";
import { realAccountInBrowser } from "../world/delegate";
import { updateOrganizationOnlineSettingsAction } from "./actions";
import { clone, currentSettings, validateSettings } from "./onlinePaymentRules";
import type { UpdateOnlinePaymentSettings } from "./onlinePaymentRules";
import { logError } from "@/lib/log";

/** Configuracao de Recebimentos online do espaco. */
export const onlineSettingsService = {
  // --- Configuracao -----------------------------------------------------------
  getSettings(): Promise<OnlinePaymentSettings> {
    return readOp(() => clone(currentSettings()));
  },
  /** Sincroniza o status de aprovação da subconta no store do cliente. */
  syncSubaccountApproved(data: {
    gatewayAccountId?: string;
    gatewayWalletId?: string;
    gatewayStatus: "not_configured" | "approved" | "pending" | "rejected";
  }): void {
    store.organization = {
      ...store.organization,
      settings: {
        ...store.organization.settings,
        onlinePayments: {
          ...store.organization.settings?.onlinePayments,
          enabled: true,
          gatewayProvider: "asaas",
          gatewayAccountId: data.gatewayAccountId,
          gatewayWalletId: data.gatewayWalletId,
          gatewayStatus: data.gatewayStatus,
        },
      },
    };
    persistLocal();
  },
  /** Grava em `organization.settings.onlinePayments` (proprietario/gerente). */
  updateSettings(
    payload: UpdateOnlinePaymentSettings,
  ): Promise<OnlinePaymentSettings> {
    return writeOp(async () => {
      assertFeature("online_payments");
      const before = currentSettings();
      const pixKey =
        payload.pixKey !== undefined
          ? payload.pixKey.trim() || undefined
          : before.pixKey;
      const next: OnlinePaymentSettings = {
        ...before,
        enabled: payload.enabled ?? before.enabled,
        pixKey,
        defaultExpiresInMinutes:
          payload.defaultExpiresInMinutes ?? before.defaultExpiresInMinutes,
        passFeeToCustomer:
          payload.passFeeToCustomer !== undefined
            ? payload.passFeeToCustomer
            : before.passFeeToCustomer,
        passFeePix:
          payload.passFeePix !== undefined
            ? payload.passFeePix
            : before.passFeePix,
        passFeeCard:
          payload.passFeeCard !== undefined
            ? payload.passFeeCard
            : before.passFeeCard,
        passFeeBoleto: payload.passFeeBoleto ?? before.passFeeBoleto,
        passFeeChoice: payload.passFeeChoice ?? before.passFeeChoice,
        acceptedMethods: payload.acceptedMethods ?? before.acceptedMethods,
      };
      validateSettings(next);
      store.organization = {
        ...store.organization,
        settings: { ...store.organization.settings, onlinePayments: next },
      };

      if (realAccountInBrowser()) {
        try {
          await updateOrganizationOnlineSettingsAction(store.organization.id, {
            enabled: next.enabled,
            pixKey: next.pixKey,
            defaultExpiresInMinutes: next.defaultExpiresInMinutes,
            passFeeToCustomer: next.passFeeToCustomer,
            passFeePix: next.passFeePix,
            passFeeCard: next.passFeeCard,
            passFeeBoleto: next.passFeeBoleto,
            passFeeChoice: next.passFeeChoice,
            acceptedMethods: next.acceptedMethods,
          });
        } catch (dbErr) {
          logError(
            "[onlinePaymentsService] Erro ao sincronizar settings com Supabase:",
            dbErr,
          );
        }
      }

      const toggled = before.enabled !== next.enabled;
      auditLogService.record({
        action: "updated",
        target: { type: "settings", label: "Pagamento online" },
        predicate: toggled
          ? `${next.enabled ? "ligou" : "desligou"} a cobrança online`
          : "atualizou a configuração do pagamento online",
        changes: toggled
          ? [
              {
                field: "enabled",
                label: "Cobrança online",
                before: before.enabled ? "Ligada" : "Desligada",
                after: next.enabled ? "Ligada" : "Desligada",
              },
            ]
          : undefined,
        security: true,
      });
      return clone(currentSettings());
    });
  },
};
