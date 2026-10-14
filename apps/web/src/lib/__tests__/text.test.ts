import { describe, expect, it } from "vitest";
import { normalizeText } from "@/lib/text";

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
