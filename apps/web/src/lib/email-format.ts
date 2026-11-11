/**
 * Formato de e-mail (algo@dominio.tld), o mesmo na tela e no servidor
 * (10/11/2026). Fora do RHF (E-mail de acesso, login, esqueci a senha) a tela
 * confere antes de enviar; o servidor confere de novo.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}
