import { afterEach, beforeEach, vi } from "vitest";
import { mockConfig } from "@/mocks/config";
import { setCurrentActor } from "@/mocks/currentActor";
import { setSliceChecker } from "@/services/world/delegate";
import { sliceFor } from "@/services/world/registry";
import { checkSlice } from "@/services/world/sliceCheck";

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

// Conferencia do recorte (doc 19, fase 2): WORLD_SLICE_CHECK=1 roda cada metodo
// com recorte tambem com o espaco inteiro e exige o mesmo resultado e gravacoes.
if (process.env.WORLD_SLICE_CHECK === "1") {
  setSliceChecker(async (name, args, call) => {
    const slice = await sliceFor(name);
    if (slice) await checkSlice(name, slice, args, call);
  });
}
