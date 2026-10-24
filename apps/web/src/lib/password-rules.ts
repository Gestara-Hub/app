/**
 * Regra de senha de todas as telas de entrada: criar conta, convite, nova senha
 * e redefinir (achado 14 do teste de 23/10). O servidor confere de novo.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function isPasswordLongEnough(password: string | undefined | null): boolean {
  return (password ?? "").length >= MIN_PASSWORD_LENGTH;
}

/** "A senha deve ter pelo menos 8 caracteres." */
export const PASSWORD_TOO_SHORT_MESSAGE = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
