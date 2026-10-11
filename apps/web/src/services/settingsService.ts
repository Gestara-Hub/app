import type {
  Address,
  BusinessHoursDay,
  ClassesBusinessSegment,
  Id,
  Organization,
  Unit,
} from "@gestarahub/contracts";
import { setActiveOrganization, store } from "@/mocks/store";
import { defaultMessageTemplates } from "@/mocks/seed";
import { simulateRead, simulateWrite } from "@/mocks/helpers";
import { auditLogService } from "./auditLogService";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export type UpdateOrganization = Partial<
  Pick<Organization, "name" | "segment" | "model" | "classSegment" | "customSegmentName" | "settings">
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

  getOrganization(): Promise<Organization> {
    return simulateRead(() => clone(store.organization));
  },

  getUnit(): Promise<Unit> {
    return simulateRead(() => clone(store.unit));
  },

  updateOrganization(payload: UpdateOrganization): Promise<Organization> {
    return simulateWrite(() => {
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
    return simulateWrite(() => {
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
    return simulateWrite(() => {
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
