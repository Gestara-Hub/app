import type { MessageTemplate, UpdateTemplatePayload } from "@gestarahub/contracts";
import { TRIGGER_TO_META_TEMPLATE, isManualTrigger } from "@/lib/whatsapp";
import { apiError, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { auditLogService } from "../audit/auditLogService";
import { assertFeature } from "../subscription/subscriptionService";
import { store } from "@/services/world/store";
import { ensureTemplates } from "./communicationRules";
import { whatsappClient } from "./whatsappClient";
import { syncMetaTemplates, type MetaTemplatesSyncResult } from "./metaTemplatesSync";
import { logWarn } from "@/lib/log";

/** Faixas validas de prazo por gatilho configuravel. */
const DAYS_OFFSET_LIMITS: Partial<Record<MessageTemplate["trigger"], { min: number; max: number; message: string }>> = {
  billing_before_due: { min: -30, max: -1, message: "Use entre 1 e 30 dias antes do vencimento." },
  charge_reminder: { min: -30, max: -1, message: "Use entre 1 e 30 dias antes do vencimento." },
  billing_after_due: { min: 1, max: 30, message: "Use entre 1 e 30 dias após o vencimento." },
  billing_critical: { min: 2, max: 60, message: "Use entre 2 e 60 dias após o vencimento." },
  absence_alert: { min: 1, max: 15, message: "Use entre 1 e 15 faltas seguidas." },
  package_ending: { min: 1, max: 30, message: "Use entre 1 e 30 dias antes de vencer." },
};

/** Modelos de mensagem do espaco. */
export const templatesService = {
  listTemplates(): Promise<MessageTemplate[]> {
    return readOp(async () => {
      const templates = ensureTemplates();
      const metaConfig = await whatsappClient.configFor(store.organization.id);
      if (metaConfig) {
        try {
          const metaList = await whatsappClient.listTemplates(metaConfig);
          for (const t of templates) {
            // Situacao na hora (o aviso da Meta grava no banco; isto cobre o atraso).
            const name = t.metaTemplateName ?? TRIGGER_TO_META_TEMPLATE[t.trigger]?.templateName;
            const match = name ? metaList.find((m) => m.name === name) : undefined;
            if (match) {
              t.metaStatus = match.status;
              t.metaTemplateName = match.name;
            }
          }
        } catch (err) {
          logWarn("[templatesService] Não foi possível carregar status da Meta:", err);
        }
      }
      return [...templates].sort((a, b) => a.daysOffset - b.daysOffset);
    });
  },
  /**
   * Texto do modelo: liberado para todos (o envio assistido usa os mesmos
   * textos). Envio automatico, horario e prazo sao do Pro.
   */
  updateTemplate(payload: UpdateTemplatePayload): Promise<MessageTemplate> {
    return writeOp(async () => {
      const template = ensureTemplates().find((t) => t.id === payload.id);
      if (!template) {
        throw apiError("NOT_FOUND", "Modelo de mensagem não encontrado.", { httpStatus: 404 });
      }
      const automationChange =
        (payload.enabled !== undefined && payload.enabled !== template.enabled) ||
        (payload.sendHour !== undefined && payload.sendHour !== template.sendHour) ||
        (payload.daysOffset !== undefined && payload.daysOffset !== template.daysOffset);
      if (automationChange) {
        if (isManualTrigger(template.trigger)) {
          throw validationError([{ field: "enabled", message: "Este modelo é só de envio manual." }]);
        }
        assertFeature("messaging");
      }
      if (payload.sendHour !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.sendHour)) {
        throw validationError([{ field: "sendHour", message: "Informe um horário válido (HH:MM)." }]);
      }
      if (payload.daysOffset !== undefined) {
        if (!Number.isInteger(payload.daysOffset)) {
          throw validationError([{ field: "daysOffset", message: "Informe um número inteiro." }]);
        }
        const limit = DAYS_OFFSET_LIMITS[template.trigger];
        if (limit && (payload.daysOffset < limit.min || payload.daysOffset > limit.max)) {
          throw validationError([{ field: "daysOffset", message: limit.message }]);
        }
      }

      // O texto do aviso e o do modelo mestre (doc technical/07 §1.7): o espaco
      // nao edita (o mesmo texto em todo espaco e o que a Meta aprovou).
      if (payload.content !== undefined && payload.content.trim() !== template.content) {
        throw validationError([{ field: "content", message: "O texto deste aviso é fixo." }]);
      }
      if (payload.enabled !== undefined) template.enabled = payload.enabled;
      if (payload.sendHour !== undefined) template.sendHour = payload.sendHour;
      if (payload.daysOffset !== undefined) template.daysOffset = payload.daysOffset;
      template.updatedAt = nowIso();

      auditLogService.record({
        action: "updated",
        target: { type: "message_template", label: template.title },
        predicate: `atualizou a mensagem "${template.title}"`,
      });
      return { ...template };
    });
  },

  /** Cria o que falta na conta do espaco, envia os textos mudados e traz a situacao de cada modelo. */
  syncMetaTemplates(): Promise<MetaTemplatesSyncResult> {
    return writeOp(async () => {
      assertFeature("messaging");
      const metaConfig = await whatsappClient.configFor(store.organization.id);
      if (!metaConfig) return { created: 0, edited: 0, failed: 0 };
      return syncMetaTemplates(metaConfig);
    });
  },
};
