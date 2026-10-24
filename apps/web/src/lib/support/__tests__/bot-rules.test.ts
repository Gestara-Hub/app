import { describe, expect, it } from "vitest";
import {
  HUMAN_MARKER,
  buildSystemPrompt,
  checkQuota,
  estimateCostCents,
  looksUrgent,
  maskSensitive,
  parseReply,
  sourcesOf,
  subjectFrom,
  summaryFrom,
} from "../bot-rules";
import { searchHelp } from "../help-search";

describe("o que vai ao modelo", () => {
  it("mascara CPF, CNPJ, e-mail, telefone e cartão", () => {
    const masked = maskSensitive(
      "Meu CPF é 529.982.247-25, CNPJ 11.222.333/0001-81, e-mail ana@teste.com, fone (11) 98888-7777 e cartão 4111 1111 1111 1111.",
    );
    expect(masked).not.toMatch(/529\.982|11\.222|ana@|98888|4111/);
    expect(masked).toContain("[CPF]");
    expect(masked).toContain("[CNPJ]");
    expect(masked).toContain("[e-mail]");
    expect(masked).toContain("[telefone]");
  });

  it("o pedido traz as regras, os trechos achados e o marcador de humano", () => {
    const prompt = buildSystemPrompt(searchHelp("pausar aluno", 2));
    expect(prompt).toContain("SOMENTE os trechos da ajuda");
    expect(prompt).toContain("Pausar a assinatura");
    expect(prompt).toContain(HUMAN_MARKER);
    expect(prompt).toContain("Nunca prometa reembolso");
    expect(buildSystemPrompt([])).toContain("(nenhum trecho encontrado)");
  });
});

describe("resposta do modelo", () => {
  it("lê o marcador e tira ele do texto", () => {
    expect(parseReply(`Confira o Pix.\n${HUMAN_MARKER}`)).toEqual({ text: "Confira o Pix.", needsHuman: true });
    expect(parseReply("É em Cobranças.")).toEqual({ text: "É em Cobranças.", needsHuman: false });
  });

  it("fontes: no máximo 3, sem repetir o artigo", () => {
    const sources = sourcesOf(searchHelp("aluno pausar cadastrar inativar cobrança", 6));
    expect(sources.length).toBeLessThanOrEqual(3);
    expect(new Set(sources.map((s) => s.article)).size).toBe(sources.length);
  });
});

describe("urgência, assunto e resumo", () => {
  it("marca como urgente quem não consegue entrar, cobrar ou receber", () => {
    expect(looksUrgent(["Não consigo entrar no sistema"])).toBe(true);
    expect(looksUrgent(["não estou conseguindo receber pelo Pix"])).toBe(true);
    expect(looksUrgent(["o sistema parou"])).toBe(true);
    expect(looksUrgent(["o botão de salvar é pequeno"])).toBe(false);
    expect(looksUrgent(["a cobrança foi duplicada"])).toBe(true);
    expect(looksUrgent(["como crio uma turma?"])).toBe(false);
  });

  it("assunto é a primeira frase, curta", () => {
    expect(subjectFrom("Como pauso um aluno? Preciso hoje.")).toBe("Como pauso um aluno?");
    expect(subjectFrom("a".repeat(200))).toHaveLength(80);
    expect(subjectFrom("   ")).toBe("Nova conversa");
  });

  it("resumo junta as mensagens da pessoa e corta", () => {
    expect(summaryFrom(["Oi", "  Preciso   de ajuda "])).toBe("Oi | Preciso de ajuda");
    expect(summaryFrom(["x".repeat(600)], 100)).toHaveLength(100);
  });
});

describe("limites do assistente", () => {
  const base = { user_today: 3, user_limit: 30, space_today: 10, space_limit: 150, month_cost_cents: 1000, budget_cents: 15000 };

  it("libera dentro dos limites e bloqueia por pessoa, espaço e gasto", () => {
    expect(checkQuota(base)).toEqual({ ok: true });
    expect(checkQuota({ ...base, user_today: 31 })).toEqual({ ok: false, reason: "user" });
    expect(checkQuota({ ...base, space_today: 151 })).toEqual({ ok: false, reason: "space" });
    expect(checkQuota({ ...base, month_cost_cents: 15000 })).toEqual({ ok: false, reason: "budget" });
  });

  it("estima o custo em centavos, arredondando para cima", () => {
    expect(estimateCostCents({ inputTokens: 2000, outputTokens: 300 }, { input: 550, output: 2750 })).toBe(2);
    expect(estimateCostCents({ inputTokens: 0, outputTokens: 0 }, { input: 550, output: 2750 })).toBe(0);
  });
});

describe("máscara do cartão", () => {
  it("o cartão some inteiro, com espaços, hífens ou colado, sem sobrar pedaço", () => {
    for (const card of ["4111 1111 1111 1111", "4111-1111-1111-1111", "4111111111111111"]) {
      const masked = maskSensitive(`Meu cartão ${card} foi recusado`);
      expect(masked).toBe("Meu cartão [número] foi recusado");
    }
  });

  it("segue mascarando CPF, CNPJ, e-mail e telefone", () => {
    expect(maskSensitive("CPF 529.982.247-25")).toBe("CPF [CPF]");
    expect(maskSensitive("CNPJ 11.222.333/0001-81")).toBe("CNPJ [CNPJ]");
    expect(maskSensitive("ana@teste.com")).toBe("[e-mail]");
    expect(maskSensitive("(11) 98765-4321")).toBe("[telefone]");
  });
});
