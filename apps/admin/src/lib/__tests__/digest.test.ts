import { describe, expect, it } from "vitest";
import { buildDigest, type DigestThread } from "../digest";

const now = new Date("2026-10-26T15:00:00Z"); // segunda
const thread = (over: Partial<DigestThread>): DigestThread => ({
  subject: "Dúvida",
  organizationName: "Academia X",
  userName: "Ana",
  urgent: false,
  since: new Date("2026-10-26T12:00:00Z"),
  ...over,
});

describe("resumo diário do suporte", () => {
  it("sem conversa esperando, não manda nada", () => {
    expect(buildDigest({ threads: [], waitingCustomer: 3, now, panelUrl: "https://admin.exemplo" })).toBeNull();
  });

  it("conta, destaca urgentes e atrasadas e mostra o prazo", () => {
    const digest = buildDigest({
      threads: [
        thread({ subject: "Pix não caiu", urgent: true, since: new Date("2026-10-21T12:00:00Z") }), // atrasada
        thread({ subject: "Como pauso" }),
      ],
      waitingCustomer: 2,
      now,
      panelUrl: "https://admin.exemplo",
    })!;
    expect(digest.subject).toBe("Suporte GestaraHub: 2 conversas esperam resposta (1 atrasada)");
    expect(digest.text).toContain("2 conversas esperam resposta, 1 urgente.");
    expect(digest.text).toContain("2 aguardando o cliente.");
    expect(digest.text.indexOf("Pix não caiu")).toBeLessThan(digest.text.indexOf("Como pauso"));
    expect(digest.text).toContain("[URGENTE] Pix não caiu");
    expect(digest.text).toContain("Atrasado, prazo 23/10/2026");
    expect(digest.text).toContain("https://admin.exemplo/support");
  });

  it("limita a lista e diz quantas ficaram de fora", () => {
    const many = Array.from({ length: 20 }, (_, i) => thread({ subject: `Conversa ${i}` }));
    const digest = buildDigest({ threads: many, waitingCustomer: 0, now, panelUrl: "https://admin.exemplo" })!;
    expect(digest.text).toContain("... e mais 5.");
    expect(digest.text.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(15);
  });
});
