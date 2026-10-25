import { describe, expect, it } from "vitest";
import { screenName } from "../screen-names";
import { HELP_CHUNKS, buildIndex, describeChunk, helpForRoute, parseHelpLinks, searchHelp, splitFirstSentence, tokens, withinOneEdit } from "../help-search";

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

describe("ajuda da tela atual", () => {
  it("traz os trechos da rota exata", () => {
    const hits = helpForRoute("/clients");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.route === "/clients")).toBe(true);
  });

  it("sem trecho na rota, usa a rota mais próxima acima", () => {
    const hits = helpForRoute("/clients/abc123");
    expect(hits[0]?.route).toBe("/clients");
  });

  it("rota sem artigo não traz nada", () => {
    expect(helpForRoute("/rota-que-nao-existe")).toEqual([]);
  });
});

describe("descrição curta do trecho", () => {
  it("separa a primeira frase do resto", () => {
    expect(splitFirstSentence('Em Turmas, clique em "Nova turma". Informe o nome e a capacidade.')).toEqual({
      first: 'Em Turmas, clique em "Nova turma".',
      rest: "Informe o nome e a capacidade.",
    });
  });

  it("lista: o primeiro item é a descrição e o resto são os outros itens", () => {
    expect(splitFirstSentence("1. Defina o horário. Em Configurações.\n2. Confira as modalidades.\n3. Crie os planos.")).toEqual({
      first: "1. Defina o horário. Em Configurações.",
      rest: "2. Confira as modalidades.\n3. Crie os planos.",
    });
    expect(splitFirstSentence("- Proprietário: tudo.\n- Gerente: opera o dia a dia.")).toEqual({
      first: "Proprietário: tudo.",
      rest: "- Gerente: opera o dia a dia.",
    });
  });

  it("trecho de uma frase só não tem resto", () => {
    expect(splitFirstSentence("Clique em Salvar.")).toEqual({ first: "Clique em Salvar.", rest: "" });
    expect(splitFirstSentence("Sem ponto final")).toEqual({ first: "Sem ponto final", rest: "" });
  });
});

describe("nome das telas", () => {
  it("toda rota dos artigos tem o nome da tela", () => {
    const missing = [...new Set(HELP_CHUNKS.map((chunk) => chunk.route).filter(Boolean))].filter((route) => !screenName(route));
    expect(missing).toEqual([]);
  });

  it("ignora a query da rota", () => {
    expect(screenName("/settings?tab=certificado")).toBe("Configurações");
    expect(screenName("/classes/calendar")).toBe("Calendário de turmas");
  });
});

describe("sinônimos e erro de digitação", () => {
  it("acha pelo sinônimo", () => {
    // "mensalidade" está escrito como "plano" em alguns trechos, e vice-versa.
    expect(searchHelp("como cobrar mensalidade").length).toBeGreaterThan(0);
    expect(searchHelp("apagar um aluno").length).toBeGreaterThan(0);
  });

  it("acha mesmo com uma letra errada", () => {
    expect(top("como pausar a asinatura de um aluno")[0]).toBe("alunos#pausar-a-assinatura");
    expect(top("como faço a chamda no celular")[0]).toBe("chamada#fazer-a-chamada");
  });

  it("erro de digitação não faz achar o que não tem", () => {
    expect(searchHelp("qual a previsão do tempo amanhã")).toEqual([]);
  });

  it("uma edição: troca, falta, sobra e letras vizinhas trocadas", () => {
    expect(withinOneEdit("chamada", "chamda")).toBe(true);
    expect(withinOneEdit("chamada", "chamadas")).toBe(true);
    expect(withinOneEdit("chamada", "chamdaa")).toBe(true);
    expect(withinOneEdit("chamada", "chamdea")).toBe(false);
    expect(withinOneEdit("aluno", "alnuo")).toBe(true);
    expect(withinOneEdit("aluno", "turma")).toBe(false);
  });
});

describe("resumo e links dos trechos", () => {
  it("o resumo escrito à mão vira a descrição e o texto inteiro abre no clique", () => {
    expect(describeChunk({ id: "a#b", article: "A", title: "B", summary: "Resumo curto.", text: "1. Primeiro.\n2. Segundo." })).toEqual({
      first: "Resumo curto.",
      rest: "1. Primeiro.\n2. Segundo.",
    });
  });

  it("sem resumo, vale a primeira frase", () => {
    expect(describeChunk({ id: "a#b", article: "A", title: "B", text: "Clique em Salvar. Depois confira." })).toEqual({
      first: "Clique em Salvar.",
      rest: "Depois confira.",
    });
  });

  it("separa texto e links; só rota do próprio app vira link", () => {
    expect(parseHelpLinks("Abra [Alunos](/clients) e depois [fora](https://x.com) ou [aba](/settings?tab=horarios).")).toEqual([
      { kind: "text", text: "Abra " },
      { kind: "link", text: "Alunos", href: "/clients" },
      { kind: "text", text: " e depois [fora](https://x.com) ou " },
      { kind: "link", text: "aba", href: "/settings?tab=horarios" },
      { kind: "text", text: "." },
    ]);
  });

  it("os links dos artigos apontam para telas que existem", () => {
    const known = new Set(["/clients", "/classes", "/classes/calendar", "/classes/billing", "/classes/modalities", "/classes/plans", "/audit", "/users", "/team", "/settings", "/finance", "/communication", "/reports", "/online-payments", "/plans", "/dashboard"]);
    const broken: string[] = [];
    for (const chunk of HELP_CHUNKS) {
      for (const part of parseHelpLinks(chunk.text)) {
        if (part.kind === "link" && !known.has(part.href.split("?")[0])) broken.push(`${chunk.id} -> ${part.href}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("o Painel tem artigo próprio, antes dos Primeiros passos", () => {
    const ids = helpForRoute("/dashboard").map((chunk) => chunk.id);
    expect(ids[0]).toBe("painel#os-numeros-do-dia");
    expect(ids).toContain("primeiros-passos#ordem-recomendada");
  });
});
