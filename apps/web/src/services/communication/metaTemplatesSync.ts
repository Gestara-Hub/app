import type { MessageTemplate, MessageTrigger } from "@gestarahub/contracts";
import { TRIGGER_TO_META_TEMPLATE, type MetaTemplateInfo } from "@/lib/whatsapp";
import { mapWithConcurrency } from "@/lib/concurrency";
import { logWarn } from "@/lib/log";
import { ensureTemplates, metaBodyFor } from "./communicationRules";
import { metaErrorReason, whatsappClient, type SpaceWhatsAppConfig } from "./whatsappClient";

/**
 * Modelos de cada gatilho na conta do WhatsApp do espaco (doc technical/07
 * §1.4). Cria o que falta, edita o texto que mudou e traz a situacao (em
 * analise, aprovado, recusado). Roda ao conectar o numero, ao salvar o texto
 * de um modelo e pelo "Sincronizar". Falha num modelo nao para os outros: o
 * motivo fica no modelo.
 */

/** Chamadas a Meta ao mesmo tempo. */
const CONCURRENCY = 4;

export interface MetaTemplatesSyncResult {
  created: number;
  edited: number;
  failed: number;
}

function applyRemote(template: MessageTemplate, remote: MetaTemplateInfo): void {
  template.metaTemplateId = remote.id;
  template.metaTemplateName = remote.name;
  template.metaStatus = remote.status;
  if (remote.rejectionReason) template.metaRejectionReason = remote.rejectionReason;
  else delete template.metaRejectionReason;
}

export async function syncMetaTemplates(
  config: SpaceWhatsAppConfig,
  only?: readonly MessageTrigger[],
): Promise<MetaTemplatesSyncResult> {
  const result: MetaTemplatesSyncResult = { created: 0, edited: 0, failed: 0 };
  const remote = (await whatsappClient.listTemplates(config)).filter((t) => !t.language || t.language === "pt_BR");
  const targets = ensureTemplates().filter(
    (t) => TRIGGER_TO_META_TEMPLATE[t.trigger] && (!only || only.includes(t.trigger)),
  );

  await mapWithConcurrency(targets, CONCURRENCY, async (template) => {
    const mapping = TRIGGER_TO_META_TEMPLATE[template.trigger]!;
    const body = metaBodyFor(template);
    const existing = remote.find((r) => r.name === mapping.templateName);
    try {
      if (existing && template.metaBody === body) {
        applyRemote(template, existing);
        return;
      }
      const res = existing
        ? await whatsappClient.editTemplate(existing.id, body, config)
        : await whatsappClient.createOrUpdateTemplate(
            { name: mapping.templateName, category: mapping.category, content: body },
            config,
          );
      template.metaTemplateId = res.id;
      template.metaTemplateName = mapping.templateName;
      template.metaStatus = res.status;
      template.metaBody = body;
      delete template.metaRejectionReason;
      if (existing) result.edited += 1;
      else result.created += 1;
    } catch (err) {
      result.failed += 1;
      template.metaRejectionReason = metaErrorReason(err);
      logWarn(`[metaTemplatesSync] Modelo ${mapping.templateName} não enviado à Meta:`, err);
    }
  });
  return result;
}
