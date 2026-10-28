import type { MessageTemplate, UpdateTemplatePayload, MetaTemplateInfo } from "@gestarahub/contracts";
import { TEMPLATE_MAX_LENGTH, TRIGGER_TO_META_TEMPLATE, isManualTrigger } from "@/lib/whatsapp";
import { charCount } from "@/lib/text";
import { apiError, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { auditLogService } from "../audit/auditLogService";
import { assertFeature } from "../subscription/subscriptionService";
import { ensureTemplates } from "./communicationRules";
import { whatsappClient } from "./whatsappClient";
import { logWarn } from "@/lib/log";

/** Modelos de mensagem do espaco. */
export const templatesService = {
  listTemplates(): Promise<MessageTemplate[]> {
    return readOp(async () => {
      const templates = ensureTemplates();
      if (whatsappClient.isConfigured()) {
        try {
          const metaList = await whatsappClient.listTemplates();
          for (const t of templates) {
            const metaMapping = TRIGGER_TO_META_TEMPLATE[t.trigger];
            if (metaMapping) {
              const match = metaList.find((m) => m.name === metaMapping.templateName);
              if (match) {
                t.metaStatus = match.status;
                t.metaTemplateName = match.name;
              }
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

      let contentChanged = false;
      if (payload.content !== undefined) {
        if (!payload.content.trim()) {
          throw validationError([{ field: "content", message: "Escreva o texto da mensagem." }]);
        }
        // Folga para os nomes: a mensagem enviada aceita ate 1000 caracteres.
        if (charCount(payload.content.trim()) > TEMPLATE_MAX_LENGTH) {
          throw validationError([{ field: "content", message: `Use no máximo ${TEMPLATE_MAX_LENGTH} caracteres.` }]);
        }
        if (template.content !== payload.content.trim()) {
          contentChanged = true;
        }
        template.content = payload.content.trim();
      }
      if (payload.enabled !== undefined) template.enabled = payload.enabled;
      if (payload.sendHour !== undefined) template.sendHour = payload.sendHour;
      if (payload.daysOffset !== undefined) template.daysOffset = payload.daysOffset;
      template.updatedAt = nowIso();

      // Se o conteúdo mudou e a Meta está configurada, submete a nova versão para análise da Meta
      if (contentChanged && whatsappClient.isConfigured()) {
        const metaMapping = TRIGGER_TO_META_TEMPLATE[template.trigger];
        if (metaMapping) {
          try {
            const metaRes = await whatsappClient.createOrUpdateTemplate({
              name: metaMapping.templateName,
              category: metaMapping.category,
              content: template.content,
            });
            template.metaStatus = metaRes.status;
            template.metaTemplateName = metaMapping.templateName;
          } catch (err) {
            logWarn(`[templatesService] Erro ao submeter template ${metaMapping.templateName} à Meta:`, err);
          }
        }
      }

      auditLogService.record({
        action: "updated",
        target: { type: "message_template", label: template.title },
        predicate: `atualizou a mensagem "${template.title}"`,
      });
      return { ...template };
    });
  },

  /** Consulta e sincroniza os status dos templates da Meta em tempo real. */
  syncMetaTemplates(): Promise<MetaTemplateInfo[]> {
    return writeOp(async () => {
      if (!whatsappClient.isConfigured()) return [];
      const metaList = await whatsappClient.listTemplates();
      const templates = ensureTemplates();
      for (const t of templates) {
        const metaMapping = TRIGGER_TO_META_TEMPLATE[t.trigger];
        if (metaMapping) {
          const match = metaList.find((m) => m.name === metaMapping.templateName);
          if (match) {
            t.metaStatus = match.status;
            t.metaTemplateName = match.name;
          }
        }
      }
      return metaList;
    });
  },
};
