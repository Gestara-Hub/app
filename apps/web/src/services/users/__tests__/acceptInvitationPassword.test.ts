import { describe, expect, it, vi } from "vitest";
import { acceptInvitationAction } from "../acceptInvitationActions";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE, isPasswordLongEnough } from "@/lib/password-rules";

vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => undefined, get: () => undefined }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    throw new Error("O servidor não deve chegar ao banco com senha curta.");
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));

describe("senha do convite (achado 14)", () => {
  it("a regra é a mesma das outras telas: 8 caracteres", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(isPasswordLongEnough("abc123")).toBe(false);
    expect(isPasswordLongEnough("abc12345")).toBe(true);
  });

  it("o servidor recusa senha de 6 caracteres antes de tocar no banco", async () => {
    await expect(acceptInvitationAction({ token: "x", password: "abc123" })).resolves.toEqual({
      ok: false,
      message: PASSWORD_TOO_SHORT_MESSAGE,
    });
  });
});
