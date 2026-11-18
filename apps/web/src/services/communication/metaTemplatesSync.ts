import type { MessageTemplate, MessageTrigger } from "@gestarahub/contracts";
import type { MetaTemplateInfo } from "@/lib/whatsapp";
import {
  LEGACY_META_NAMES,
  masterTemplateFor,
  paymentButtonBase,
  type MasterTemplate,
} from "@/lib/whatsapp/master-templates";
import { mapWithConcurrency } from "@/lib/concurrency";
import { logWarn } from "@/lib/log";
import { ensureTemplates } from "./communicationRules";
import { metaErrorReason, whatsappClient, type SpaceWhatsAppConfig } from "./whatsappClient";

/**
 * Modelos de cada aviso na conta do WhatsApp do espaco (doc technical/07 §1.4 e
 * §1.7). Os textos sao os modelos mestres, iguais em todo espaco: cobranca vem
 * da biblioteca da Meta (aprovada na hora), o resto e texto proprio. Cria o que
 * falta, traz a situacao (em analise, aprovado, recusado) e apaga os modelos
 * antigos (nome sem versao). Roda ao conectar o numero e pelo "Sincronizar".
 * Falha num modelo nao para os outros: o motivo fica no modelo.
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

function create(master: MasterTemplate, config: SpaceWhatsAppConfig) {
  if (master.library) {
    return whatsappClient.createLibraryTemplate(
      {
        name: master.metaName,
        libraryName: master.library,
        buttonBaseUrl: master.paymentButton ? paymentButtonBase(process.env.NEXT_PUBLIC_APP_URL) : undefined,
      },
      config,
    );
  }
  // Texto proprio: as variaveis do GestaraHub viram {{n}} na ordem, com exemplo de cada.
  return whatsappClient.createOrUpdateTemplate(
    { name: master.metaName, category: master.category, content: master.params.reduce(
      (text, param, i) => text.replace(`{{${i + 1}}}`, param),
      master.body,
    ) },
    config,
  );
}

export async function syncMetaTemplates(
  config: SpaceWhatsAppConfig,
  only?: readonly MessageTrigger[],
): Promise<MetaTemplatesSyncResult> {
  const result: MetaTemplatesSyncResult = { created: 0, edited: 0, failed: 0 };
  const remote = (await whatsappClient.listTemplates(config)).filter((t) => !t.language || t.language === "pt_BR");
  const targets = ensureTemplates().filter(
    (t) => masterTemplateFor(t.trigger) && (!only || only.includes(t.trigger)),
  );

  await mapWithConcurrency(targets, CONCURRENCY, async (template) => {
    const master = masterTemplateFor(template.trigger)!;
    const existing = remote.find((r) => r.name === master.metaName);
    try {
      if (existing) {
        applyRemote(template, existing);
        return;
      }
      const res = await create(master, config);
      template.metaTemplateId = res.id;
      template.metaTemplateName = master.metaName;
      template.metaStatus = res.status;
      template.metaBody = master.body;
      delete template.metaRejectionReason;
      result.created += 1;
    } catch (err) {
      result.failed += 1;
      template.metaRejectionReason = metaErrorReason(err);
      logWarn(`[metaTemplatesSync] Modelo ${master.metaName} não enviado à Meta:`, err);
    }
  });

  // Modelos antigos (sem versao, ate 17/11/2026): saem da conta do espaco.
  if (!only) {
    const legacy = remote.filter((r) => LEGACY_META_NAMES.includes(r.name));
    await mapWithConcurrency(legacy, CONCURRENCY, async (old) => {
      try {
        await whatsappClient.deleteTemplate(old.name, config);
      } catch (err) {
        logWarn(`[metaTemplatesSync] Modelo antigo ${old.name} não apagado na Meta:`, err);
      }
    });
  }
  return result;
}
