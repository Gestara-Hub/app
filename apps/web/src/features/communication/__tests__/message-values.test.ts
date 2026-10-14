import { describe, expect, it } from "vitest";
import { chargeReference, chargeReminder, packageRemainingText, type ChargeForMessage } from "../message-values";

/** Moeda formatada usa espaco nao separavel. */
const plain = (text: string) => text.replace(/ /g, " ");
const TODAY = "2026-10-14";

function charge(over: Partial<ChargeForMessage> = {}): ChargeForMessage {
  return { kind: "extra", status: "pending", amountCents: 15000, dueDate: "2026-10-20", description: "Kimono", ...over };
}

describe("{referencia} do lembrete de cobrança", () => {
  it("avulsa: à vista e em parcelas", () => {
    expect(chargeReference(charge())).toBe("cobrança Kimono");
    expect(chargeReference(charge({ cycleIndex: 2, cycleTotal: 3 }))).toBe("parcela 2 de 3 da cobrança Kimono");
  });

  it("curso: matrícula à vista e parcela; sem descrição usa a turma", () => {
    expect(chargeReference(charge({ kind: "course", description: "Confeitaria" }))).toBe("matrícula no curso Confeitaria");
    expect(chargeReference(charge({ kind: "course", description: "Confeitaria", cycleIndex: 2, cycleTotal: 4 }))).toBe(
      "parcela 2 de 4 do curso Confeitaria",
    );
    expect(chargeReference(charge({ kind: "course", description: undefined, className: "Cerâmica" }))).toBe(
      "matrícula no curso Cerâmica",
    );
  });

  it("pacote: compra à vista e parcela", () => {
    expect(chargeReference(charge({ kind: "package", description: "10 aulas" }))).toBe("compra do pacote 10 aulas");
    expect(chargeReference(charge({ kind: "package", description: "10 aulas", cycleIndex: 1, cycleTotal: 2 }))).toBe(
      "parcela 1 de 2 do pacote 10 aulas",
    );
  });

  it("parcela 1 de 1 (curso à vista guardado com ciclo) não fala em parcela", () => {
    expect(chargeReference(charge({ kind: "course", description: "Oficina", cycleIndex: 1, cycleTotal: 1 }))).toBe(
      "matrícula no curso Oficina",
    );
  });
});

describe("lembrete da cobrança pelo tipo", () => {
  it("avulsa, curso e pacote usam o Lembrete de cobrança com a referência", () => {
    const reminder = chargeReminder(charge({ kind: "course", description: "Confeitaria", cycleIndex: 2, cycleTotal: 4 }), TODAY);
    expect(reminder?.trigger).toBe("charge_reminder");
    expect(reminder && { ...reminder.values, valor: plain(reminder.values.valor) }).toEqual({
      valor: "R$ 150,00",
      vencimento: "20/10",
      referencia: "parcela 2 de 4 do curso Confeitaria",
    });
  });

  it("mensalidade segue com o lembrete da situação", () => {
    expect(chargeReminder(charge({ kind: "membership", dueDate: TODAY }), TODAY)?.trigger).toBe("billing_due_date");
    expect(chargeReminder(charge({ kind: "membership", status: "overdue", dueDate: "2026-10-01" }), TODAY)?.trigger).toBe(
      "billing_critical",
    );
    expect(chargeReminder(charge({ kind: "membership" }), TODAY)?.values).not.toHaveProperty("referencia");
  });

  it("aula avulsa não tem lembrete", () => {
    expect(chargeReminder(charge({ kind: "dropin" }), TODAY)).toBeNull();
  });
});

describe("{restante} do pacote acabando", () => {
  const pkg = (over: Partial<Parameters<typeof packageRemainingText>[0]> = {}) => ({
    lessonsTotal: 10,
    lessonsUsed: 9,
    status: "active" as const,
    ...over,
  });

  it("aulas que restam, sem validade", () => {
    expect(packageRemainingText(pkg(), TODAY)).toBe("resta 1 aula");
    expect(packageRemainingText(pkg({ lessonsUsed: 7 }), TODAY)).toBe("restam 3 aulas");
    expect(packageRemainingText(pkg({ lessonsUsed: 10 }), TODAY)).toBe("as aulas acabaram");
  });

  it("vencendo em até 7 dias junta a validade e as aulas", () => {
    expect(packageRemainingText(pkg({ lessonsUsed: 7, expiresAt: "2026-10-19" }), TODAY)).toBe("vence em 5 dias e restam 3 aulas");
    expect(packageRemainingText(pkg({ expiresAt: "2026-10-15" }), TODAY)).toBe("vence amanhã e resta 1 aula");
    expect(packageRemainingText(pkg({ expiresAt: TODAY }), TODAY)).toBe("vence hoje e resta 1 aula");
  });

  it("validade longe não aparece", () => {
    expect(packageRemainingText(pkg({ expiresAt: "2026-11-30" }), TODAY)).toBe("resta 1 aula");
  });

  it("vencido mostra o dia", () => {
    expect(packageRemainingText(pkg({ lessonsUsed: 4, expiresAt: "2026-10-12" }), TODAY)).toBe("venceu em 12/10");
  });
});
