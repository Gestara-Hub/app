import { describe, expect, it } from "vitest";
import { contextRows, splitStack } from "../error-view";

const STACK = [
  "Error: Erro ao enviar o aviso de chamado: 422",
  "    at logFromArgs (/app/.next/server/chunks/ssr/a.js:895:46)",
  "    at sendSupportNotice (/app/.next/server/chunks/ssr/a.js:10235:167)",
  "    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)",
  "    at async handleAction (/app/node_modules/next/dist/server/app-render.js:62:25687)",
  "    at async escalate (/app/.next/server/chunks/ssr/a.js:10900:9)",
].join("\n");

describe("pilha do erro", () => {
  it("separa o erro, os quadros do app e os do framework", () => {
    const { head, appFrames, otherFrames } = splitStack(STACK);
    expect(head).toBe("Error: Erro ao enviar o aviso de chamado: 422");
    expect(appFrames.map((l) => /at (?:async )?(\w+)/.exec(l)?.[1])).toEqual(["logFromArgs", "sendSupportNotice", "escalate"]);
    expect(otherFrames).toHaveLength(2);
  });

  it("texto sem quadros fica inteiro na cabeça", () => {
    expect(splitStack("só uma mensagem")).toEqual({ head: "só uma mensagem", appFrames: [], otherFrames: [] });
  });
});

describe("contexto do erro", () => {
  it("rotula o que se conhece e deixa o resto como veio", () => {
    const rows = contextRows({ extra: "x", ms: 812, route: "/classes/abc", plan: "free", profile: "owner", release: "abc1234" });
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ["Tela", "/classes/abc"],
      ["Perfil", "owner"],
      ["Plano", "free"],
      ["Versão do app", "abc1234"],
      ["Tempo até o erro (ms)", "812"],
      ["extra", "x"],
    ]);
  });

  it("abre a causa do banco em detalhe e dica", () => {
    const rows = contextRows({ cause: { code: "23505", details: "Key (id)=(1) already exists.", hint: "Use outro id" } });
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ["Código do banco", "23505"],
      ["Detalhe do banco", "Key (id)=(1) already exists."],
      ["Dica do banco", "Use outro id"],
    ]);
  });

  it("contexto vazio não dá linha", () => {
    expect(contextRows({})).toEqual([]);
  });
});
