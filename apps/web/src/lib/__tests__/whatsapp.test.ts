import { describe, expect, it } from "vitest";
import { fillMessage, whatsappLink, whatsappNumber } from "@/lib/whatsapp";

describe("whatsappNumber", () => {
  it("celular com DDD ganha o DDI 55", () => {
    expect(whatsappNumber("(11) 99999-8888")).toBe("5511999998888");
  });

  it("fixo com DDD (10 digitos) ganha o DDI 55", () => {
    expect(whatsappNumber("(11) 3333-4444")).toBe("551133334444");
  });

  it("mantem numero que ja tem DDI", () => {
    expect(whatsappNumber("+55 (11) 99999-8888")).toBe("5511999998888");
    expect(whatsappNumber("5511999998888")).toBe("5511999998888");
  });

  it("menos de 10 digitos nao e telefone", () => {
    expect(whatsappNumber("99999-8888")).toBeNull();
    expect(whatsappNumber("123")).toBeNull();
  });

  it("tira o 0 de ligacao interurbana e o 00 internacional", () => {
    expect(whatsappNumber("011 99999-8888")).toBe("5511999998888");
    expect(whatsappNumber("00 55 11 99999-8888")).toBe("5511999998888");
  });

  it("vazio, null e undefined dao null", () => {
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappNumber(undefined)).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("usa api.whatsapp.com/send com telefone e texto", () => {
    const link = whatsappLink("(11) 99999-8888", "Oi Ana");
    expect(link).toBe("https://api.whatsapp.com/send?phone=5511999998888&text=Oi%20Ana");
    expect(link).not.toContain("wa.me");
  });

  it("emoji vai em UTF-8 percent-encoded e volta igual", () => {
    const text = "Parabéns pela faixa nova 🥋! Oss & até amanhã?";
    const link = whatsappLink("(11) 99999-8888", text);
    expect(link).toContain("%F0%9F%A5%8B");
    const encoded = link.split("&text=")[1];
    expect(decodeURIComponent(encoded)).toBe(text);
    expect(new URL(link).searchParams.get("text")).toBe(text);
    expect(new URL(link).searchParams.get("phone")).toBe("5511999998888");
  });

  it("telefone curto vai so com os digitos", () => {
    expect(whatsappLink("12-3", "oi")).toBe("https://api.whatsapp.com/send?phone=123&text=oi");
  });
});

describe("fillMessage", () => {
  it("troca todas as variaveis pelos valores", () => {
    expect(
      fillMessage("Olá {aluno}, sua mensalidade de {valor} vence em {vencimento}. Até, {aluno}!", {
        aluno: "Ana",
        valor: "R$ 150,00",
        vencimento: "10/10",
      }),
    ).toBe("Olá Ana, sua mensalidade de R$ 150,00 vence em 10/10. Até, Ana!");
  });

  it("frase com variavel sem valor sai inteira", () => {
    const content = "Olá {aluno}! Pague pelo link {link_pagamento}. Obrigado.";
    expect(fillMessage(content, { aluno: "Ana" })).toBe("Olá Ana! Obrigado.");
  });

  it("valor vazio conta como sem valor", () => {
    const content = "Olá {aluno}! Pague pelo link {link_pagamento}. Obrigado.";
    expect(fillMessage(content, { aluno: "Ana", link_pagamento: "" })).toBe("Olá Ana! Obrigado.");
  });

  it("variavel desconhecida tambem derruba a frase", () => {
    expect(fillMessage("Oi {aluno}. Seu código é {codigo}.", { aluno: "Bia" })).toBe("Oi Bia.");
  });

  it("sem variaveis restantes devolve o texto preenchido, sem espacos nas pontas", () => {
    expect(fillMessage("  Bom treino!  ", {})).toBe("Bom treino!");
    expect(fillMessage("  Oi {aluno}!  ", { aluno: "Caio" })).toBe("Oi Caio!");
  });

  it("mantem as quebras de linha ao tirar uma frase", () => {
    const content = "Olá {aluno}!\n\nSua mensalidade vence amanhã.\nPague: {link}";
    expect(fillMessage(content, { aluno: "Ana" })).toBe("Olá Ana!\n\nSua mensalidade vence amanhã.");
  });

  it("fim de linha fecha a frase, mesmo sem pontuacao", () => {
    expect(fillMessage("Olá {aluno}\nPague: {link}", { aluno: "Ana" })).toBe("Olá Ana");
    expect(fillMessage("Oi {aluno}\n\nLink: {link}\n\nBom treino", { aluno: "Bia" })).toBe("Oi Bia\n\nBom treino");
  });

  it("todas as frases com variavel sem valor somem", () => {
    expect(fillMessage("Oi {aluno}. Valor {valor}.", {})).toBe("");
  });
});
