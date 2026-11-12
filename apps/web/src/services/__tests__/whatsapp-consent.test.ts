import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { clientsService } from "@/services/clients";
import { isOptOutText, samePhone } from "@/services/communication/whatsappOptOut";
import { resetAcademy } from "@/test/academy";

/**
 * Autorizacao para mensagens pelo WhatsApp (12/11/2026, doc product/27 M1 e
 * M2): o cadastro manda so a situacao; data e quem registrou sao do servidor.
 */
const OWNER = { userId: "usr-dono", name: "Ana Dona", profile: "owner" as const };

describe("autorização do WhatsApp no cadastro", () => {
  beforeEach(() => {
    resetAcademy();
    setCurrentActor(OWNER);
  });
  afterEach(() => setCurrentActor(OWNER));

  it("aluno novo sem a chave fica sem registro", async () => {
    const bia = await clientsService.create({ name: "Bia", status: "active" });
    expect(bia.whatsappConsentStatus).toBe("unknown");
    expect(bia.whatsappConsentAt).toBeUndefined();
  });

  it("autorizar carimba a data e quem registrou, ignorando o que o navegador mandou", async () => {
    const bia = await clientsService.create({
      name: "Bia",
      status: "active",
      whatsappConsentStatus: "granted",
      whatsappConsentAt: "2020-01-01T00:00:00.000Z",
      whatsappConsentBy: "Inventado",
    });
    expect(bia.whatsappConsentStatus).toBe("granted");
    expect(bia.whatsappConsentBy).toBe("Ana Dona (no cadastro)");
    expect(bia.whatsappConsentAt).not.toBe("2020-01-01T00:00:00.000Z");
  });

  it("editar sem mudar a situação mantém o carimbo; desmarcar vira 'pediu para parar'", async () => {
    const bia = await clientsService.create({ name: "Bia", status: "active", whatsappConsentStatus: "granted" });
    const same = await clientsService.update(bia.id, { name: "Bia Souza", whatsappConsentStatus: "granted" });
    expect(same.whatsappConsentAt).toBe(bia.whatsappConsentAt);

    setCurrentActor({ userId: "usr-atendente", name: "Carla", profile: "attendant" });
    const revoked = await clientsService.update(bia.id, { whatsappConsentStatus: "revoked", whatsappConsentBy: "Inventado" });
    expect(revoked.whatsappConsentStatus).toBe("revoked");
    expect(revoked.whatsappConsentBy).toBe("Carla (no cadastro)");
  });
});

describe("pedido para parar pelo WhatsApp", () => {
  it("reconhece SAIR, PARAR e CANCELAR em qualquer forma, e só a palavra", () => {
    for (const text of ["SAIR", "sair", " Sair. ", "PARAR!", "Pare", "cancelar", "Cancélar", "STOP"]) {
      expect(isOptOutText(text), text).toBe(true);
    }
    for (const text of ["quero sair da turma amanhã", "ok", "", undefined, "sair sair"]) {
      expect(isOptOutText(text), String(text)).toBe(false);
    }
  });

  it("mesmo número com ou sem o 9 e em qualquer formato", () => {
    expect(samePhone("+55 (11) 97777-0000", "5511977770000")).toBe(true);
    expect(samePhone("551177770000", "11977770000")).toBe(true);
    expect(samePhone("5511977770000", "5511966660000")).toBe(false);
    expect(samePhone(undefined, "5511977770000")).toBe(false);
  });
});
