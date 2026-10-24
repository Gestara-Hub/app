import { describe, expect, it } from "vitest";
import { substituteLabel, substituteOptions } from "../substitutes";

const team = [
  { id: "p-bruna", name: "Bruna Lima", modalityIds: ["m-yoga"] },
  { id: "p-ana", name: "Ana Souza", modalityIds: ["m-pilates"] },
  { id: "p-caio", name: "Caio Reis", modalityIds: ["m-pilates", "m-yoga"] },
  { id: "p-titular", name: "Zeca Titular", modalityIds: ["m-pilates"] },
];

describe("Trocar instrutor: lista de substitutos (achado 41)", () => {
  it("titular primeiro, depois quem dá a modalidade, por fim os outros", () => {
    const options = substituteOptions(team, "m-pilates", "p-titular");
    expect(options.map((o) => o.id)).toEqual(["p-titular", "p-ana", "p-caio", "p-bruna"]);
  });

  it("avisa no nome de quem não dá aula da modalidade, sem tirar da lista", () => {
    const bruna = substituteOptions(team, "m-pilates", "p-titular").find((o) => o.id === "p-bruna")!;
    expect(substituteLabel(bruna)).toBe("Bruna Lima (não dá aula desta modalidade)");
    expect(substituteLabel(substituteOptions(team, "m-pilates", "p-titular")[0])).toBe("Zeca Titular (titular da turma)");
  });

  it("sem modalidade conhecida, ninguém é marcado", () => {
    expect(substituteOptions(team, undefined, "p-titular").every((o) => o.teaches)).toBe(true);
  });
});
