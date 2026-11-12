import { describe, expect, it } from "vitest";
import { isReadMethod } from "../delegate";
import { SERVICE_NAMESPACES } from "../registry";

/**
 * Leituras vao pela rota `/api/svc`, em paralelo; gravacoes pela server action,
 * uma por vez (11/11/2026). O nome decide o caminho.
 */
describe("caminho das chamadas ao servidor", () => {
  it("leitura pelo nome; gravacao fica na action", () => {
    for (const name of ["list", "listCharges", "getOrganization", "getReminderSources", "searchClients", "countUnread", "previewCharges"]) {
      expect(isReadMethod(name), name).toBe(true);
    }
    for (const name of ["generateCharges", "markPaid", "create", "update", "enroll", "listen", "getter", "settle", "sendMessage"]) {
      expect(isReadMethod(name), name).toBe(false);
    }
  });

  it("nenhum metodo com efeito externo (Asaas, WhatsApp) tem nome de leitura", () => {
    const external = Object.values(SERVICE_NAMESPACES).flatMap((ns) => ns.noRetry ?? []);
    expect(external.length).toBeGreaterThan(0);
    expect(external.filter(isReadMethod)).toEqual([]);
  });
});
