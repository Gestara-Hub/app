import { createHash, randomInt } from "node:crypto";

/**
 * Regras da verificacao em duas etapas por e-mail e do "lembrar este
 * dispositivo" (doc technical/17, entrega 2). So funcoes puras e constantes:
 * o banco fica em `@/lib/security/second-factor` e
 * `@/services/server/twoFactor`.
 */

/** Validade do codigo por e-mail. */
export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
/** Tentativas por codigo: na quinta errada, o codigo deixa de valer. */
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
/** Espera minima entre dois envios. */
export const EMAIL_CODE_RESEND_SECONDS = 60;
/** No maximo 5 envios a cada 15 minutos por usuario. */
export const EMAIL_CODE_SEND_LIMIT = 5;
export const EMAIL_CODE_SEND_WINDOW_SECONDS = 15 * 60;

/** Dispositivo lembrado: 30 dias sem pedir o codigo. */
export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const TRUSTED_DEVICE_COOKIE = "gestarahub_trusted_device";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Codigos de recuperacao: 8 por vez, de uso unico, para quem perde o aplicativo. */
export const RECOVERY_CODE_COUNT = 8;
// 32 simbolos sem 0, O, 1 e I (nao se confundem ao digitar de um papel).
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_LENGTH = 8;

/** "ABCD-EFGH": 8 simbolos aleatorios criptograficos, com hifen no meio para ler melhor. */
export function generateRecoveryCode(): string {
  let raw = "";
  for (let i = 0; i < RECOVERY_LENGTH; i += 1) raw += RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateRecoveryCode());
  return [...codes];
}

/** O que a pessoa digitou (com ou sem hifen, minusculo, com espaco) vira o texto que se confere; "" se nao tem 8 simbolos. */
export function normalizeRecoveryCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === RECOVERY_LENGTH ? raw : "";
}

/** Hash do codigo (so letras e numeros), com o usuario junto, como nos outros codigos. */
export function hashRecoveryCode(authUserId: string, normalized: string): string {
  return createHash("sha256").update(`recovery:${authUserId}:${normalized}`).digest("hex");
}

/** Codigo de 6 numeros, aleatorio criptografico. */
export function generateEmailCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hash do codigo, com o usuario junto: o mesmo codigo de duas pessoas vira hashes diferentes. */
export function hashEmailCode(authUserId: string, code: string): string {
  return createHash("sha256").update(`${authUserId}:${code}`).digest("hex");
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** "marcello@gmail.com" vira "ma***@gmail.com" (mostrado na tela do codigo). */
export function maskEmail(email: string): string {
  const [local, domain] = email.trim().split("@");
  if (!local || !domain) return "";
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}***@${domain}`;
}

/** Segundos que faltam para poder reenviar (0 = pode enviar). */
export function resendWaitSeconds(lastSentAt: Date | null, now: Date): number {
  if (!lastSentAt) return 0;
  const elapsed = Math.floor((now.getTime() - lastSentAt.getTime()) / 1000);
  return Math.max(0, EMAIL_CODE_RESEND_SECONDS - elapsed);
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Depois de errar: a tentativa conta e, na ultima, o codigo deixa de valer. */
export function afterWrongCode(attempts: number): { attempts: number; locked: boolean } {
  const next = attempts + 1;
  return { attempts: next, locked: next >= EMAIL_CODE_MAX_ATTEMPTS };
}

/** Conta que entra so pelo Google: a verificacao fica na conta Google (nada a oferecer). */
export function isGoogleOnlyAccount(providers: string[]): boolean {
  return providers.includes("google") && !providers.includes("email");
}

/** Nome curto do dispositivo a partir do navegador ("Chrome no macOS"). Sem IP. */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Mac OS X|Macintosh/.test(ua)
              ? "macOS"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  if (browser && system) return `${browser} no ${system}`;
  return browser ?? system ?? "Navegador";
}

/** "Último uso hoje", "ontem" ou "há 3 dias", pelos dias de calendario. */
export function lastUsedLabel(lastUsedAt: Date, now: Date): string {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(lastUsedAt)) / DAY_MS));
  if (days === 0) return "Último uso hoje";
  if (days === 1) return "Último uso ontem";
  return `Último uso há ${days} dias`;
}
