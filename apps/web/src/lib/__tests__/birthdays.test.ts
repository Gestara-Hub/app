import { describe, expect, it } from "vitest";
import {
  UPCOMING_BIRTHDAY_DAYS,
  ageLabel,
  ageTurningThisYear,
  birthdaysOfMonth,
  daysUntilBirthday,
  isBirthdayToday,
  upcomingBirthdaysNextMonths,
} from "@/lib/birthdays";

describe("isBirthdayToday", () => {
  it("compara dia e mes, ignorando o ano", () => {
    expect(isBirthdayToday("1990-10-14", "2026-10-14")).toBe(true);
    expect(isBirthdayToday("1990-10-15", "2026-10-14")).toBe(false);
    expect(isBirthdayToday("1990-11-14", "2026-10-14")).toBe(false);
  });

  it("nascido em 29/02 faz aniversario em 28/02 nos anos nao bissextos", () => {
    expect(isBirthdayToday("2000-02-29", "2027-02-28")).toBe(true);
    expect(isBirthdayToday("2000-02-29", "2027-03-01")).toBe(false);
  });

  it("nascido em 29/02 faz aniversario em 29/02 no ano bissexto (nao em 28/02)", () => {
    expect(isBirthdayToday("2000-02-29", "2028-02-29")).toBe(true);
    expect(isBirthdayToday("2000-02-29", "2028-02-28")).toBe(false);
  });

  it("sem data ou data incompleta nunca e aniversario", () => {
    expect(isBirthdayToday(undefined, "2026-10-14")).toBe(false);
    expect(isBirthdayToday("", "2026-10-14")).toBe(false);
    expect(isBirthdayToday("10-14", "2026-10-14")).toBe(false);
  });
});

describe("ageTurningThisYear", () => {
  it("diferenca de anos, independente de ja ter passado", () => {
    expect(ageTurningThisYear("2010-12-31", "2026-01-01")).toBe(16);
    expect(ageTurningThisYear("2010-01-01", "2026-12-31")).toBe(16);
  });
});

describe("birthdaysOfMonth", () => {
  const people = [
    { id: "a", birthDate: "1990-10-20" },
    { id: "b", birthDate: "2010-10-14" },
    { id: "c", birthDate: "1985-10-03" },
    { id: "d", birthDate: "2000-11-01" },
    { id: "e" },
    { id: "f", birthDate: "" },
  ];

  it("so os do mes, em ordem de dia, com hoje/passado/idade", () => {
    const result = birthdaysOfMonth(people, "2026-10-14");
    expect(result.map((r) => r.item.id)).toEqual(["c", "b", "a"]);
    expect(result[0]).toMatchObject({ day: 3, isToday: false, isPast: true, ageTurning: 41, daysUntil: -11 });
    expect(result[1]).toMatchObject({ day: 14, isToday: true, isPast: false, ageTurning: 16, daysUntil: 0 });
    expect(result[2]).toMatchObject({ day: 20, isToday: false, isPast: false, ageTurning: 36, daysUntil: 6 });
  });

  it("devolve o proprio item", () => {
    const result = birthdaysOfMonth(people, "2026-10-14");
    expect(result[0].item).toBe(people[2]);
  });

  it("29/02 aparece no dia 28 em fevereiro de ano nao bissexto", () => {
    const result = birthdaysOfMonth([{ birthDate: "2000-02-29" }], "2027-02-10");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ day: 28, isPast: false, ageTurning: 27 });
  });

  it("29/02 aparece no dia 29 em ano bissexto", () => {
    const result = birthdaysOfMonth([{ birthDate: "2000-02-29" }], "2028-02-29");
    expect(result[0]).toMatchObject({ day: 29, isToday: true });
  });

  it("lista vazia quando ninguem faz aniversario no mes", () => {
    expect(birthdaysOfMonth(people, "2026-06-01")).toEqual([]);
  });
});

describe("daysUntilBirthday", () => {
  it("0 no dia do aniversario", () => {
    expect(daysUntilBirthday("1990-10-14", "2026-10-14")).toBe(0);
  });

  it("dias ate o aniversario ainda neste ano", () => {
    expect(daysUntilBirthday("1990-10-20", "2026-10-14")).toBe(6);
  });

  it("aniversario que ja passou conta ate o do ano que vem", () => {
    expect(daysUntilBirthday("1990-10-13", "2026-10-14")).toBe(364);
  });

  it("vira o ano (30/12 -> 02/01)", () => {
    expect(daysUntilBirthday("2010-01-02", "2026-12-30")).toBe(3);
  });

  it("29/02 conta ate 28/02 em ano nao bissexto", () => {
    expect(daysUntilBirthday("2000-02-29", "2027-02-20")).toBe(8);
    expect(daysUntilBirthday("2000-02-29", "2027-02-28")).toBe(0);
  });

  it("29/02 conta ate 29/02 em ano bissexto", () => {
    expect(daysUntilBirthday("2000-02-29", "2028-02-20")).toBe(9);
  });

  it("29/02 depois de 28/02 de ano nao bissexto vai para 29/02 do bissexto seguinte", () => {
    expect(daysUntilBirthday("2000-02-29", "2027-03-01")).toBe(365);
  });
});

describe("upcomingBirthdaysNextMonths", () => {
  it("usa janela padrao de 5 dias", () => {
    expect(UPCOMING_BIRTHDAY_DAYS).toBe(5);
  });

  it("so aniversarios do mes seguinte dentro da janela (hoje 29/10 -> 02/11 entra)", () => {
    const people = [
      { id: "nov-02", birthDate: "1990-11-02" },
      { id: "nov-03", birthDate: "2000-11-03" },
      { id: "nov-05", birthDate: "1990-11-05" },
      { id: "oct-31", birthDate: "1990-10-31" },
      { id: "oct-29", birthDate: "1990-10-29" },
      { id: "nov-01", birthDate: "2015-11-01" },
      { id: "none" },
    ];
    const result = upcomingBirthdaysNextMonths(people, "2026-10-29");
    expect(result.map((r) => r.item.id)).toEqual(["nov-01", "nov-02", "nov-03"]);
    expect(result[0]).toMatchObject({ day: 1, daysUntil: 3, ageTurning: 11, isToday: false, isPast: false });
    expect(result[1]).toMatchObject({ day: 2, daysUntil: 4, ageTurning: 36 });
    expect(result[2]).toMatchObject({ day: 3, daysUntil: 5, ageTurning: 26 });
  });

  it("no meio do mes nao traz nada (tudo cai no mesmo mes)", () => {
    expect(upcomingBirthdaysNextMonths([{ birthDate: "1990-10-18" }], "2026-10-14")).toEqual([]);
  });

  it("vira o ano e calcula a idade do ano seguinte", () => {
    const result = upcomingBirthdaysNextMonths([{ birthDate: "2010-01-02" }], "2026-12-30");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ day: 2, daysUntil: 3, ageTurning: 17 });
  });

  it("aceita janela personalizada", () => {
    const people = [{ birthDate: "1990-11-05" }];
    expect(upcomingBirthdaysNextMonths(people, "2026-10-29")).toEqual([]);
    expect(upcomingBirthdaysNextMonths(people, "2026-10-29", 7)).toHaveLength(1);
  });

  it("29/02 em ano nao bissexto: hoje 27/02 nao entra (28/02 e do mesmo mes)", () => {
    expect(upcomingBirthdaysNextMonths([{ birthDate: "2000-02-29" }], "2027-02-27")).toEqual([]);
  });
});

describe("29/02 fora do ano bissexto (rodada de 18/10/2026)", () => {
  it("o aniversário cai em 28/02, com a idade nova nesse dia", async () => {
    const { ageAt } = await import("@/lib/progression-tracks");
    const { nextBirthdayLabel } = await import("@/lib/birthdays");
    expect(nextBirthdayLabel("2000-02-29", "2026-02-27")).toBe("28/02");
    expect(nextBirthdayLabel("2000-02-29", "2028-02-27")).toBe("29/02");
    expect(ageAt("2000-02-29", "2026-02-27")).toBe(25);
    expect(ageAt("2000-02-29", "2026-02-28")).toBe(26);
  });
});

describe("ageLabel", () => {
  it("bebê não aparece com 0 anos (ALU-32)", () => {
    expect(ageLabel(0)).toBe("menos de 1 ano");
    expect(ageLabel(1)).toBe("1 ano");
    expect(ageLabel(7)).toBe("7 anos");
  });
});
