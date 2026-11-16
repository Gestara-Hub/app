/**
 * Mascara de dados pessoais e segredos no que vai para o log de erros (doc
 * technical/21, LGPD): CPF, CNPJ, telefone, e-mail, token, chave e senha nunca
 * sao gravados. Mascarar demais e aceitavel; de menos, nao.
 */

const SECRET_KEY = /pass|senha|token|secret|cpf|cnpj|authorization|cookie|api.?key|card|cartao|cvv/i;
const MAX_STRING = 2000;
/** A pilha é longa por natureza: os quadros do app costumam vir depois dos do framework. */
export const MAX_STACK = 8000;
const MAX_DEPTH = 4;
const MAX_KEYS = 40;

/** Sequência longa de letras e números: provavelmente chave. Num quadro de pilha é só o nome de um arquivo do pacote. */
const LONG_TOKEN = /\b[A-Za-z0-9_-]{40,}\b/g;

const RULES: [RegExp, string][] = [
  // Tokens e chaves conhecidos antes dos numeros (contem digitos).
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token]"],
  [/Bearer\s+\S+/gi, "Bearer [token]"],
  [/\$aact_\S+/g, "[token]"],
  [/\bmlsn\.\S+/g, "[token]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[token]"],
  [/\b(sk|pk|rk)_(live|test)_\w+/g, "[token]"],
  [/((?:api[_-]?key|token|secret|senha|password|access[_-]?token)["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, "$1[oculto]"],
  [LONG_TOKEN, "[token]"],
  // Documentos e contatos.
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[cnpj]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]"],
  [/\+?\b55\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, "[telefone]"],
  [/\(?\b\d{2}\)?\s?9\d{4}-?\d{4}\b/g, "[telefone]"],
  // Dominio comeca com letra e termina com extensao de letras: caminhos de pacotes
  // na pilha (`next@16.0.0_@babel+core@7.28`) nao sao e-mail.
  [/\b([\w.+-])[\w.+-]*@[a-z][\w-]*(\.[a-z][\w-]*)*\.[a-z]{2,24}\b/gi, "$1***@[email]"],
];

export function maskText(text: string, max = MAX_STRING): string {
  return applyRules(text.length > max ? `${text.slice(0, max)}...` : text, RULES);
}

function applyRules(text: string, rules: [RegExp, string][]): string {
  let out = text;
  for (const [pattern, replacement] of rules) out = out.replace(pattern, replacement);
  return out;
}

const RULES_WITHOUT_LONG_TOKEN = RULES.filter(([pattern]) => pattern !== LONG_TOKEN);
const FRAME = /^\s+at\s/;

/**
 * Máscara da pilha: as linhas de quadro ("    at fn (arquivo:linha:coluna)") não passam pela
 * regra de "token" longo, senão o nome do arquivo do pacote vira `[token]` e a
 * pilha perde onde o erro aconteceu. O resto (a primeira linha e o que não é
 * quadro) segue com todas as regras. Chave de verdade ainda sai pelas regras
 * de formato conhecido (JWT, Bearer, chaves do Asaas e do e-mail...).
 */
export function maskStack(stack: string, max = MAX_STACK): string {
  const cut = stack.length > max ? `${stack.slice(0, max)}...` : stack;
  return cut
    .split("\n")
    .map((line) => applyRules(line, FRAME.test(line) ? RULES_WITHOUT_LONG_TOKEN : RULES))
    .join("\n");
}

/** Copia mascarada de um valor qualquer (chaves sensiveis viram "[oculto]"). */
export function maskValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return maskText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) return { name: value.name, message: maskText(value.message) };
  if (depth >= MAX_DEPTH) return "[...]";
  if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((item) => maskValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      out[key] = SECRET_KEY.test(key) ? "[oculto]" : maskValue(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * Impressao digital do erro: o mesmo erro no mesmo lugar agrupa numa linha,
 * mesmo com ids, numeros e datas diferentes na mensagem.
 */
export function fingerprintOf(event: string, message: string, stack?: string): string {
  const normalized = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .slice(0, 300);
  const frame = stack
    ?.split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("at ") && !line.includes("node_modules") && !line.includes("/lib/log/"));
  const place = frame?.replace(/:\d+:\d+\)?$/, "") ?? "";
  return hash(`${event}|${normalized}|${place}`);
}

/** Dois FNV-1a de 32 bits (sementes diferentes) em hexa: roda no navegador e no servidor. */
function hash(text: string): string {
  const fnv = (seed: number) => {
    let h = seed;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  return fnv(0x811c9dc5) + fnv(0x01000193);
}

/** Codigo curto mostrado ao usuario ("codigo do erro: K7Q2M9XD"), sem letras confusas. */
export function newReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
