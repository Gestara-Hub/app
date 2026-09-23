import { afterEach, beforeEach, vi } from "vitest";
import { mockConfig } from "@/mocks/config";
import { setCurrentActor } from "@/mocks/currentActor";

// "Hoje" fixo: status de atraso e datas de cadastro nao dependem do dia em que
// o teste roda. So o Date e congelado; timers seguem reais.
export const TODAY = "2026-09-22";

mockConfig.latencyMs = 0;
mockConfig.readErrorRate = 0;
mockConfig.persistence = false;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${TODAY}T12:00:00`) });
  setCurrentActor({ userId: "usr-ac-ana", name: "Ana Ribeiro", profile: "owner" });
});

afterEach(() => {
  vi.useRealTimers();
});
