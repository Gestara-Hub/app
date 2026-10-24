import { describe, expect, it } from "vitest";
import { HELP_CHUNKS, buildIndex, searchHelp, tokens } from "../help-search";

const top = (query: string) => searchHelp(query, 3).map((hit) => hit.id);

describe("busca na central de ajuda", () => {
  it("a base tem trechos de todos os artigos", () => {
    expect(HELP_CHUNKS.length).toBeGreaterThan(50);
    for (const chunk of HELP_CHUNKS) {
      expect(chunk.text.length).toBeGreaterThan(20);
      expect(chunk.id).toMatch(/^[a-z0-9-]+#[a-z0-9-]+$/);
    }
  });

  it("ignora acento, maiúscula e palavras de ligação", () => {
    expect(tokens("Como eu PAUSO a assinatura do aluno?")).toEqual(["pauso", "assinatura", "aluno"]);
  });

  it("acha o trecho certo para as perguntas mais comuns", () => {
    expect(top("como pausar a assinatura de um aluno")[0]).toBe("alunos#pausar-a-assinatura");
    expect(top("como marcar uma cobrança como paga")[0]).toBe("cobrancas#marcar-como-pago");
    expect(top("quanto é a taxa do pix")).toContain("recebimentos-online#taxas");
    expect(top("como faço a chamada no celular")[0]).toBe("chamada#fazer-a-chamada");
    expect(top("o que o plano profissional tem a mais")).toContain("plano-gestarahub#o-que-o-profissional-acrescenta");
    expect(top("enviar mensagem para vários alunos no whatsapp")).toContain("comunicacao-e-lembretes#enviar-uma-mensagem");
    expect(top("trocar o instrutor de uma aula")).toContain("turmas-e-matriculas#trocar-a-pessoa-de-uma-aula");
  });

  it("pergunta fora do assunto não traz nada", () => {
    expect(searchHelp("qual a previsão do tempo amanhã")).toEqual([]);
    expect(searchHelp("")).toEqual([]);
  });

  it("respeita o limite e ordena por relevância", () => {
    const hits = searchHelp("aluno cobrança plano", 2);
    expect(hits).toHaveLength(2);
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score);
  });

  it("índice vazio não quebra", () => {
    expect(searchHelp("aluno", 3, buildIndex([]))).toEqual([]);
  });
});
