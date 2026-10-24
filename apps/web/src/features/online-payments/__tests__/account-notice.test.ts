import { describe, expect, it } from "vitest";
import { PERSON_ACCOUNT_NOTICE, showsPersonAccountNotice } from "../account-notice";

describe("aviso da conta como pessoa física", () => {
  it("vale só para CPF, com ou sem máscara", () => {
    expect(showsPersonAccountNotice("529.982.247-25")).toBe(true);
    expect(showsPersonAccountNotice("52998224725")).toBe(true);
    expect(showsPersonAccountNotice("11.222.333/0001-81")).toBe(false);
    expect(showsPersonAccountNotice("")).toBe(false);
  });

  it("diz o que aparece na fatura e sugere CNPJ ou MEI", () => {
    expect(PERSON_ACCOUNT_NOTICE).toContain("CPF, e-mail e telefone");
    expect(PERSON_ACCOUNT_NOTICE).toContain("CNPJ ou MEI");
  });
});
