import { addDays, format, parseISO } from "date-fns";

/**
 * Como o painel descreve o plano de um espaco (campo `subscription` de
 * `organizations`, gravado so pelo servidor do app dos clientes). Puro e testado.
 */
export interface SubscriptionJson {
  tier?: string;
  interval?: string;
  status?: string;
  renewsOn?: string;
  nextDueDate?: string;
  priceCents?: number;
  asaasSubscriptionId?: string;
  scheduledChange?: { tier?: string; effectiveOn?: string };
  revertedFrom?: { tier?: string; on?: string };
  courtesyUntil?: string;
  pendingChange?: unknown;
}

export const TIER_LABEL: Record<string, string> = { free: "Grátis", pro: "Profissional", scale: "Expansão" };
const GRACE_DAYS = 5;

export function planName(sub: SubscriptionJson | null | undefined): string {
  const tier = sub?.tier ?? "free";
  const base = TIER_LABEL[tier] ?? tier;
  if (tier === "free") return base;
  return `${base} ${sub?.interval === "yearly" ? "anual" : "mensal"}`;
}

export type PlanSituationKey = "free" | "active" | "courtesy" | "grace" | "overdue" | "scheduled" | "reverted";

export interface PlanSituation {
  key: PlanSituationKey;
  label: string;
  /** Texto de apoio: datas relevantes. */
  detail?: string;
}

const br = (day: string | undefined) => (day ? day.split("-").reverse().join("/") : "");

/** Situacao do plano hoje (`today` = "AAAA-MM-DD" de Brasilia). */
export function planSituation(sub: SubscriptionJson | null | undefined, today: string): PlanSituation {
  const tier = sub?.tier ?? "free";
  if (tier === "free") {
    if (sub?.revertedFrom?.on) {
      return { key: "reverted", label: "Voltou ao Grátis", detail: `Renovação de ${br(sub.revertedFrom.on)} não paga (${TIER_LABEL[sub.revertedFrom.tier ?? ""] ?? "plano pago"})` };
    }
    return { key: "free", label: "Grátis" };
  }
  if (sub?.courtesyUntil) {
    return { key: "courtesy", label: "Cortesia", detail: `Até ${br(sub.courtesyUntil)}` };
  }
  const renewsOn = sub?.renewsOn ?? sub?.nextDueDate;
  if (renewsOn && today > renewsOn) {
    const graceEnd = format(addDays(parseISO(renewsOn), GRACE_DAYS), "yyyy-MM-dd");
    return today <= graceEnd
      ? { key: "grace", label: "Em carência", detail: `Renovação de ${br(renewsOn)} sem pagamento; carência até ${br(graceEnd)}` }
      : { key: "overdue", label: "Vencido", detail: `Renovação de ${br(renewsOn)} sem pagamento; volta ao Grátis na próxima rotina` };
  }
  if (sub?.scheduledChange?.effectiveOn) {
    return { key: "scheduled", label: "Troca marcada", detail: `${TIER_LABEL[sub.scheduledChange.tier ?? "free"] ?? "Grátis"} em ${br(sub.scheduledChange.effectiveOn)}` };
  }
  return { key: "active", label: "Ativo", detail: renewsOn ? `Renova em ${br(renewsOn)}` : undefined };
}

export const AREA_LABEL: Record<string, string> = {
  martial_arts: "Lutas",
  pilates_yoga: "Pilates e yoga",
  functional_training: "Funcional e crossfit",
  dance: "Dança",
  music: "Música",
  languages: "Idiomas e reforço",
  swimming_sports: "Natação e esportes",
  gastronomy: "Gastronomia",
  arts_crafts: "Artes e artesanato",
  beauty_courses: "Beleza e cursos livres",
  custom: "Outra área",
};

export const MODEL_LABEL: Record<string, string> = { classes: "Turmas", scheduling: "Agendamento", delivery: "Entrega" };
