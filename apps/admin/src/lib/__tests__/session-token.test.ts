import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_SECONDS, signSessionStart, verifySessionStart } from "../session-token";

const SECRET = "x".repeat(40);
const USER = "11111111-1111-1111-1111-111111111111";
const T0 = Date.UTC(2026, 9, 24, 12, 0, 0);

describe("tempo de sessão do painel (8 horas)", () => {
  it("vale logo depois de entrar e até quase 8 horas", () => {
    const token = signSessionStart(SECRET, USER, T0);
    expect(verifySessionStart(SECRET, USER, token, T0 + 1000)).toEqual({ ok: true, startedAtMs: T0 });
    expect(verifySessionStart(SECRET, USER, token, T0 + SESSION_MAX_AGE_SECONDS * 1000 - 1).ok).toBe(true);
  });

  it("vence com 8 horas", () => {
    const token = signSessionStart(SECRET, USER, T0);
    expect(verifySessionStart(SECRET, USER, token, T0 + SESSION_MAX_AGE_SECONDS * 1000)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("recusa cookie ausente, adulterado, de outro usuário ou assinado com outro segredo", () => {
    const token = signSessionStart(SECRET, USER, T0);
    expect(verifySessionStart(SECRET, USER, undefined, T0)).toEqual({ ok: false, reason: "missing" });
    // O navegador tenta estender o início: a assinatura não confere.
    const forged = token.replace(String(T0), String(T0 + 60 * 60 * 1000));
    expect(verifySessionStart(SECRET, USER, forged, T0 + 10 * 60 * 60 * 1000)).toEqual({ ok: false, reason: "invalid" });
    expect(verifySessionStart(SECRET, "22222222-2222-2222-2222-222222222222", token, T0).ok).toBe(false);
    expect(verifySessionStart("y".repeat(40), USER, token, T0).ok).toBe(false);
    expect(verifySessionStart(SECRET, USER, "lixo", T0).ok).toBe(false);
  });

  it("recusa início no futuro (relógio adulterado)", () => {
    const token = signSessionStart(SECRET, USER, T0 + 60 * 60 * 1000);
    expect(verifySessionStart(SECRET, USER, token, T0)).toEqual({ ok: false, reason: "invalid" });
  });
});
