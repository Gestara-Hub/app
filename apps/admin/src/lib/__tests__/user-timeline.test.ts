import { describe, expect, it } from "vitest";
import { actionTitle, buildTimeline, type TimelineItem } from "../user-timeline";

const at = (iso: string) => new Date(iso);

describe("linha do tempo da pessoa", () => {
  it("ordena da mais nova para a mais antiga, misturando erros, ações e conversas", () => {
    const errors: TimelineItem[] = [{ kind: "error", at: at("2026-10-25T10:05:00Z"), title: "support.send", failed: true }];
    const actions: TimelineItem[] = [
      { kind: "action", at: at("2026-10-25T10:00:00Z"), title: "Criou · cobrança" },
      { kind: "action", at: at("2026-10-25T10:10:00Z"), title: "Atualizou · aluno" },
    ];
    const threads: TimelineItem[] = [{ kind: "thread", at: at("2026-10-25T10:07:00Z"), title: "Não marca presença" }];
    expect(buildTimeline(errors, actions, threads).map((i) => i.title)).toEqual(["Atualizou · aluno", "Não marca presença", "support.send", "Criou · cobrança"]);
  });

  it("no mesmo instante, o erro vem antes da ação e da conversa", () => {
    const same = at("2026-10-25T10:00:00Z");
    const items = buildTimeline(
      [{ kind: "thread", at: same, title: "c" }],
      [{ kind: "action", at: same, title: "a" }],
      [{ kind: "error", at: same, title: "e" }],
    );
    expect(items.map((i) => i.kind)).toEqual(["error", "action", "thread"]);
  });

  it("título da ação: verbo e tipo do alvo, nunca nome", () => {
    expect(actionTitle("created", "message_log")).toBe("Criou · mensagem de WhatsApp");
    expect(actionTitle("status_changed", "charge")).toBe("Mudou a situação de · cobrança");
    expect(actionTitle("updated", null)).toBe("Atualizou");
  });

  it("ação ou alvo que o app ainda não rotulou aparece como veio", () => {
    expect(actionTitle("exported", "report")).toBe("exported · report");
  });

  it("lista vazia dá linha do tempo vazia", () => {
    expect(buildTimeline([], [], [])).toEqual([]);
  });
});
