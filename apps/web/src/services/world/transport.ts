/**
 * Argumentos das actions de servico (doc 15). Na ida ao servidor, propriedade
 * com valor `undefined` some, e "limpar o campo" (nome da area personalizada,
 * validade do pacote) virava "nao mexer". Aqui `undefined` vai marcado e volta
 * a ser `undefined` no servidor.
 */

const UNDEFINED = "__gestarahub_undefined__";

export function encodeArgs(value: unknown): unknown {
  if (value === undefined) return UNDEFINED;
  if (Array.isArray(value)) return value.map(encodeArgs);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeArgs(v)]));
  }
  return value;
}

export function decodeArgs(value: unknown): unknown {
  if (value === UNDEFINED) return undefined;
  if (Array.isArray(value)) return value.map(decodeArgs);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeArgs(v)]));
  }
  return value;
}
