/**
 * Mascaras de dados pessoais para as rotas publicas (sem login, abertas por
 * link que circula por WhatsApp): decisao do usuario de 30/10/2026, doc
 * product/24. O servidor mascara antes de mandar para a pagina; o dado
 * inteiro nunca vai para o navegador de quem so tem o link.
 */

const NAME_CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

/** "Ana Souza Lima" vira "Ana S. L."; so o primeiro nome fica inteiro. */
export function maskPersonName(name: string | null | undefined): string {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  const [first, ...rest] = parts;
  const initials = rest
    .filter((part) => !NAME_CONNECTORS.has(part.toLowerCase()))
    .map((part) => `${part.charAt(0).toUpperCase()}.`);
  return [first, ...initials].join(" ");
}

/** "52998224725" vira "***.982.247-**" (o padrao do gov.br). Sem 11 digitos, nada. */
export function maskCpf(cpf: string | null | undefined): string | undefined {
  const digits = String(cpf ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return undefined;
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/** "2015-05-05" vira "**\/**\/2015": so o ano. */
export function maskBirthDate(date: string | null | undefined): string | undefined {
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(String(date ?? ""));
  return match ? `**/**/${match[1]}` : undefined;
}

/** "+5511999998888" vira "(**) *****-8888": so os 4 ultimos digitos. */
export function maskPhone(phone: string | null | undefined): string | undefined {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return undefined;
  return `(**) *****-${digits.slice(-4)}`;
}
