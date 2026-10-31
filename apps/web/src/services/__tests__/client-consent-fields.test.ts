import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { clientsService } from "@/services/clients";
import { resetAcademy } from "@/test/academy";

/**
 * Cadastro do aluno (auditoria de 30/10/2026): o servidor decide a autorizacao
 * do menor e ignora graduacao e campos do sistema vindos do navegador.
 */

const MINOR = { name: "Gabi", phone: "11977770000", birthDate: "2015-05-05", status: "active" as const };

beforeEach(() => {
  resetAcademy();
  setCurrentActor({ userId: "usr-atendente", name: "Atendente", profile: "attendant" });
});

describe("autorização do menor pelo cadastro", () => {
  it("'autorizado pelo WhatsApp' não vem do cadastro: fica pendente", async () => {
    const created = await clientsService.create({
      ...MINOR,
      minorConsentStatus: "confirmed_whatsapp",
      minorConsentEvidence: { method: "whatsapp", ip: "forjado" },
    });
    expect(created.minorConsentStatus).toBe("pending");
    expect(created.minorConsentEvidence).toBeUndefined();
  });

  it("termo impresso ganha a prova do servidor (quem registrou), não a do navegador", async () => {
    const created = await clientsService.create({ ...MINOR, minorConsentStatus: "pending" });
    const updated = await clientsService.update(created.id, {
      minorConsentStatus: "confirmed_paper",
      minorConsentBy: "Mãe da Gabi",
      minorConsentEvidence: { method: "forjado" },
    });
    expect(updated.minorConsentStatus).toBe("confirmed_paper");
    expect(updated.minorConsentBy).toBe("Mãe da Gabi");
    expect(updated.minorConsentEvidence).toMatchObject({ method: "paper_form_declaration", recordedByUserId: "usr-atendente" });
  });

  it("autorização registrada não volta a pendente pelo cadastro", async () => {
    const created = await clientsService.create({ ...MINOR, minorConsentStatus: "confirmed_paper" });
    const updated = await clientsService.update(created.id, { minorConsentStatus: "pending" });
    expect(updated.minorConsentStatus).toBe("confirmed_paper");
  });
});

describe("campos que o cadastro não grava", () => {
  it("graduação, espaço e data de criação vindos do navegador são ignorados", async () => {
    const created = await clientsService.create({ name: "Rui", phone: "11977770001", status: "active" });
    const updated = await clientsService.update(created.id, {
      name: "Rui Souza",
      progressions: { "m-x": { levelId: "faixa-preta" } },
      organizationId: "outro-espaco",
      createdAt: "2020-01-01T00:00:00.000Z",
    } as never);
    expect(updated.name).toBe("Rui Souza");
    expect(updated.progressions).toEqual(created.progressions);
    expect(updated.organizationId).toBe(created.organizationId);
    expect(updated.createdAt).toBe(created.createdAt);
  });
});
