/**
 * Relogio do servidor de testes do navegador (doc 15, fatia 5). O Playwright
 * fixa a data do navegador (22/09/2026); com as regras rodando no servidor, o
 * servidor precisa concordar. So liga com E2E_NOW no ambiente (o servidor
 * proprio do e2e, ver playwright.config); o relogio anda a partir dessa data.
 */
export function installFixedClock(iso: string): void {
  const RealDate = Date;
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
