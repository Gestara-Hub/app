/** Pagina publica que confirma um certificado (doc 21 §1.3). */
export const CERTIFICATE_VERIFY_PATH = "/p/certificado";

/**
 * Endereco completo da verificacao. No navegador usa a origem da pagina; no
 * servidor, o endereco publicado do app (`NEXT_PUBLIC_APP_URL`).
 */
export function certificateVerifyUrl(code: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.gestarahub.com.br").replace(/\/$/, "");
  return `${origin}${CERTIFICATE_VERIFY_PATH}/${code}`;
}
