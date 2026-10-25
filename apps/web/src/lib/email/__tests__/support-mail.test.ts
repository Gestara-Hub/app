import { describe, expect, it } from "vitest";
import { supportNoticeText } from "../support-mail";

const base = { number: 1042, urgent: false, subject: "Não consigo entrar", spaceName: "Espaço", userName: "Ana", userEmail: "ana@exemplo.com", preview: "Texto" };

describe("supportNoticeText", () => {
  it("coloca o protocolo no assunto e no corpo", () => {
    const novo = supportNoticeText({ ...base, kind: "new" });
    expect(novo.subject).toBe("[GH-1042] Novo chamado: Não consigo entrar");
    expect(novo.text).toContain("Protocolo: GH-1042");
    expect(supportNoticeText({ ...base, kind: "reply", urgent: true }).subject).toBe("[URGENTE] [GH-1042] Nova resposta do cliente: Não consigo entrar");
  });
});
