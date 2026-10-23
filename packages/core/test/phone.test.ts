import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  brazilNationalDigits,
  displayPhone,
  formatAsYouType,
  isPossiblePhone,
  nationalDigitsOf,
  parseInternational,
  phoneCountryOf,
  toStoredPhone,
  whatsappDigits,
} from "../src/phone.ts";

describe("telefone com país", () => {
  it("guarda em E.164 a partir do país e dos dígitos", () => {
    assert.equal(toStoredPhone("BR", "11977770000"), "+5511977770000");
    assert.equal(toStoredPhone("US", "4155552671"), "+14155552671");
    assert.equal(toStoredPhone("BR", ""), "");
  });

  it("dado antigo só com dígitos vale como Brasil", () => {
    assert.equal(phoneCountryOf("11977770000"), "BR");
    assert.equal(nationalDigitsOf("(11) 97777-0000"), "11977770000");
    assert.equal(displayPhone("11977770000"), "(11) 97777-0000");
    assert.equal(whatsappDigits("11977770000"), "5511977770000");
  });

  it("outro país aparece no formato internacional e vai com o DDI dele", () => {
    assert.equal(phoneCountryOf("+14155552671"), "US");
    assert.equal(displayPhone("+14155552671"), "+1 415 555 2671");
    assert.equal(whatsappDigits("+351912345678"), "351912345678");
    assert.equal(displayPhone("+5511977770000"), "(11) 97777-0000");
  });

  it("reconhece o DDI colado e aplica a máscara do país", () => {
    assert.deepEqual(parseInternational("+1 415 555 2671"), { country: "US", nationalDigits: "4155552671" });
    assert.equal(parseInternational("11977770000"), undefined);
    assert.equal(formatAsYouType("BR", "11977770000"), "(11) 97777-0000");
  });

  it("no Brasil precisa do DDD", () => {
    assert.equal(isPossiblePhone("+5511977770000"), true);
    assert.equal(isPossiblePhone("99999-8888"), false);
    assert.equal(whatsappDigits("99999-8888"), null);
    assert.equal(isPossiblePhone("123"), false);
  });

  it("celular para o gateway: só DDD + número, sem o 55", () => {
    assert.equal(brazilNationalDigits("+5592991844219"), "92991844219");
    assert.equal(brazilNationalDigits("+551132300606"), "1132300606");
    // Dado antigo só com dígitos (com ou sem o 55) também vale como Brasil.
    assert.equal(brazilNationalDigits("92991844219"), "92991844219");
    assert.equal(brazilNationalDigits("5592991844219"), "92991844219");
    // Outro país ou vazio: o Asaas não aceita, não manda.
    assert.equal(brazilNationalDigits("+14155552671"), undefined);
    assert.equal(brazilNationalDigits(""), undefined);
    assert.equal(brazilNationalDigits(undefined), undefined);
  });
});
