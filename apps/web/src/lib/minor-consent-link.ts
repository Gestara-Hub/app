/**
 * Link da autorizacao do responsavel (LGPD, Art. 14) que vai pelo WhatsApp.
 * Base: NEXT_PUBLIC_APP_URL (o endereco publico do app); sem ela, o endereco
 * aberto no navegador. Assim o link nao herda o protocolo nem o host da aba.
 */
export function minorConsentUrl(studentId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/+$/, "")}/consent/minor/${studentId}`;
}
