import type { UserProfile } from "@gestarahub/contracts";
import type { PlanNotice, PlanNoticeKind } from "@gestarahub/core/subscription-plan";
import { graceEndsOn } from "@gestarahub/core/subscription-plan";

/** "13/11" de "2026-11-13". */
const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** Quem ve os avisos do plano no app (o e-mail vai para os mesmos). */
export const seesPlanNotices = (profile: UserProfile) => profile === "owner" || profile === "manager";

/**
 * Avisos fixos no topo: o plano esta para voltar ao Gratis ou ja voltou. Os
 * outros (renova logo, pagamento pendente, assinatura encerrada) ficam so no
 * sino, pedido do usuario de 30/10/2026; cada aviso num lugar so.
 */
const PINNED_KINDS: ReadonlySet<PlanNoticeKind> = new Set(["grace_ending", "reverted", "revert_reminder", "closing_soon"]);
export const isPinnedPlanNotice = (notice: PlanNotice) => PINNED_KINDS.has(notice.kind);

export interface PlanNoticeCopy {
  /** Titulo curto (aviso fixo e assunto do e-mail). */
  title: string;
  /** Uma linha de explicacao. */
  text: string;
  /** Botao: pagar (com a cobranca em aberto) ou ver o plano. */
  action: string;
  tone: "info" | "warning" | "danger";
}

/**
 * Textos dos avisos da renovacao do plano (doc product/13 §6): os mesmos no
 * aviso fixo do topo, no sino e no e-mail ao dono e ao gerente.
 */
export function planNoticeCopy(notice: PlanNotice, planName: string): PlanNoticeCopy {
  switch (notice.kind) {
    case "renews_soon":
      return {
        title: `Seu plano renova em ${ddmm(notice.renewsOn)}`,
        text: `Pague o Pix do Plano ${planName} até o dia para seguir sem pausa.`,
        action: "Pagar agora",
        tone: "info",
      };
    case "payment_pending":
      return {
        title: "Pagamento do plano pendente",
        text: `O Plano ${planName} segue funcionando até ${ddmm(graceEndsOn(notice.renewsOn))}.`,
        action: "Pagar agora",
        tone: "warning",
      };
    case "grace_ending":
      return {
        title: `Faltam ${notice.daysLeft} ${notice.daysLeft === 1 ? "dia" : "dias"} para o plano voltar ao Grátis`,
        text: `Pague a renovação de ${ddmm(notice.renewsOn)} para manter o Plano ${planName}.`,
        action: "Pagar agora",
        tone: "danger",
      };
    case "reverted":
      return {
        title: "Seu plano voltou ao Grátis",
        text: `Pague a renovação até ${ddmm(notice.closesOn ?? notice.renewsOn)} para religar o Plano ${planName}. Depois, a assinatura é encerrada e você assina de novo quando quiser.`,
        action: "Pagar agora",
        tone: "danger",
      };
    case "revert_reminder":
      return {
        title: `A assinatura do plano será encerrada em ${ddmm(notice.closesOn ?? notice.renewsOn)}`,
        text: `Pague a renovação até lá para religar o Plano ${planName}. Os dados continuam guardados.`,
        action: "Pagar agora",
        tone: "danger",
      };
    case "closing_soon":
      return {
        title:
          notice.daysLeft === 0
            ? "A assinatura do plano é encerrada hoje"
            : `Faltam ${notice.daysLeft} ${notice.daysLeft === 1 ? "dia" : "dias"} para encerrar a assinatura`,
        text: `Pague a renovação para manter o Plano ${planName}. Depois, dá para assinar de novo quando quiser.`,
        action: "Pagar agora",
        tone: "danger",
      };
    case "closed":
      return {
        title: "A assinatura do plano foi encerrada",
        text: "Os dados continuam guardados. Assine de novo quando quiser.",
        action: "Ver os planos",
        tone: "warning",
      };
  }
}
