/**
 * Valor para `ilike` como busca exata, sem maiuscula/minuscula: `%` e `_` sao
 * curingas no LIKE (auditoria de 30/10/2026: "a%" no e-mail do cadastro
 * respondia se havia conta comecando com "a" e listava os e-mails da plataforma).
 */
export function likeExact(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
