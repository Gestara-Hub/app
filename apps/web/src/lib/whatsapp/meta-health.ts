import type {
  WhatsAppMetaHealth,
  WhatsAppMetaIssue,
  WhatsAppMetaNameStatus,
  WhatsAppMetaQuality,
  WhatsAppMetaSendState,
} from "@gestarahub/contracts";

/**
 * Situacao do numero na Meta (17/11/2026, doc technical/07 §1.6): traduz a
 * resposta de `GET /{phone_number_id}?fields=...` para o contrato, em portugues.
 * Funcao pura (sem rede) para testar.
 */

/** Campos pedidos a Meta. */
export const META_HEALTH_FIELDS = "status,name_status,quality_rating,messaging_limit_tier,health_status";

/** Erro de pagamento da conta do WhatsApp (bloqueia as conversas iniciadas pelo espaco). */
const PAYMENT_CODES = new Set([141006, 131042]);
/** Erros de chamadas de voz por SIP: recurso que nao usamos, fora do aviso. */
const IGNORED_CODES = new Set([138024, 138025]);

interface RawError {
  error_code?: number;
  error_description?: string;
}

interface RawEntity {
  entity_type?: string;
  can_send_message?: string;
  errors?: RawError[];
}

export interface RawMetaHealth {
  name_status?: string;
  quality_rating?: string;
  messaging_limit_tier?: string;
  health_status?: { can_send_message?: string; entities?: RawEntity[] };
}

function sendState(value: string | undefined): WhatsAppMetaSendState {
  if (value === "BLOCKED") return "blocked";
  if (value === "LIMITED") return "limited";
  return "available";
}

function nameStatus(value: string | undefined): WhatsAppMetaNameStatus | undefined {
  if (!value) return undefined;
  if (value === "APPROVED" || value === "AVAILABLE_WITHOUT_REVIEW") return "approved";
  if (value === "PENDING_REVIEW") return "pending_review";
  if (value === "DECLINED") return "declined";
  return "other";
}

function quality(value: string | undefined): WhatsAppMetaQuality | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  return v === "green" || v === "yellow" || v === "red" ? v : "unknown";
}

/** "TIER_250" -> 250, "TIER_1K" -> 1000, "TIER_UNLIMITED" -> null. */
export function dailyLimitOf(tier: string | undefined): number | null | undefined {
  if (!tier) return undefined;
  if (tier === "TIER_UNLIMITED") return null;
  const match = /^TIER_(\d+)(K)?$/.exec(tier);
  if (!match) return undefined;
  return Number(match[1]) * (match[2] ? 1000 : 1);
}

function issueText(code: number, payment: boolean): string {
  if (payment) return "A conta do WhatsApp do espaço está sem forma de pagamento válida na Meta. Cadastre um cartão.";
  return `A Meta apontou um problema na conta do WhatsApp (código ${code}).`;
}

export function parseMetaHealth(raw: RawMetaHealth, checkedAt: string): WhatsAppMetaHealth {
  const issues: WhatsAppMetaIssue[] = [];
  for (const entity of raw.health_status?.entities ?? []) {
    for (const error of entity.errors ?? []) {
      const code = Number(error.error_code);
      if (!Number.isFinite(code) || IGNORED_CODES.has(code) || issues.some((i) => i.code === code)) continue;
      const payment = PAYMENT_CODES.has(code) || /payment/i.test(error.error_description ?? "");
      issues.push({ code, text: issueText(code, payment), payment });
    }
  }
  const state = sendState(raw.health_status?.can_send_message);
  const limit = dailyLimitOf(raw.messaging_limit_tier);
  return {
    checkedAt,
    sendState: state,
    paymentBlocked: issues.some((i) => i.payment),
    ...(nameStatus(raw.name_status) ? { nameStatus: nameStatus(raw.name_status) } : {}),
    ...(quality(raw.quality_rating) ? { quality: quality(raw.quality_rating) } : {}),
    ...(limit !== undefined ? { dailyLimit: limit } : {}),
    issues,
  };
}

/** Rotulos para a tela. */
export const META_SEND_STATE_LABEL: Record<WhatsAppMetaSendState, string> = {
  available: "Liberado",
  limited: "Limitado",
  blocked: "Bloqueado",
};

export const META_NAME_STATUS_LABEL: Record<WhatsAppMetaNameStatus, string> = {
  approved: "Aprovado",
  pending_review: "Em análise",
  declined: "Recusado",
  other: "Sem análise",
};

export const META_QUALITY_LABEL: Record<WhatsAppMetaQuality, string> = {
  green: "Boa",
  yellow: "Média",
  red: "Baixa",
  unknown: "Sem nota ainda",
};
