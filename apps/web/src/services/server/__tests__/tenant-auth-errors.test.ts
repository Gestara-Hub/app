import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isTransientAuthError } from "../tenant";

/**
 * Falha passageira do servico de login nao desloga (11/11/2026): no pico de
 * 100 chamadas simultaneas, o Auth falhou e a pessoa ia para o login com
 * "Sua sessão expirou".
 */
describe("erro do servico de login", () => {
  it("rede, sobrecarga e limite de pedidos: tentar de novo", () => {
    expect(isTransientAuthError(new AuthRetryableFetchError("fetch failed", 0))).toBe(true);
    expect(isTransientAuthError(new AuthApiError("too many", 429, "over_request_rate_limit"))).toBe(true);
    expect(isTransientAuthError(new AuthApiError("bad gateway", 502, undefined))).toBe(true);
  });

  it("sessao invalida ou ausente: entra de novo", () => {
    expect(isTransientAuthError(new AuthApiError("invalid JWT", 401, "bad_jwt"))).toBe(false);
    expect(isTransientAuthError(new AuthApiError("user not found", 403, "user_not_found"))).toBe(false);
    expect(isTransientAuthError(new AuthSessionMissingError())).toBe(false);
    expect(isTransientAuthError(null)).toBe(false);
  });
});
