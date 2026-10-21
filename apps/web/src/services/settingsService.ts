import type {
  Address,
  BusinessHoursDay,
  Category,
  ClassesBusinessSegment,
  Id,
  Organization,
  Unit,
  User,
} from "@gestarahub/contracts";
import { hydrateTenantStore, persist, setActiveOrganization, store } from "@/mocks/store";
import { defaultMessageTemplates } from "@/mocks/seed";
import { simulateRead, simulateWrite, validationError } from "@/mocks/helpers";
import { isSupabaseOrganization } from "@/lib/session";
import { auditLogService } from "./auditLogService";
import { getOrganizationGatewayAction } from "./onlinePaymentsBackend";
import { updateOrganizationInDb, updateUnitInDb } from "./settingsBackend";

/** Conta real (id UUID): grava no Supabase depois de atualizar o store. */
async function persistOrganization(): Promise<void> {
  if (isSupabaseOrganization(store.organization.id)) {
    await updateOrganizationInDb(store.organization);
  }
}

/** Nome do espaco e da unidade. */
const MAX_NAME = 80;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export type UpdateOrganization = Partial<
  Pick<
    Organization,
    | "name"
    | "segment"
    | "model"
    | "classSegment"
    | "customSegmentName"
    | "customSegmentProgression"
    | "customSegmentBilling"
    | "settings"
  >
>;
export type UpdateUnit = Partial<{
  name: string;
  address: Address | string;
  phone: string;
  businessHours: BusinessHoursDay[];
}>;

/**
 * Troca de area: os modelos de mensagem que ainda estao no texto padrao da area
 * anterior passam para o texto da nova. Os editados pelo tenant ficam como estao.
 */
function syncTemplatesWithSegment(previous: ClassesBusinessSegment | undefined) {
  if (!store.messageTemplates?.length) return;
  const orgId = store.organization.id;
  const oldDefaults = new Map(
    defaultMessageTemplates(orgId, previous).map((t) => [t.trigger, t.content]),
  );
  const newDefaults = new Map(
    defaultMessageTemplates(orgId, store.organization.classSegment).map((t) => [t.trigger, t.content]),
  );
  for (const template of store.messageTemplates) {
    const next = newDefaults.get(template.trigger);
    if (next && template.content === oldDefaults.get(template.trigger)) {
      template.content = next;
    }
  }
}

export const settingsService = {
  setActiveTenant(organizationId: Id): Promise<void> {
    return simulateWrite(() => {
      setActiveOrganization(organizationId);
    });
  },

  hydrateTenant(input: {
    organization: Organization;
    unit: Unit;
    user: User;
    categories?: Category[];
  }): void {
    hydrateTenantStore(input);
  },

  async getOrganization(): Promise<Organization> {
    if (typeof window !== "undefined" && isSupabaseOrganization(store.organization.id)) {
      try {
        const remote = await getOrganizationGatewayAction(store.organization.id);
        if (remote && remote.status !== "not_configured") {
          const remoteSettings = (remote.settings as Record<string, unknown>) || {};
          const remoteOnline = (remoteSettings.onlinePayments as Record<string, unknown>) || {};
          const currentOnline = store.organization.settings?.onlinePayments;
          store.organization = {
            ...store.organization,
            settings: {
              ...store.organization.settings,
              onlinePayments: {
                enabled: currentOnline?.enabled ?? Boolean(remoteOnline.enabled) ?? true,
                defaultExpiresInMinutes: (currentOnline?.defaultExpiresInMinutes ?? Number(remoteOnline.defaultExpiresInMinutes)) || 1440,
                pixKey: currentOnline?.pixKey ?? (remoteOnline.pixKey as string | undefined),
                gatewayProvider: (remote.provider as "asaas" | undefined) ?? (remoteOnline.gatewayProvider as "asaas" | undefined),
                gatewayAccountId: remote.accountId ?? (remoteOnline.gatewayAccountId as string | undefined),
                gatewayWalletId: remote.walletId ?? (remoteOnline.gatewayWalletId as string | undefined),
                gatewayStatus: (remote.status as "approved" | "pending" | "rejected" | undefined) ?? (remoteOnline.gatewayStatus as "approved" | undefined),
                passFeeToCustomer: currentOnline?.passFeeToCustomer ?? (remoteOnline.passFeeToCustomer !== undefined ? Boolean(remoteOnline.passFeeToCustomer) : false),
                passFeePix: currentOnline?.passFeePix ?? (remoteOnline.passFeePix !== undefined ? Boolean(remoteOnline.passFeePix) : undefined),
                passFeeCard: currentOnline?.passFeeCard ?? (remoteOnline.passFeeCard !== undefined ? Boolean(remoteOnline.passFeeCard) : undefined),
              },
            },
            ...(remote.subscription && typeof remote.subscription === "object" && "tier" in remote.subscription
              ? {
                  subscription: {
                    tier: (remote.subscription as { tier: "free" | "pro" | "scale" }).tier,
                    changedAt: (remote.subscription as { changedAt?: string }).changedAt,
                  },
                }
              : {}),
          };
          persist();
        }
      } catch (err) {
        console.error("[settingsService] Erro ao sincronizar organização:", err);
      }
    }
    return simulateRead(() => clone(store.organization));
  },

  getUnit(): Promise<Unit> {
    return simulateRead(() => clone(store.unit));
  },

  updateOrganization(payload: UpdateOrganization): Promise<Organization> {
    return simulateWrite(async () => {
      // Nome ate 80 caracteres: cabe no topo e no cookie da sessao.
      if ((payload.name?.trim().length ?? 0) > MAX_NAME) {
        throw validationError([{ field: "organizationName", message: "Use até 80 caracteres." }]);
      }
      const previousSegment = store.organization.classSegment;
      store.organization = {
        ...store.organization,
        ...payload,
        name: payload.name?.trim() || store.organization.name,
        segment:
          payload.segment !== undefined
            ? payload.segment.trim() || store.organization.segment
            : store.organization.segment,
        model: payload.model || store.organization.model,
        settings: payload.settings !== undefined ? payload.settings : store.organization.settings,
      };
      if (store.organization.classSegment !== previousSegment) {
        syncTemplatesWithSegment(previousSegment);
      }
      await persistOrganization();
      auditLogService.record({
        action: "updated",
        target: { type: "settings", label: "Dados da organização" },
        predicate: "atualizou os dados da organização",
        security: true,
      });
      return clone(store.organization);
    });
  },

  /** "Está tudo certo" no aviso de Modalidades: fecha a revisao pedida pelo setup. */
  markModalitiesReviewed(): Promise<Organization> {
    return simulateWrite(async () => {
      store.organization = {
        ...store.organization,
        settings: { ...store.organization.settings, modalitiesReviewed: true },
      };
      await persistOrganization();
      auditLogService.record({
        action: "updated",
        target: { type: "settings", label: "Modalidades da configuração inicial" },
        predicate: "revisou as modalidades criadas na configuração inicial",
      });
      return clone(store.organization);
    });
  },

  updateUnit(payload: UpdateUnit): Promise<Unit> {
    return simulateWrite(async () => {
      if ((payload.name?.trim().length ?? 0) > MAX_NAME) {
        throw validationError([{ field: "unitName", message: "Use até 80 caracteres." }]);
      }
      store.unit = {
        ...store.unit,
        ...payload,
        name: payload.name?.trim() || store.unit.name,
        address: payload.address !== undefined ? payload.address : store.unit.address,
        phone: payload.phone !== undefined ? (typeof payload.phone === "string" ? payload.phone.trim() || undefined : payload.phone) : store.unit.phone,
      };
      if (isSupabaseOrganization(store.organization.id)) {
        await updateUnitInDb(store.unit);
      }
      // Distingue alteracao do expediente (o caso mais sensivel) dos demais dados.
      const changedHours = payload.businessHours !== undefined;
      auditLogService.record({
        action: "updated",
        target: {
          type: "settings",
          label: changedHours ? "Horário de funcionamento" : "Dados da unidade",
        },
        predicate: changedHours
          ? "alterou o horário de funcionamento da unidade"
          : "atualizou os dados da unidade",
        security: true,
      });
      return clone(store.unit);
    });
  },
};
