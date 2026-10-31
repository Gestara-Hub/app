import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { maskBirthDate, maskCpf, maskPersonName, maskPhone } from "../src/privacy.ts";

describe("máscaras das rotas públicas", () => {
  it("nome: só o primeiro inteiro, o resto vira inicial (sem 'de', 'da', 'dos')", () => {
    assert.equal(maskPersonName("Ana Souza Lima"), "Ana S. L.");
    assert.equal(maskPersonName("  maria da silva  "), "maria S.");
    assert.equal(maskPersonName("Gabi"), "Gabi");
    assert.equal(maskPersonName(""), "");
    assert.equal(maskPersonName(undefined), "");
  });

  it("CPF: só os dígitos do meio (padrão do gov.br)", () => {
    assert.equal(maskCpf("529.982.247-25"), "***.982.247-**");
    assert.equal(maskCpf("52998224725"), "***.982.247-**");
    assert.equal(maskCpf("123"), undefined);
  });

  it("nascimento: só o ano", () => {
    assert.equal(maskBirthDate("2015-05-05"), "**/**/2015");
    assert.equal(maskBirthDate("05/05/2015"), undefined);
  });

  it("telefone: só os 4 últimos dígitos", () => {
    assert.equal(maskPhone("+5511999998888"), "(**) *****-8888");
    assert.equal(maskPhone("123"), undefined);
  });
});
