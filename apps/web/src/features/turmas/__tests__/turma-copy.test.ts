import { describe, expect, it } from "vitest";
import { capacityLabel, promoteWaitlistDescription, sessionLinkLabel } from "../turma-copy";

describe("cabeçalho da turma e lista de espera (achados 34 e 35)", () => {
  it("diz lotada só quando enche e quantos a mais quando passa", () => {
    expect(capacityLabel(1, 2)).toBe("1 de 2 alunos");
    expect(capacityLabel(2, 2)).toBe("Turma lotada");
    expect(capacityLabel(3, 2)).toBe("3 de 2 alunos (acima da capacidade)");
    expect(capacityLabel(2, 1)).toBe("2 de 1 aluno (acima da capacidade)");
  });

  it("o texto de promover não flexiona o gênero do aluno", () => {
    expect(promoteWaitlistDescription("Clara Nunes")).toBe(
      "A matrícula de Clara Nunes será feita na turma, mesmo que ela esteja lotada.",
    );
  });
});

describe("nome do bloco de aula na grade (achado 38)", () => {
  it("diz turma, dia, horário e quem dá a aula", () => {
    expect(
      sessionLinkLabel({ className: "Pilates Reformer", date: "2026-10-26", start: "08:00", end: "09:00", instructorName: "Ana" }),
    ).toBe("Pilates Reformer, segunda-feira, 26 de outubro, das 08:00 às 09:00, com Ana");
    expect(
      sessionLinkLabel({ className: "Yoga", date: "2026-10-27", start: "19:00", end: "20:00", instructorName: "Bia", isSubstitute: true }),
    ).toContain("com Bia (substituto)");
  });
});
