import { describe, expect, it } from "vitest";
import {
  LEGACY_META_NAMES,
  MASTER_TEMPLATES,
  masterContent,
  masterParams,
  paymentButtonBase,
  paymentButtonSuffix,
} from "../master-templates";
import { fillMessage } from "../format";

// Modelos mestres (doc technical/07 §1.7): um texto por aviso, igual em todo espaco.

describe("modelos mestres do WhatsApp", () => {
  it("cobrança vem da biblioteca da Meta (utilidade, com botão); o resto é texto próprio", () => {
    const library = Object.values(MASTER_TEMPLATES).filter((t) => t!.library).map((t) => t!.trigger).sort();
    expect(library).toEqual(["billing_after_due", "billing_before_due", "billing_critical", "billing_due_date", "charge_reminder"]);
    for (const t of Object.values(MASTER_TEMPLATES)) {
      expect(t!.metaName).toBe(`${t!.trigger}_v2`);
      if (t!.library) expect(t).toMatchObject({ category: "UTILITY", paymentButton: true });
      expect(t!.body.match(/\{\{\d+\}\}/g)?.length ?? 0).toBe(t!.params.length);
    }
    expect(LEGACY_META_NAMES).toContain("billing_due_date");
    expect(Object.keys(MASTER_TEMPLATES)).toHaveLength(16);
  });

  it("nenhum texto fala em treino, tatame ou no bordão de lutas", () => {
    for (const t of Object.values(MASTER_TEMPLATES)) {
      expect(masterContent(t!)).not.toMatch(/treino|tatame|🥋|Boas aulas/i);
    }
  });

  it("valores sem espaço duro nem quebra de linha; variável vazia, sem envio", () => {
    const before = MASTER_TEMPLATES.billing_before_due!;
    expect(masterParams(before, { empresa: "Dojo\nForte", valor: "R$ 150,00", vencimento: "21/11/2026" })).toEqual([
      "Mensalidade na Dojo Forte",
      "R$ 150,00",
      "21/11/2026",
      "pendências",
    ]);
    expect(masterParams(before, { empresa: "Dojo", valor: "", vencimento: "21/11/2026" })).toBeNull();
  });

  it("texto do espaço: o da Meta com as variáveis e, na cobrança, a linha do link (sai sem link)", () => {
    const content = masterContent(MASTER_TEMPLATES.billing_after_due!);
    expect(content.startsWith("Olá, {aluno}, você tem um pagamento atrasado:")).toBe(true);
    // No assistido nao ha botao: a frase do botao vira o link.
    expect(content).toContain("Data prevista: {vencimento}\n\nPague pelo link: {link_pagamento}\nPor favor ignore");
    expect(content).not.toContain("botão");
    const filled = fillMessage(content, { aluno: "Ana", empresa: "X", valor: "R$ 1,00", vencimento: "01/12/2026" });
    expect(filled).not.toContain("Pague pelo link");
    expect(filled.endsWith("Data prevista: 01/12/2026\n\nPor favor ignore esta mensagem se você já pagou.")).toBe(true);
    expect(masterContent(MASTER_TEMPLATES.billing_before_due!).endsWith("\n\nPague pelo link: {link_pagamento}")).toBe(true);
  });

  it("botão: final depois de /p/; base do site em endereço local", () => {
    expect(paymentButtonSuffix("https://gestarahub.com.br/p/c/chg-1")).toBe("c/chg-1");
    expect(paymentButtonSuffix("https://localhost:3200/p/ABC123")).toBe("ABC123");
    expect(paymentButtonSuffix("https://parceiro.test/pagar")).toBeNull();
    expect(paymentButtonSuffix(undefined)).toBeNull();
    expect(paymentButtonBase("https://gestarahub.com.br/")).toBe("https://gestarahub.com.br/p/");
    expect(paymentButtonBase("https://localhost:3200")).toBe("https://gestarahub.com.br/p/");
    expect(paymentButtonBase(undefined)).toBe("https://gestarahub.com.br/p/");
  });
});
