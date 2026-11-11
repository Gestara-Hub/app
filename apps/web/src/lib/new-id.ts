import type { Id } from "@gestarahub/contracts";

/**
 * Id novo (UUID v4). Nunca chame `crypto.randomUUID()` direto: falha em http
 * na rede local (http://192.168.x.x). Servicos usam pelo `newId` de
 * `services/world/ops`; telas que criam linhas antes de salvar (ex.: quem
 * conduz o evento, que os dias apontam) usam daqui.
 */
export function newId(): Id {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Sem randomUUID (http na rede local): UUID v4 com getRandomValues.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r =
      typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
        ? crypto.getRandomValues(new Uint8Array(1))[0] & 15
        : (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
