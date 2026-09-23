import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { plural, pluralWord } from "../src/format.ts";

describe("plural / pluralWord", () => {
  it("0 usa o plural", () => {
    assert.equal(plural(0, "cobrança", "cobranças"), "0 cobranças");
    assert.equal(pluralWord(0, "aula", "aulas"), "aulas");
  });

  it("1 usa o singular", () => {
    assert.equal(plural(1, "cobrança", "cobranças"), "1 cobrança");
    assert.equal(pluralWord(1, "aula", "aulas"), "aula");
  });

  it("2 usa o plural", () => {
    assert.equal(plural(2, "cobrança", "cobranças"), "2 cobranças");
    assert.equal(pluralWord(2, "aula", "aulas"), "aulas");
  });
});
