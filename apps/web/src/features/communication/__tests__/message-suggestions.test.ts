import type { ChargeView, Client, StudentPackageView, StudentSummaryLevel } from "@gestarahub/contracts";
import { describe, expect, it } from "vitest";
import { messageSuggestions, type StudentMessageContext } from "../message-suggestions";

/** Moeda formatada usa espaco nao separavel. */
const plain = (text: string) => text.replace(/ /g, " ");
const TODAY = "2026-10-14";
const NOTICES = ["class_canceled", "schedule_change", "holiday_notice"];

function charge(id: string, over: Partial<ChargeView> = {}): ChargeView {
  return {
    id,
    studentId: "cli-1",
    kind: "membership",
    competence: "2026-10",
    status: "pending",
    amountCents: 15000,
    dueDate: "2026-10-20",
    cycleIndex: 1,
    cycleTotal: 1,
    ...over,
  } as ChargeView;
}

function summary(over: {
  student?: Partial<Client>;
  studentSince?: string;
  levels?: Partial<StudentSummaryLevel>[];
  packages?: Partial<StudentPackageView>[];
} = {}): StudentMessageContext["summary"] {
  return {
    student: { id: "cli-1", name: "Ana", ...over.student } as Client,
    studentSince: over.studentSince ?? "2026-01-10",
    levels: (over.levels ?? []) as StudentSummaryLevel[],
    packages: (over.packages ?? []) as StudentPackageView[],
  };
}

const triggers = (context: Partial<StudentMessageContext>) =>
  messageSuggestions({ today: TODAY, ...context }).map((s) => s.trigger);

describe("modelos sugeridos na mensagem para o aluno", () => {
  it("sem nada na situação do aluno, só os avisos", () => {
    expect(triggers({ summary: summary(), charges: [], absenceStreak: 0 })).toEqual(NOTICES);
    expect(triggers({})).toEqual(NOTICES);
  });

  it("mensalidade: lembrete pela situação, com valores e a cobrança ligada", () => {
    const [due] = messageSuggestions({ today: TODAY, charges: [charge("m-1", { dueDate: "2026-10-14" })] });
    expect(due).toMatchObject({
      trigger: "billing_due_date",
      label: "Mensalidade vence hoje",
      chargeId: "m-1",
      values: { vencimento: "14/10" },
    });
    expect(plain(due.values?.valor ?? "")).toBe("R$ 150,00");

    const [late] = messageSuggestions({
      today: TODAY,
      charges: [charge("m-2", { status: "overdue", dueDate: "2026-10-01" })],
    });
    expect(late).toMatchObject({ trigger: "billing_critical", label: "Mensalidade em atraso" });
  });

  it("só lembra do que vence em até 7 dias ou já venceu; aula avulsa e paga ficam fora", () => {
    expect(triggers({ charges: [charge("far", { dueDate: "2026-10-22" })] })).toEqual(NOTICES);
    expect(triggers({ charges: [charge("near", { dueDate: "2026-10-21" })] })[0]).toBe("billing_before_due");
    expect(
      triggers({
        charges: [
          charge("dropin", { kind: "dropin", status: "overdue", dueDate: "2026-10-01" }),
          charge("waived", { status: "waived", dueDate: "2026-10-15" }),
        ],
      }),
    ).toEqual(NOTICES);
  });

  it("uma da mensalidade e uma das outras cobranças, a mais urgente de cada", () => {
    const list = messageSuggestions({
      today: TODAY,
      charges: [
        charge("m-pending", { dueDate: "2026-10-16" }),
        charge("m-late", { status: "overdue", dueDate: "2026-10-10" }),
        charge("course", { kind: "course", status: "pending", dueDate: "2026-10-18", description: "Confeitaria" }),
      ],
    });
    expect(list.slice(0, 2)).toMatchObject([
      { trigger: "billing_after_due", chargeId: "m-late" },
      {
        trigger: "charge_reminder",
        label: "Lembrete de cobrança",
        chargeId: "course",
        values: { referencia: "matrícula no curso Confeitaria" },
      },
    ]);
    expect(list).toHaveLength(2 + NOTICES.length);
  });

  it("3 faltas seguidas sugerem Sentimos sua falta", () => {
    expect(triggers({ absenceStreak: 2 })).toEqual(NOTICES);
    expect(triggers({ absenceStreak: 3 })[0]).toBe("absence_alert");
  });

  it("pacote acabando usa o nome e o que resta", () => {
    const [ending] = messageSuggestions({
      today: TODAY,
      summary: summary({
        packages: [
          {
            id: "pkg-1",
            studentId: "cli-1",
            name: "10 aulas",
            status: "active",
            lessonsTotal: 10,
            lessonsUsed: 9,
            purchasedAt: "2026-09-01",
            createdAt: "2026-09-01T12:00:00.000Z",
            modalityIds: [],
          },
        ],
      }),
    });
    expect(ending).toMatchObject({
      trigger: "package_ending",
      values: { pacote: "10 aulas", restante: "resta 1 aula" },
    });
  });

  it("aniversário no dia e até 6 dias depois, não antes", () => {
    const on = (birthDate: string) => triggers({ summary: summary({ student: { birthDate } }) })[0];
    expect(on("1990-10-14")).toBe("birthday_greeting");
    expect(on("1990-10-08")).toBe("birthday_greeting");
    expect(on("1990-10-07")).toBe("class_canceled");
    expect(on("1990-10-15")).toBe("class_canceled");
  });

  it("avanço nos últimos 14 dias sugere os parabéns com o nível mais recente", () => {
    const list = messageSuggestions({
      today: TODAY,
      summary: summary({
        levels: [
          { modalityId: "m-1", levelName: "Faixa Cinza", promotedAt: "2026-10-01", lastAdvancedAt: "2026-10-01" },
          { modalityId: "m-2", levelName: "Faixa Azul", promotedAt: "2026-10-10", lastAdvancedAt: "2026-10-10" },
          { modalityId: "m-3", levelName: "Faixa Roxa", promotedAt: "2026-09-29", lastAdvancedAt: "2026-09-29" },
        ],
      }),
    });
    expect(list[0]).toMatchObject({ trigger: "level_up", label: "Parabéns pelo avanço", values: { nivel: "Faixa Azul" } });
    expect(list.filter((s) => s.trigger === "level_up")).toHaveLength(1);
    expect(
      triggers({ summary: summary({ levels: [{ modalityId: "m-1", levelName: "X", promotedAt: "2026-09-29", lastAdvancedAt: "2026-09-29" }] }) }),
    ).toEqual(NOTICES);
  });

  it("parabéns leva o grau e só vale para avanço registrado (não o ponto de partida)", () => {
    const withGrade = messageSuggestions({
      today: TODAY,
      summary: summary({
        levels: [
          { modalityId: "m-1", levelName: "Faixa Azul", subLevel: 1, trackStyle: "belt", promotedAt: "2026-10-10", lastAdvancedAt: "2026-10-10" },
        ],
      }),
    });
    expect(withGrade[0]).toMatchObject({ trigger: "level_up", values: { nivel: "Faixa Azul · 1º grau" } });
    const startOnly = triggers({
      summary: summary({ levels: [{ modalityId: "m-1", levelName: "Faixa Branca", promotedAt: "2026-10-10" }] }),
    });
    expect(startOnly).not.toContain("level_up");
  });

  it("pagamento recebido nos últimos 7 dias, o mais recente, com o mês da mensalidade", () => {
    const list = messageSuggestions({
      today: TODAY,
      charges: [
        charge("old", { status: "paid", paidAt: "2026-10-06T12:00:00.000Z", competence: "2026-09" }),
        charge("new", { status: "paid", paidAt: "2026-10-12T12:00:00.000Z", competence: "2026-10" }),
      ],
    });
    expect(list[0]).toMatchObject({
      trigger: "payment_received",
      chargeId: "new",
      values: { referencia: "mensalidade de outubro" },
    });
    expect(plain(list[0].values?.valor ?? "")).toBe("R$ 150,00");
    expect(
      triggers({ charges: [charge("older", { status: "paid", paidAt: "2026-10-06T12:00:00.000Z" })] }),
    ).toEqual(NOTICES);
  });

  it("pagamento de outra cobrança usa a referência do lembrete", () => {
    const [paid] = messageSuggestions({
      today: TODAY,
      charges: [
        charge("pkg", {
          kind: "package",
          status: "paid",
          paidAt: "2026-10-13T12:00:00.000Z",
          description: "10 aulas",
          competence: undefined,
        }),
      ],
    });
    expect(paid.values?.referencia).toBe("compra do pacote 10 aulas");
  });

  it("boas-vindas até 7 dias depois do cadastro", () => {
    expect(triggers({ summary: summary({ studentSince: "2026-10-07" }) })[0]).toBe("welcome_student");
    expect(triggers({ summary: summary({ studentSince: "2026-10-06" }) })).toEqual(NOTICES);
  });

  it("ordem: cobrança, faltas, pacote, aniversário, avanço, pagamento, boas-vindas e avisos", () => {
    expect(
      triggers({
        absenceStreak: 4,
        charges: [
          charge("late", { status: "overdue", dueDate: "2026-10-12" }),
          charge("paid", { status: "paid", paidAt: "2026-10-13T12:00:00.000Z" }),
        ],
        summary: summary({
          student: { birthDate: "2000-10-14" },
          studentSince: "2026-10-10",
          levels: [{ modalityId: "m-1", levelName: "Nível 2", promotedAt: "2026-10-13", lastAdvancedAt: "2026-10-13" }],
          packages: [
            {
              id: "pkg-1",
              studentId: "cli-1",
              name: "8 aulas",
              status: "active",
              lessonsTotal: 8,
              lessonsUsed: 8,
              purchasedAt: "2026-09-01",
              createdAt: "2026-09-01T12:00:00.000Z",
              expiresAt: "2026-12-01",
              modalityIds: [],
            },
          ],
        }),
      }),
    ).toEqual([
      "billing_after_due",
      "absence_alert",
      "package_ending",
      "birthday_greeting",
      "level_up",
      "payment_received",
      "welcome_student",
      ...NOTICES,
    ]);
  });
});
