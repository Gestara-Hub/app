import type { SupabaseClient } from "@supabase/supabase-js";
import type { Subscription } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { sendPlanNoticeEmail } from "@/lib/email/ses";
import { subscriptionTierLabel } from "@/lib/labels";
import { afterResponse } from "@/lib/after-response";

/**
 * E-mails do Plano GestaraHub ao dono e ao gerente (doc product/13 §6). Os
 * avisos da renovacao vem da rotina diaria; o de pagamento confirmado sai
 * quando o pagamento e conferido. O Asaas nao manda e-mail ao cliente da
 * assinatura (19/11/2026): estes sao os nossos, com a marca do GestaraHub.
 */

export interface PlanEmailNotice {
  title: string;
  text: string;
  action: string;
  actionUrl: string;
}

/** Endereco do app nos botoes (fora do pedido de uma tela: webhook e rotinas). */
export function planEmailAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://gestarahub.com.br").replace(/\/+$/, "");
}

/** Manda o aviso a cada dono e gerente ativo do espaco; devolve quantos sairam. */
export async function notifyPlanManagers(
  admin: SupabaseClient,
  organizationId: string,
  notice: PlanEmailNotice,
): Promise<number> {
  const { data: users } = await admin
    .from("users")
    .select("name, email")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("profile", ["owner", "manager"]);
  // Todos ao mesmo tempo (antes um por vez).
  const results = await Promise.all(
    (users ?? [])
      .filter((user) => user.email)
      .map((user) =>
        sendPlanNoticeEmail({
          toEmail: String(user.email),
          toName: String(user.name ?? ""),
          title: notice.title,
          text: notice.text,
          actionLabel: notice.action,
          actionUrl: notice.actionUrl,
        }),
      ),
  );
  return results.filter((res) => res.ok).length;
}

/** "19/12" de "2026-12-19". */
const ddmm = (date: string | undefined) => (date ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : "");

export type PlanPaidKind = "activated" | "renewed" | "reactivated";

/** Textos do pagamento confirmado: plano ligado, renovado ou religado. */
export function planPaidNotice(kind: PlanPaidKind, subscription: Subscription, appUrl: string): PlanEmailNotice {
  const plan = `Plano ${subscriptionTierLabel(subscription.tier)}`;
  const amount = subscription.priceCents ? `${formatCents(subscription.priceCents)}` : "o pagamento";
  const until = subscription.renewsOn ? ` Pago até ${ddmm(subscription.renewsOn)}.` : "";
  const actionUrl = `${appUrl}/settings?tab=plano`;
  switch (kind) {
    case "activated":
      return {
        title: `${plan} ativo`,
        text: `Recebemos ${amount} e o ${plan} já está ativo.${until}`,
        action: "Abrir o GestaraHub",
        actionUrl,
      };
    case "renewed":
      return {
        title: "Pagamento do plano confirmado",
        text: `Recebemos ${amount} da renovação do ${plan}.${until}`,
        action: "Ver o plano",
        actionUrl,
      };
    case "reactivated":
      return {
        title: `${plan} religado`,
        text: `Recebemos ${amount} da renovação atrasada e o ${plan} voltou.${until}`,
        action: "Abrir o GestaraHub",
        actionUrl,
      };
  }
}

/**
 * Pagamento do plano confirmado: e-mail ao dono e ao gerente. Falha no envio
 * nao desfaz o pagamento conferido (fica no registro de erros).
 */
export async function notifyPlanPaid(
  admin: SupabaseClient,
  organizationId: string,
  kind: PlanPaidKind,
  subscription: Subscription,
): Promise<void> {
  // Depois da resposta (19/11/2026): checkout, "ja paguei?" e webhook nao esperam o e-mail.
  await afterResponse("E-mail de pagamento do plano", () =>
    notifyPlanManagers(admin, organizationId, planPaidNotice(kind, subscription, planEmailAppUrl())),
  );
}
