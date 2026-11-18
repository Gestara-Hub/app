/**
 * Quem paga o WhatsApp automatico (17/11/2026, doc technical/07 §1.5): a conta
 * do WhatsApp conectada e do espaco, na Meta, e a Meta cobra cada mensagem
 * automatica na forma de pagamento dessa conta. O GestaraHub so automatiza o
 * envio pelos modelos aprovados. Textos num lugar so, para planos, checkout,
 * Comunicacao e ajuda dizerem o mesmo.
 */

/** Faturamento da conta do WhatsApp do espaco na Meta (Billing Hub). */
export const META_BILLING_URL = "https://business.facebook.com/billing_hub/accounts";

/** Frase curta para listas de recursos do plano. */
export const META_COST_SHORT = "Mensagens automáticas pagas por você, direto à Meta";

/** Explicacao completa, em itens curtos. */
export const META_COST_POINTS: readonly string[] = [
  "A conta do WhatsApp conectada é sua, na Meta.",
  "A Meta cobra cada mensagem automática no cartão dessa conta.",
  "O GestaraHub não cobra pelas mensagens: só automatiza o envio.",
  "Mensagem automática usa modelo aprovado pela Meta: é o único jeito de escrever para quem não falou com você antes.",
  "Responder quem escreveu para você nas últimas 24 horas é grátis, até 1.000 respostas por mês.",
  "Sem cartão na Meta, as mensagens automáticas não saem.",
];
