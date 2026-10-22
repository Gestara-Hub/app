import type {
  OnlinePaymentSettings,
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
import { unwrap } from "./server/action";
import { serviceAction } from "./world/serviceActions";
import { encodeArgs } from "./world/transport";
import { defaultMessageTemplates } from "@/services/defaults";
import { readOp, writeOp, validationError } from "@/services/world/ops";
import { realAccountInBrowser } from "./world/delegate";
import { auditLogService } from "./auditLogService";
import { getOrganizationGatewayAction } from "./onlinePaymentsBackend";

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

/** Regras de configuracao do espaco (rodam no servidor na conta real). */
const settingsServiceImpl = {
  getOrganization(): Promise<Organization> {
    return readOp(() => clone(store.organization));
  },

  getUnit(): Promise<Unit> {
    return readOp(() => clone(store.unit));
  },

  updateOrganization(payload: UpdateOrganization): Promise<Organization> {
    return writeOp(async () => {
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
    return writeOp(async () => {
      store.organization = {
        ...store.organization,
        settings: { ...store.organization.settings, modalitiesReviewed: true },
      };
      auditLogService.record({
        action: "updated",
        target: { type: "settings", label: "Modalidades da configuração inicial" },
        predicate: "revisou as modalidades criadas na configuração inicial",
      });
      return clone(store.organization);
    });
  },

  updateUnit(payload: UpdateUnit): Promise<Unit> {
    return writeOp(async () => {
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

export { settingsServiceImpl };

type SettingsMethod = Exclude<keyof typeof settingsServiceImpl, never>;

function onServer<T>(method: SettingsMethod, ...args: unknown[]): Promise<T> {
  return unwrap(serviceAction(`settings.${method}`, encodeArgs(args) as unknown[])) as Promise<T>;
}

/** Guarda no cache do navegador o espaco que o servidor devolveu. */
function cacheOrganization(organization: Organization): void {
  store.organization = organization;
  persist();
}

function cacheUnit(unit: Unit): void {
  store.unit = unit;
  persist();
}

/**
 * Configuracoes do espaco. Conta real: le e grava pelo servidor (doc 15) e
 * guarda no navegador so uma copia (sessao, cabecalho). Antes, a organizacao e
 * a unidade do navegador vinham so do login e nao acompanhavam o banco.
 */
/**
 * Conta real: o que o gateway sabe da subconta (status, conta, carteira,
 * tarifas) entra nas configuracoes de recebimento do cache do navegador.
 */
async function mergeGatewayIntoCache(): Promise<void> {
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
            passFeeBoleto: currentOnline?.passFeeBoleto ?? (remoteOnline.passFeeBoleto !== undefined ? Boolean(remoteOnline.passFeeBoleto) : undefined),
            passFeeChoice: currentOnline?.passFeeChoice ?? (remoteOnline.passFeeChoice !== undefined ? Boolean(remoteOnline.passFeeChoice) : undefined),
            // Formas aceitas (Recebimentos online); antes ficavam de fora e a escolha se perdia.
            acceptedMethods:
              currentOnline?.acceptedMethods ??
              (remoteOnline.acceptedMethods as OnlinePaymentSettings["acceptedMethods"] | undefined),
            // Tarifas da subconta: sempre as do banco (coluna gateway_fees).
            gatewayFees: remote.gatewayFees ?? currentOnline?.gatewayFees,
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

export const settingsService = {
  setActiveTenant(organizationId: Id): Promise<void> {
    return writeOp(() => {
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
    if (!realAccountInBrowser()) return settingsServiceImpl.getOrganization();
    cacheOrganization(await onServer<Organization>("getOrganization"));
    await mergeGatewayIntoCache();
    return clone(store.organization);
  },

  async getUnit(): Promise<Unit> {
    if (!realAccountInBrowser()) return settingsServiceImpl.getUnit();
    cacheUnit(await onServer<Unit>("getUnit"));
    return clone(store.unit);
  },

  async updateOrganization(payload: UpdateOrganization): Promise<Organization> {
    if (!realAccountInBrowser()) return settingsServiceImpl.updateOrganization(payload);
    cacheOrganization(await onServer<Organization>("updateOrganization", payload));
    return clone(store.organization);
  },

  async markModalitiesReviewed(): Promise<Organization> {
    if (!realAccountInBrowser()) return settingsServiceImpl.markModalitiesReviewed();
    cacheOrganization(await onServer<Organization>("markModalitiesReviewed"));
    return clone(store.organization);
  },

  async updateUnit(payload: UpdateUnit): Promise<Unit> {
    if (!realAccountInBrowser()) return settingsServiceImpl.updateUnit(payload);
    cacheUnit(await onServer<Unit>("updateUnit", payload));
    return clone(store.unit);
  },
};
