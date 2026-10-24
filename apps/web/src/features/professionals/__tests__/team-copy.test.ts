import { describe, expect, it } from "vitest";
import { teamSubtitle } from "../team-copy";

describe("subtítulo da Equipe (achado 22)", () => {
  it("no modelo de turmas não promete disponibilidade", () => {
    expect(teamSubtitle(true)).toBe("Quem dá aula na unidade.");
    expect(teamSubtitle(true)).not.toContain("disponibilidade");
  });

  it("no agendamento a disponibilidade continua", () => {
    expect(teamSubtitle(false)).toContain("disponibilidade");
  });
});
