import { describe, expect, it } from "vitest";
import { crumbRows, parseCrumbs } from "../crumbs-view";

describe("passos antes do erro", () => {
  it("lê só o que tem a forma certa", () => {
    expect(
      parseCrumbs([
        { s: 5, k: "nav", v: "/classes/:id" },
        { s: "5", k: "nav", v: "x" },
        { s: 1, k: "clique", v: "x" },
        { s: 1, k: "action", v: 7 },
        null,
        { s: 0, k: "action_error", v: "turmas.save (K7Q2M9XD)" },
      ]),
    ).toEqual([
      { s: 5, k: "nav", v: "/classes/:id" },
      { s: 0, k: "action_error", v: "turmas.save (K7Q2M9XD)" },
    ]);
    expect(parseCrumbs(null)).toEqual([]);
    expect(parseCrumbs({})).toEqual([]);
  });

  it("mostra quando, o tipo e o texto, na ordem em que aconteceu", () => {
    expect(
      crumbRows([
        { s: 3720, k: "nav", v: "/dashboard" },
        { s: 125, k: "action", v: "turmas.markAttendance" },
        { s: 12, k: "nav", v: "/classes/:id" },
        { s: 0, k: "action_error", v: "turmas.save" },
      ]).map((r) => [r.when, r.label, r.value]),
    ).toEqual([
      ["1 h antes", "Abriu a tela", "/dashboard"],
      ["2 min antes", "Ação", "turmas.markAttendance"],
      ["12 s antes", "Abriu a tela", "/classes/:id"],
      ["agora", "Ação com erro", "turmas.save"],
    ]);
  });
});
