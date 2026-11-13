/**
 * Endereco publico da cobranca online (/p/<codigo>, pagina em
 * app/(marketing)/p): vai nas mensagens no lugar do Pix solto ou do link do
 * parceiro. Base: NEXT_PUBLIC_APP_URL; sem ela, o endereco aberto no navegador.
 */
export function paymentPageUrl(publicCode: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/+$/, "")}/p/${publicCode}`;
}

/**
 * Endereço público da fatura da cobrança (/p/c/<chargeId>):
 * Permite ao aluno escolher o método de pagamento e informar o CPF caso ainda não tenha.
 */
export function chargeInvoiceUrl(chargeId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/+$/, "")}/p/c/${chargeId}`;
}

/** Endereço público do ingresso, que também é a página da inscrição no evento (/p/i/<código>). */
export function ticketPageUrl(ticketCode: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/+$/, "")}/p/i/${ticketCode}`;
}
