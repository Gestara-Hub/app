import { describe, expect, it } from "vitest";
import { charCount, normalizeText, withKind } from "@/lib/text";

describe("normalizeText", () => {
  it("remove acentos e cedilha", () => {
    expect(normalizeText("Natação Avançada")).toBe("natacao avancada");
    expect(normalizeText("Judô Karatê Ação")).toBe("judo karate acao");
  });

  it("deixa tudo em caixa baixa", () => {
    expect(normalizeText("JIU-JITSU")).toBe("jiu-jitsu");
  });

  it("tira espacos das pontas, mas preserva os do meio", () => {
    expect(normalizeText("  Muay   Thai  ")).toBe("muay   thai");
  });

  it("acentuado e sem acento ficam iguais (match de busca)", () => {
    expect(normalizeText("São Paulo")).toBe(normalizeText("sao paulo"));
  });

  it("texto vazio continua vazio", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText("   ")).toBe("");
  });
});

describe("withKind", () => {
  it("põe o tipo na frente só quando o nome não tem (ALU-19)", () => {
    expect(withKind("pacote", "10 aulas")).toBe("pacote 10 aulas");
    expect(withKind("pacote", "Pacote 10 aulas")).toBe("Pacote 10 aulas");
    expect(withKind("Curso", "curso de defesa")).toBe("curso de defesa");
    expect(withKind("curso", "Cursinho")).toBe("curso Cursinho");
  });
});

describe("charCount", () => {
  it("emoji conta 1 caractere (ALU-38)", () => {
    expect("🥋".length).toBe(2);
    expect(charCount("🥋")).toBe(1);
    expect(charCount("Bons treinos! 🥋🎉")).toBe(16);
    expect(charCount("")).toBe(0);
  });
});
