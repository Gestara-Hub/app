/**
 * Versao do app em uso (doc technical/27). Vem do build (`next.config.ts`):
 * a versao por data marcada por `pnpm release:prepare` e o commit curto.
 * Fora do Next (testes), "dev".
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT || "";

/** "2026.11.10 (a1b2c3d)" para a tela; sem commit, so a versao. */
export const APP_VERSION_LABEL = APP_COMMIT ? `${APP_VERSION} (${APP_COMMIT})` : APP_VERSION;
