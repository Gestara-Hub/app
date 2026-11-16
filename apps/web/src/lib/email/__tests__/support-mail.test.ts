import { describe, expect, it } from "vitest";
import { supportNoticeHtml, supportNoticeText } from "../support-mail";

const base = { number: 1042, urgent: false, subject: "Não consigo entrar", spaceName: "Espaço", userName: "Ana", userEmail: "ana@exemplo.com", preview: "Texto" };

describe("supportNoticeText", () => {
  it("coloca o protocolo no assunto e no corpo", () => {
    const novo = supportNoticeText({ ...base, kind: "new" });
    expect(novo.subject).toBe("[GH-1042] Novo chamado: Não consigo entrar");
    expect(novo.text).toContain("Protocolo: GH-1042");
    expect(supportNoticeText({ ...base, kind: "reply", urgent: true }).subject).toBe("[URGENTE] [GH-1042] Nova resposta do cliente: Não consigo entrar");
  });

  it("problema com código leva a tela e o código do erro no corpo", () => {
    const { text } = supportNoticeText({ ...base, kind: "new", topic: "bug", originScreen: "/classes/abc", errorReference: "K7Q2M9XD" });
    expect(text).toContain("Tela: /classes/abc");
    expect(text).toContain("Código do erro: K7Q2M9XD");
  });

  it("sem tela nem código, o corpo não tem essas linhas", () => {
    const { text } = supportNoticeText({ ...base, kind: "new" });
    expect(text).not.toContain("Tela:");
    expect(text).not.toContain("Código do erro:");
  });

  it("gera HTML no layout de alerta operacional com protocolo e prioridade", () => {
    const html = supportNoticeHtml({ ...base, kind: "reply", urgent: true, originScreen: "/classes/abc" });
    expect(html).toContain("GH-1042");
    expect(html).toContain("URGENTE");
    expect(html).toContain("/classes/abc");
    expect(html).toContain("Nova resposta do cliente");
  });
});
