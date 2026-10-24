import { describe, expect, it } from "vitest";
import { capacityLabel, promoteWaitlistDescription } from "../turma-copy";

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
