/**
 * Relogio do servidor de testes do navegador (doc 15, fatia 5). O Playwright
 * fixa a data do navegador (22/09/2026); com as regras rodando no servidor, o
 * servidor precisa concordar. So liga com E2E_NOW no ambiente (o servidor
 * proprio do e2e, ver playwright.config); o relogio anda a partir dessa data.
 */
const REAL_NOW_KEY = Symbol.for("gestarahub.e2e.realNow");

/**
 * Hora do relogio de verdade (a do banco). Fora do e2e e o proprio `Date.now()`.
 * Prazo que o banco confere com `now()` (ex.: a prova do segundo fator no RLS)
 * sai daqui: com o relogio fixo do e2e, o prazo nasceria vencido para o banco.
 */
export function databaseNow(): number {
  const realNow = (globalThis as Record<symbol, unknown>)[REAL_NOW_KEY];
  return typeof realNow === "function" ? (realNow as () => number)() : Date.now();
}

export function installFixedClock(iso: string): void {
  const RealDate = Date;
  (globalThis as Record<symbol, unknown>)[REAL_NOW_KEY] = () => RealDate.now();
  const target = new RealDate(iso).getTime();
  if (Number.isNaN(target)) return;
  const offset = target - RealDate.now();

  class E2EDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date> | []) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...(args as ConstructorParameters<typeof Date>));
    }

    static now(): number {
      return RealDate.now() + offset;
    }
  }

  globalThis.Date = E2EDate as DateConstructor;
}
