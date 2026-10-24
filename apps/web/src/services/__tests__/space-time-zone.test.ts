import { afterEach, describe, expect, it, vi } from "vitest";
import { currentSpaceTimeZone, dateInSpace, setSpaceTimeZoneProvider } from "@gestarahub/core/date";
import { notAfterAsaasToday } from "@/lib/asaas/dates";
import { requestTimeZone, runWithErrorScope, setErrorScope } from "@/lib/log/server-sink";
import { todayISO as billingToday } from "../billing/billingHelpers";
import { currentCompetence } from "../finance/financeHelpers";

// Achado 60 do teste geral: o "hoje" e o dia de um pagamento saem do fuso do
// espaco, em qualquer um dos quatro fusos do Brasil, e nao do fuso do servidor
// (UTC na Vercel) nem do aparelho.

afterEach(() => {
  setSpaceTimeZoneProvider(undefined);
  vi.useRealTimers();
});

describe("fuso do espaço", () => {
  it("o hoje dos serviços segue o fuso do espaço", () => {
    // 1/11 03:30 UTC: 0h30 do dia 1 em Brasília, 23h30 do dia 31/10 em Manaus.
    vi.useFakeTimers({ now: new Date("2026-11-01T03:30:00.000Z"), toFake: ["Date"] });
    setSpaceTimeZoneProvider(() => "America/Sao_Paulo");
    expect(billingToday()).toBe("2026-11-01");
    expect(currentCompetence()).toBe("2026-11");
    setSpaceTimeZoneProvider(() => "America/Manaus");
    expect(billingToday()).toBe("2026-10-31");
    expect(currentCompetence()).toBe("2026-10");
  });

  it("pagamento às 21h41 de Brasília fica no mesmo dia (não no dia seguinte do UTC)", () => {
    setSpaceTimeZoneProvider(() => "America/Sao_Paulo");
    expect(dateInSpace("2026-10-24T00:41:00.000Z")).toBe("2026-10-23");
    setSpaceTimeZoneProvider(() => "America/Rio_Branco");
    expect(dateInSpace("2026-10-24T04:30:00.000Z")).toBe("2026-10-23");
  });

  it("a sessão anota o fuso na requisição, e a ação lê dele", async () => {
    await runWithErrorScope(async () => {
      setErrorScope({ organizationId: "org", userId: "user", timeZone: "America/Manaus" });
      expect(requestTimeZone()).toBe("America/Manaus");
      // O provedor do servidor e o do escopo da requisicao.
      setSpaceTimeZoneProvider(() => requestTimeZone());
      expect(currentSpaceTimeZone()).toBe("America/Manaus");
    });
  });

  it("o Asaas não recebe data depois do hoje dele (Noronha à noite)", () => {
    // 24/10 02:30 UTC: 0h30 do dia 24 em Noronha, 23h30 do dia 23 em Brasília.
    vi.useFakeTimers({ now: new Date("2026-10-24T02:30:00.000Z"), toFake: ["Date"] });
    const spaceDay = dateInSpace(new Date(), "America/Noronha");
    expect(spaceDay).toBe("2026-10-24");
    expect(notAfterAsaasToday(spaceDay)).toBe("2026-10-23");
    expect(notAfterAsaasToday("2026-10-22")).toBe("2026-10-22");
  });
});
