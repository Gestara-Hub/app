import type {
MessageTemplate,UpdateTemplatePayload
} from "@gestarahub/contracts";
import { TEMPLATE_MAX_LENGTH,isManualTrigger } from "@/lib/whatsapp";
import { charCount } from "@/lib/text";
import {
apiError,nowIso,
readOp,
writeOp,validationError
} from "@/services/world/ops";
import { auditLogService } from "../auditLogService";
import { assertFeature } from "../subscriptionService";
import { ensureTemplates } from "./communicationRules";

/** Modelos de mensagem do espaco. */
export const templatesService = {
  listTemplates(): Promise<MessageTemplate[]> {
    return readOp(async () => {
      return [...ensureTemplates()].sort((a, b) => a.daysOffset - b.daysOffset);
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

      if (payload.content !== undefined) {
        if (!payload.content.trim()) {
          throw validationError([{ field: "content", message: "Escreva o texto da mensagem." }]);
        }
        // Folga para os nomes: a mensagem enviada aceita ate 1000 caracteres.
        if (charCount(payload.content.trim()) > TEMPLATE_MAX_LENGTH) {
          throw validationError([{ field: "content", message: `Use no máximo ${TEMPLATE_MAX_LENGTH} caracteres.` }]);
        }
        template.content = payload.content.trim();
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
};
