import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ageOn, formatCpf, isValidCpf, messageGuardian, payerIssueMessage, payerIssueOf, resolveOnlinePayer } from "../src/payer.ts";

// CPFs validos de teste (digitos verificadores certos).
const ADULT_CPF = "52998224725";
const GUARDIAN_CPF = "11144477735";
const OTHER_CPF = "39053344705";
const TODAY = "2026-10-22";

describe("CPF", () => {
  it("valida pelos dígitos verificadores", () => {
    assert.equal(isValidCpf("529.982.247-25"), true);
    assert.equal(isValidCpf(ADULT_CPF), true);
    assert.equal(isValidCpf("529.982.247-24"), false);
    assert.equal(isValidCpf("111.111.111-11"), false);
    assert.equal(isValidCpf("1234"), false);
    assert.equal(isValidCpf(undefined), false);
  });

  it("formata enquanto digita", () => {
    assert.equal(formatCpf("52998224725"), "529.982.247-25");
    assert.equal(formatCpf("5299"), "529.9");
    assert.equal(formatCpf(""), "");
  });

  it("idade em anos completos", () => {
    assert.equal(ageOn("2008-10-23", TODAY), 17);
    assert.equal(ageOn("2008-10-22", TODAY), 18);
    assert.equal(ageOn(undefined, TODAY), null);
  });
});

describe("pagador da cobrança online", () => {
  const base = { name: "Ana", phone: "+5592991844219", email: "ana@exemplo.com" };

  it("maior de idade paga com o próprio CPF", () => {
    const r = resolveOnlinePayer({ ...base, birthDate: "1990-01-01", cpf: ADULT_CPF }, TODAY);
    assert.deepEqual(r, {
      ok: true,
      payer: { name: "Ana", cpf: ADULT_CPF, phone: base.phone, email: base.email, kind: "student" },
    });
  });

  it("sem data de nascimento conta como maior", () => {
    const r = resolveOnlinePayer({ ...base, cpf: ADULT_CPF }, TODAY);
    assert.equal(r.ok && r.payer.kind, "student");
  });

  it("maior sem CPF válido: falta o CPF do aluno", () => {
    assert.deepEqual(resolveOnlinePayer({ ...base, birthDate: "1990-01-01" }, TODAY), {
      ok: false,
      reason: "student_cpf_missing",
    });
    assert.deepEqual(resolveOnlinePayer({ ...base, cpf: "11111111111" }, TODAY), {
      ok: false,
      reason: "student_cpf_missing",
    });
  });

  it("menor paga pelo responsável financeiro marcado", () => {
    const r = resolveOnlinePayer(
      {
        ...base,
        birthDate: "2015-05-05",
        cpf: ADULT_CPF,
        guardians: [
          { name: "Pai", cpf: OTHER_CPF },
          { name: "Mãe", cpf: GUARDIAN_CPF, financial: true, email: "mae@exemplo.com" },
        ],
      },
      TODAY,
    );
    assert.deepEqual(r, {
      ok: true,
      payer: { name: "Mãe", cpf: GUARDIAN_CPF, phone: base.phone, email: "mae@exemplo.com", kind: "guardian" },
    });
  });

  it("sem marca, o primeiro responsável com CPF", () => {
    const r = resolveOnlinePayer(
      { ...base, birthDate: "2015-05-05", guardians: [{ name: "Avó" }, { name: "Pai", cpf: OTHER_CPF }] },
      TODAY,
    );
    assert.equal(r.ok && r.payer.name, "Pai");
  });

  it("menor sem responsável com CPF: não usa o CPF do aluno", () => {
    assert.deepEqual(
      resolveOnlinePayer({ ...base, birthDate: "2015-05-05", cpf: ADULT_CPF, guardians: [{ name: "Mãe" }] }, TODAY),
      { ok: false, reason: "guardian_cpf_missing" },
    );
  });
});

describe("o que falta para cobrar online (achado 61)", () => {
  it("diz qual CPF falta e a mensagem da janela", () => {
    const adultNoCpf = resolveOnlinePayer({ name: "Ana", phone: "11999990000", birthDate: "1990-01-01" }, TODAY);
    assert.equal(payerIssueOf(adultNoCpf), "student_cpf_missing");
    assert.match(payerIssueMessage("student_cpf_missing"), /Cadastre o CPF do aluno/);

    const childNoGuardian = resolveOnlinePayer({ name: "Gabi", phone: "11999990000", birthDate: "2015-01-01" }, TODAY);
    assert.equal(payerIssueOf(childNoGuardian), "guardian_cpf_missing");
    assert.match(payerIssueMessage("guardian_cpf_missing"), /responsável financeiro/);

    const adultWithCpf = resolveOnlinePayer({ name: "Ana", cpf: ADULT_CPF, phone: "11999990000", birthDate: "1990-01-01" }, TODAY);
    assert.equal(payerIssueOf(adultWithCpf), undefined);
    assert.equal(payerIssueOf(null), "student_cpf_missing");
  });
});

describe("messageGuardian (cobrança e avisos de aluno menor)", () => {
  const guardians = [
    { name: "Tia Lu", phone: "11911112222" },
    { name: "Mãe Ana", phone: "11933334444", financial: true },
  ];

  it("menor: o responsável financeiro com telefone; sem marca, o primeiro com telefone", () => {
    assert.deepEqual(messageGuardian({ birthDate: "2015-03-10", guardians }, "2026-10-24"), { name: "Mãe Ana", phone: "11933334444" });
    assert.deepEqual(
      messageGuardian({ birthDate: "2015-03-10", guardians: [{ name: "Sem fone" }, { name: "Tia Lu", phone: "11911112222" }] }, "2026-10-24"),
      { name: "Tia Lu", phone: "11911112222" },
    );
  });

  it("maior, sem nascimento ou sem responsável com telefone: telefone do aluno (undefined)", () => {
    assert.equal(messageGuardian({ birthDate: "2000-03-10", guardians }, "2026-10-24"), undefined);
    assert.equal(messageGuardian({ guardians }, "2026-10-24"), undefined);
    assert.equal(messageGuardian({ birthDate: "2015-03-10", guardians: [{ name: "Sem fone" }] }, "2026-10-24"), undefined);
    assert.equal(messageGuardian({ birthDate: "2015-03-10" }, "2026-10-24"), undefined);
  });
});
