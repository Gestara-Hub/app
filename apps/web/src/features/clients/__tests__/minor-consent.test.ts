import { describe, expect, it, vi } from "vitest";
import { minorConsentAlertDetail } from "../minor-consent";

vi.mock("@gestarahub/core/date", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@gestarahub/core/date")>()),
  todayISO: () => "2026-10-23",
}));

describe("aviso do termo do menor na ficha (achado 44)", () => {
  it("avisa quando a lista marca Termo pendente, mesmo com o status 'não se aplica'", () => {
    const detail = minorConsentAlertDetail({
      birthDate: "2020-05-01",
      minorConsentStatus: "not_applicable",
      guardians: [{ name: "Mãe" }],
    });
    expect(detail).toBe("O consentimento dos pais ou responsável ainda não foi confirmado.");
  });

  it("sem responsável cadastrado, pede o cadastro", () => {
    expect(minorConsentAlertDetail({ birthDate: "2020-05-01" })).toContain("Nenhum responsável cadastrado");
  });

  it("não avisa para adulto nem para termo confirmado", () => {
    expect(minorConsentAlertDetail({ birthDate: "1990-05-01", minorConsentStatus: "not_applicable" })).toBeNull();
    expect(minorConsentAlertDetail({ birthDate: "2020-05-01", minorConsentStatus: "confirmed_paper" })).toBeNull();
  });
});
