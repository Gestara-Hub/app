import { describe, expect, it } from "vitest";
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_RESEND_SECONDS,
  EMAIL_CODE_TTL_MS,
  afterWrongCode,
  deviceLabel,
  generateEmailCode,
  hashEmailCode,
  isExpired,
  isGoogleOnlyAccount,
  lastUsedLabel,
  maskEmail,
  resendWaitSeconds,
} from "@/lib/security/two-factor-rules";

/** Regras do codigo por e-mail e do dispositivo lembrado (doc technical/17, entrega 2). */

describe("codigo por e-mail", () => {
  it("tem 6 numeros", () => {
    for (let i = 0; i < 50; i++) expect(generateEmailCode()).toMatch(/^\d{6}$/);
  });

  it("o hash muda com o usuario", () => {
    expect(hashEmailCode("a", "123456")).not.toBe(hashEmailCode("b", "123456"));
    expect(hashEmailCode("a", "123456")).toBe(hashEmailCode("a", "123456"));
  });

  it("vale por 10 minutos", () => {
    const sent = new Date("2026-09-22T12:00:00Z");
    const expiresAt = new Date(sent.getTime() + EMAIL_CODE_TTL_MS);
    expect(isExpired(expiresAt, new Date("2026-09-22T12:09:59Z"))).toBe(false);
    expect(isExpired(expiresAt, new Date("2026-09-22T12:10:00Z"))).toBe(true);
  });

  it("na quinta tentativa errada, o codigo deixa de valer", () => {
    let attempts = 0;
    for (let i = 1; i < EMAIL_CODE_MAX_ATTEMPTS; i++) {
      const next = afterWrongCode(attempts);
      expect(next.locked).toBe(false);
      attempts = next.attempts;
    }
    expect(afterWrongCode(attempts)).toEqual({ attempts: EMAIL_CODE_MAX_ATTEMPTS, locked: true });
  });

  it("reenviar so depois de 60 s", () => {
    const sent = new Date("2026-09-22T12:00:00Z");
    expect(resendWaitSeconds(null, sent)).toBe(0);
    expect(resendWaitSeconds(sent, sent)).toBe(EMAIL_CODE_RESEND_SECONDS);
    expect(resendWaitSeconds(sent, new Date("2026-09-22T12:00:45Z"))).toBe(15);
    expect(resendWaitSeconds(sent, new Date("2026-09-22T12:01:00Z"))).toBe(0);
  });
});

describe("e-mail mascarado", () => {
  it("mostra so o comeco do nome", () => {
    expect(maskEmail("marcello@gmail.com")).toBe("ma***@gmail.com");
    expect(maskEmail("jo@x.com")).toBe("j***@x.com");
    expect(maskEmail("a@x.com")).toBe("a***@x.com");
    expect(maskEmail("sem-arroba")).toBe("");
  });
});

describe("dispositivo lembrado", () => {
  it("nome curto pelo navegador e sistema", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      ),
    ).toBe("Chrome no macOS");
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari no iPhone");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      ),
    ).toBe("Edge no Windows");
    expect(deviceLabel("Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0")).toBe("Firefox no Android");
    expect(deviceLabel(null)).toBe("Navegador");
  });

  it("ultimo uso em dias", () => {
    const now = new Date(2026, 8, 22, 10, 0);
    expect(lastUsedLabel(new Date(2026, 8, 22, 8, 0), now)).toBe("Último uso hoje");
    expect(lastUsedLabel(new Date(2026, 8, 21, 23, 0), now)).toBe("Último uso ontem");
    expect(lastUsedLabel(new Date(2026, 8, 20, 9, 0), now)).toBe("Último uso há 2 dias");
  });
});

describe("conta so do Google", () => {
  it("nao oferece a verificacao: fica na conta Google", () => {
    expect(isGoogleOnlyAccount(["google"])).toBe(true);
    expect(isGoogleOnlyAccount(["google", "email"])).toBe(false);
    expect(isGoogleOnlyAccount(["email"])).toBe(false);
  });
});

describe("códigos de recuperação (regras)", () => {
  it("gera 8 códigos únicos no formato ABCD-EFGH, sem símbolos que se confundem", async () => {
    const { generateRecoveryCodes, RECOVERY_CODE_COUNT } = await import("../security/two-factor-rules");
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("normaliza o que a pessoa digita e recusa tamanho errado", async () => {
    const { normalizeRecoveryCode, hashRecoveryCode } = await import("../security/two-factor-rules");
    expect(normalizeRecoveryCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeRecoveryCode(" abcd efgh ")).toBe("ABCDEFGH");
    expect(normalizeRecoveryCode("abc")).toBe("");
    expect(hashRecoveryCode("u1", "ABCDEFGH")).not.toBe(hashRecoveryCode("u2", "ABCDEFGH"));
    expect(hashRecoveryCode("u1", "ABCDEFGH")).toMatch(/^[0-9a-f]{64}$/);
  });
});
