import { beforeEach, describe, expect, it, vi } from "vitest";

// Revisao geral de 31/10/2026 (achado S1): o cookie de sessao era assinado com
// o que o navegador mandasse. Conta real: as claims saem do banco, sempre para
// o usuario da sessao atual. Demonstracao: so o mesmo usuario e espaco.

const REAL_ORG = "6f0c1e2a-0000-4000-8000-000000000001";

const state = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  setCookie: vi.fn(),
  dbUser: null as Record<string, unknown> | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: state.setCookie, get: () => undefined, delete: vi.fn() }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/auth/get-current-user", () => ({ getCurrentUser: async () => state.current }));
vi.mock("@/lib/session-cookie", () => ({
  encodeSession: (user: Record<string, unknown>) => JSON.stringify(user),
  sessionCookieOptions: () => ({}),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.dbUser }) }) }) }),
    }),
  }),
}));
vi.mock("@/services/server/accountSetup", () => ({
  discardUnstartedOwnerAccount: vi.fn(),
  loadSessionPayload: async (_admin: unknown, dbUser: Record<string, unknown>) => ({
    user: { id: dbUser.id, organizationId: dbUser.organization_id, profile: dbUser.profile, name: dbUser.name },
  }),
}));

const { refreshSession } = await import("../actions");

const written = () => JSON.parse(state.setCookie.mock.calls.at(-1)?.[1] ?? "null");

beforeEach(() => {
  state.setCookie.mockClear();
  state.current = null;
  state.dbUser = null;
});

describe("refreshSession", () => {
  it("conta real: ignora o que o navegador manda e regrava a sessão pelo banco", async () => {
    state.current = { id: "usr-prof", organizationId: REAL_ORG, profile: "professional", name: "Prof" };
    state.dbUser = { id: "usr-prof", organization_id: REAL_ORG, profile: "professional", name: "Prof", status: "active" };
    await refreshSession({ id: "usr-owner", organizationId: REAL_ORG, profile: "owner", name: "Dono" } as never);
    expect(written()).toMatchObject({ id: "usr-prof", profile: "professional" });
  });

  it("conta real: usuário inativo no banco não ganha sessão nova", async () => {
    state.current = { id: "usr-prof", organizationId: REAL_ORG, profile: "professional", name: "Prof" };
    state.dbUser = { id: "usr-prof", organization_id: REAL_ORG, profile: "professional", name: "Prof", status: "inactive" };
    await refreshSession(state.current as never);
    expect(state.setCookie).not.toHaveBeenCalled();
  });

  it("demonstração: aceita o mesmo usuário e recusa trocar de identidade", async () => {
    state.current = { id: "usr-demo", organizationId: "org-academia-x", profile: "attendant", name: "Ana" };
    await refreshSession({ id: "usr-outro", organizationId: "org-academia-x", profile: "owner", name: "Outro" } as never);
    expect(state.setCookie).not.toHaveBeenCalled();
    await refreshSession({ id: "usr-demo", organizationId: "org-academia-x", profile: "attendant", name: "Ana Paula" } as never);
    expect(written()).toMatchObject({ id: "usr-demo", name: "Ana Paula" });
  });

  it("sem sessão: não grava nada", async () => {
    await refreshSession({ id: "usr-owner", organizationId: REAL_ORG, profile: "owner", name: "Dono" } as never);
    expect(state.setCookie).not.toHaveBeenCalled();
  });
});
