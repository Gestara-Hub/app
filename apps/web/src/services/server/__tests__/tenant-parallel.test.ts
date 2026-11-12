import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Login e perfil ao mesmo tempo (12/11/2026): a linha do usuario e buscada
 * junto com o `getUser`, pelo id da sessao local, e so vale se for da pessoa
 * que o Auth confirmou. Cliente do Supabase falso: registra a ordem das idas.
 */

const ORG = "org-1";
type Row = { id: string; auth_user_id: string; organization_id: string; profile: string; professional_id: null; organizations: null };
const rowOf = (authUserId: string, profile = "owner"): Row => ({
  id: `usr-${authUserId}`,
  auth_user_id: authUserId,
  organization_id: ORG,
  profile,
  professional_id: null,
  organizations: null,
});

let events: string[];
let sessionUserId: string | undefined;
let verifiedUserId: string | null;
let rows: Record<string, Row>;

function fakeClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: sessionUserId ? { user: { id: sessionUserId } } : null } }),
      getUser: async () => {
        events.push("getUser:start");
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push("getUser:end");
        return verifiedUserId
          ? { data: { user: { id: verifiedUserId, app_metadata: {}, factors: [] } }, error: null }
          : { data: { user: null }, error: null };
      },
    },
    from: () => {
      let wanted = "";
      const builder = {
        select: () => builder,
        or: (filter: string) => {
          wanted = /auth_user_id\.eq\.([^,]+)/.exec(filter)?.[1] ?? "";
          events.push(`users:${wanted}`);
          return builder;
        },
        eq: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: rows[wanted] ?? null, error: null }),
      };
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => fakeClient() }));
vi.mock("@/lib/security/second-factor", () => ({ secondFactorState: async () => "not_required" }));
vi.mock("@/lib/security/platform-admin", () => ({ isPlatformAdminUser: () => false }));
vi.mock("@/lib/log/server-sink", () => ({ setErrorScope: () => {} }));
vi.mock("../requestRoute", () => ({ requestRoute: async () => "/teste" }));

// O setup ja carregou o servidor de verdade: recarrega com os modulos falsos.
vi.resetModules();
const { requireTenant } = await import("../tenant");

beforeEach(() => {
  events = [];
  sessionUserId = "auth-ana";
  verifiedUserId = "auth-ana";
  rows = { "auth-ana": rowOf("auth-ana"), "auth-bia": rowOf("auth-bia", "attendant") };
});

describe("requireTenant", () => {
  it("busca o perfil enquanto o Auth confere o login (uma ida a menos em sequência)", async () => {
    const ctx = await requireTenant();
    expect(ctx.userId).toBe("usr-auth-ana");
    expect(events.indexOf("users:auth-ana")).toBeLessThan(events.indexOf("getUser:end"));
    expect(events.filter((e) => e.startsWith("users:"))).toEqual(["users:auth-ana"]);
  });

  it("sessão local com outro id: descarta a linha e busca pela pessoa confirmada", async () => {
    sessionUserId = "auth-bia";
    const ctx = await requireTenant();
    expect(ctx.userId).toBe("usr-auth-ana");
    expect(ctx.profile).toBe("owner");
    expect(events.filter((e) => e.startsWith("users:"))).toEqual(["users:auth-bia", "users:auth-ana"]);
  });

  it("Auth sem usuário: recusa mesmo com a linha já buscada", async () => {
    verifiedUserId = null;
    await expect(requireTenant()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sem sessão local: só busca depois do Auth", async () => {
    sessionUserId = undefined;
    const ctx = await requireTenant();
    expect(ctx.userId).toBe("usr-auth-ana");
    expect(events).toEqual(["getUser:start", "getUser:end", "users:auth-ana"]);
  });

  it("pessoa sem linha ativa no espaço: recusa", async () => {
    rows = {};
    await expect(requireTenant()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
