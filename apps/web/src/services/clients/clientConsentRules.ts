import type { Client, MinorConsentStatus, WhatsAppConsentStatus } from "@gestarahub/contracts";
import { getCurrentActor } from "../world/actor";
import { nowIso } from "../world/ops";

type ConsentFields = Pick<Client, "minorConsentStatus" | "minorConsentAt" | "minorConsentBy" | "minorConsentEvidence">;

const confirmed = (status?: MinorConsentStatus) => status === "confirmed_whatsapp" || status === "confirmed_paper";

/**
 * Autorizacao do menor no cadastro: o servidor decide, nao o navegador
 * (auditoria de 30/10/2026; antes o atendente gravava qualquer situacao e
 * qualquer "prova"). "Autorizado pelo WhatsApp" so vem do link do responsavel;
 * autorizacao registrada nao volta a pendente pelo cadastro; o termo impresso
 * ganha a prova montada aqui (quem registrou e quando). Sem a situacao no
 * pedido, nada muda.
 */
export function consentFieldsFor(payload: Partial<ConsentFields>, current?: Client): Partial<ConsentFields> {
  const wanted = payload.minorConsentStatus;
  if (wanted === undefined) return current ? {} : { minorConsentStatus: "not_applicable" };
  const keep: Partial<ConsentFields> = current
    ? {
        minorConsentStatus: current.minorConsentStatus,
        minorConsentAt: current.minorConsentAt,
        minorConsentBy: current.minorConsentBy,
        minorConsentEvidence: current.minorConsentEvidence,
      }
    : { minorConsentStatus: "pending" };

  if (wanted === "confirmed_whatsapp") return keep;
  if (wanted === "pending" && confirmed(current?.minorConsentStatus)) return keep;
  if (wanted === "confirmed_paper") {
    if (current?.minorConsentStatus === "confirmed_paper") return keep;
    const actor = getCurrentActor();
    const at = nowIso();
    return {
      minorConsentStatus: "confirmed_paper",
      minorConsentAt: at,
      minorConsentBy: payload.minorConsentBy?.trim() || "Responsável legal (termo impresso)",
      minorConsentEvidence: {
        method: "paper_form_declaration",
        recordedAt: at,
        recordedByUserId: actor?.userId,
        recordedByUserName: actor?.name,
      },
    };
  }
  // Pendente (menor sem registro) ou "nao se aplica" (virou maior): a prova anterior fica no historico.
  return {
    minorConsentStatus: wanted,
    minorConsentAt: undefined,
    minorConsentBy: undefined,
    minorConsentEvidence: wanted === "not_applicable" ? current?.minorConsentEvidence : undefined,
  };
}

type WhatsAppConsentFields = Pick<Client, "whatsappConsentStatus" | "whatsappConsentAt" | "whatsappConsentBy">;

/**
 * Autorizacao para mensagens pelo WhatsApp (12/11/2026, doc product/27 M1): o
 * navegador manda so a situacao; data e quem registrou sao do servidor. Mesma
 * situacao de antes nao muda o carimbo. "Pediu para parar" pelo WhatsApp
 * ("SAIR") chega pelo webhook, nao por aqui.
 */
export function whatsappConsentFieldsFor(
  payload: { whatsappConsentStatus?: WhatsAppConsentStatus },
  current?: Client,
): Partial<WhatsAppConsentFields> {
  const wanted = payload.whatsappConsentStatus;
  const before = current?.whatsappConsentStatus ?? "unknown";
  if (wanted === undefined || wanted === before) {
    return current
      ? { whatsappConsentStatus: current.whatsappConsentStatus, whatsappConsentAt: current.whatsappConsentAt, whatsappConsentBy: current.whatsappConsentBy }
      : { whatsappConsentStatus: "unknown" };
  }
  if (wanted === "unknown") {
    return { whatsappConsentStatus: "unknown", whatsappConsentAt: undefined, whatsappConsentBy: undefined };
  }
  const actor = getCurrentActor();
  return {
    whatsappConsentStatus: wanted,
    whatsappConsentAt: nowIso(),
    whatsappConsentBy: actor?.name ? `${actor.name} (no cadastro)` : "Registrado no cadastro",
  };
}

/** O envio oficial (automatico ou pela API) pode ir para este aluno? */
export function whatsappConsentGranted(client: Pick<Client, "whatsappConsentStatus"> | undefined): boolean {
  return client?.whatsappConsentStatus === "granted";
}
