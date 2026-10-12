/**
 * Aniversarios pela data de nascimento (`YYYY-MM-DD`) e a data LOCAL de hoje.
 * Puro: usado no Dashboard, na lista de alunos e na mensagem de parabens.
 * Nascido em 29/02 faz aniversario em 28/02 nos anos nao bissextos.
 */

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** "MM-DD" do aniversario no ano informado (29/02 vira 28/02 fora do bissexto). */
function birthdayMonthDay(birthDate: string, year: number): string {
  const md = birthDate.slice(5, 10);
  return md === "02-29" && !isLeapYear(year) ? "02-28" : md;
}

/** Faz aniversario hoje? `today` em `YYYY-MM-DD`. */
export function isBirthdayToday(birthDate: string | undefined, today: string): boolean {
  if (!birthDate || birthDate.length < 10) return false;
  return birthdayMonthDay(birthDate, Number(today.slice(0, 4))) === today.slice(5, 10);
}

/** Idade que completa no aniversario deste ano. */
export function ageTurningThisYear(birthDate: string, today: string): number {
  return Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
}

/** Janela de "aniversario proximo" (selo "Em N dias"). */
export const UPCOMING_BIRTHDAY_DAYS = 5;

const DAY_MS = 86_400_000;

function utcDay(year: number, monthDay: string): number {
  return Date.UTC(year, Number(monthDay.slice(0, 2)) - 1, Number(monthDay.slice(3, 5)));
}

/** Dias ate o proximo aniversario (0 = hoje). */
export function daysUntilBirthday(birthDate: string, today: string): number {
  const year = Number(today.slice(0, 4));
  const todayUtc = utcDay(year, today.slice(5, 10));
  let next = utcDay(year, birthdayMonthDay(birthDate, year));
  if (next < todayUtc) next = utcDay(year + 1, birthdayMonthDay(birthDate, year + 1));
  return Math.round((next - todayUtc) / DAY_MS);
}

export interface MonthBirthday<T> {
  item: T;
  /** Dia do mes do aniversario (ja ajustado para 29/02). */
  day: number;
  isToday: boolean;
  /** Ja passou neste mes. */
  isPast: boolean;
  ageTurning: number;
  /** Dias ate o aniversario (0 = hoje; negativo = ja passou neste mes). */
  daysUntil: number;
}

/** Aniversariantes do mes de `today`, em ordem de dia. */
export function birthdaysOfMonth<T extends { birthDate?: string }>(
  items: readonly T[],
  today: string,
): MonthBirthday<T>[] {
  const year = Number(today.slice(0, 4));
  const month = today.slice(5, 7);
  const todayDay = Number(today.slice(8, 10));
  return items
    .filter((item): item is T & { birthDate: string } => Boolean(item.birthDate && item.birthDate.length >= 10))
    .map((item) => ({ item, md: birthdayMonthDay(item.birthDate, year) }))
    .filter(({ md }) => md.slice(0, 2) === month)
    .map(({ item, md }) => {
      const day = Number(md.slice(3, 5));
      return {
        item,
        day,
        isToday: day === todayDay,
        isPast: day < todayDay,
        ageTurning: ageTurningThisYear(item.birthDate, today),
        daysUntil: day - todayDay,
      };
    })
    .sort((a, b) => a.day - b.day);
}

/**
 * Aniversarios nos proximos `days` dias que caem num mes seguinte (ex.: hoje
 * 29/10, aniversario em 02/11). Completa a lista do mes no fim do mes.
 */
export function upcomingBirthdaysNextMonths<T extends { birthDate?: string }>(
  items: readonly T[],
  today: string,
  days = UPCOMING_BIRTHDAY_DAYS,
): MonthBirthday<T>[] {
  const year = Number(today.slice(0, 4));
  const month = today.slice(5, 7);
  return items
    .filter((item): item is T & { birthDate: string } => Boolean(item.birthDate && item.birthDate.length >= 10))
    .map((item) => ({ item, daysUntil: daysUntilBirthday(item.birthDate, today) }))
    .filter(({ daysUntil }) => daysUntil > 0 && daysUntil <= days)
    .map(({ item, daysUntil }) => {
      const date = new Date(utcDay(year, today.slice(5, 10)) + daysUntil * DAY_MS);
      return { item, daysUntil, date };
    })
    .filter(({ date }) => String(date.getUTCMonth() + 1).padStart(2, "0") !== month)
    .map(({ item, daysUntil, date }) => ({
      item,
      day: date.getUTCDate(),
      isToday: false,
      isPast: false,
      ageTurning: date.getUTCFullYear() - Number(item.birthDate.slice(0, 4)),
      daysUntil,
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
