import { describe, expect, it } from "vitest";
import { STATUS_LABEL, authorLabel, statusNote } from "../support-copy";

describe("textos do suporte", () => {
  it("cada situação tem rótulo e só as que esperam alguém têm aviso", () => {
    expect(Object.keys(STATUS_LABEL)).toEqual(["bot", "waiting_us", "waiting_customer", "resolved"]);
    expect(statusNote("bot")).toBeNull();
    expect(statusNote("waiting_us")).toContain("2 dias úteis");
    expect(statusNote("waiting_customer")).toContain("respondeu");
    expect(statusNote("resolved")).toContain("encerrada");
  });

  it("quem escreveu", () => {
    expect(authorLabel("customer")).toBe("Você");
    expect(authorLabel("bot")).toBe("Assistente");
    expect(authorLabel("staff", "Marcello")).toBe("Suporte · Marcello");
    expect(authorLabel("staff")).toBe("Suporte");
    expect(authorLabel("system")).toBe("");
  });
});
