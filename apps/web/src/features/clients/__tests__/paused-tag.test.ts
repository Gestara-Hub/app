import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PausedTag } from "../components/paused-tag";

describe("ficha do aluno trancado (achado 27, parte da exibição)", () => {
  it("o selo diz Trancado, como na lista", () => {
    expect(renderToStaticMarkup(createElement(PausedTag))).toContain("Trancado");
  });

  it("a ficha mostra o selo quando a assinatura está trancada", () => {
    const profile = readFileSync(fileURLToPath(new URL("../components/student-profile-view.tsx", import.meta.url)), "utf8");
    expect(profile).toContain('student.membershipStatus === "paused" ? <PausedTag />');
  });
});
