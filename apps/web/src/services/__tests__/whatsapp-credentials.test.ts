import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Credenciais do WhatsApp de cada espaco (doc technical/07 §1.1): o codigo do
 * cadastro guiado vira o token do espaco, que vai para o Vault; numero novo e
 * registrado com PIN, coexistencia nao; os avisos da conta sao inscritos.
 * Meta e banco falsos.
 */
const db = vi.hoisted(() => ({
  rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  saveError: null as null | { code: string; message: string },
  stored: null as null | Record<string, unknown>,
  deleted: [] as string[],
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.rpc.push({ fn, args });
      if (fn === "whatsapp_credentials_save") return { error: db.saveError };
      if (fn === "whatsapp_credentials_get") return { data: db.stored ? [db.stored] : [], error: null };
      return { error: null };
    },
    from: () => ({
      delete: () => ({
        eq: async (_col: string, org: string) => {
          db.deleted.push(org);
          return { error: null };
        },
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          db.updates.push(values);
          return { error: null };
        },
      }),
    }),
  }),
}));

// O setup dos testes ja carregou o modulo com o banco real: carrega de novo, com o falso.
let whatsappCredentialsGateway: typeof import("@/services/communication/whatsappCredentials").whatsappCredentialsGateway;
beforeAll(async () => {
  vi.resetModules();
  ({ whatsappCredentialsGateway } = await import("@/services/communication/whatsappCredentials"));
});

type Call = { method: string; url: string; body?: unknown };
let calls: Call[] = [];
let failOn: string | null = null;

function fakeMeta() {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
    if (failOn && url.includes(failOn)) return json(400, { error: { message: "Recusado", code: 100 } });
    if (url.includes("/oauth/access_token")) return json(200, { access_token: "space-token" });
    if (url.includes("fields=verified_name")) {
      return json(200, { id: "1111111111", verified_name: "Academia Ribeiro", display_phone_number: "+55 92 98888-7777" });
    }
    return json(200, { success: true });
  });
}

const input = {
  organizationId: "org_1",
  code: "one-time",
  phoneNumberId: "1111111111",
  wabaId: "2222222222",
};

beforeEach(() => {
  db.rpc = [];
  db.saveError = null;
  db.stored = null;
  db.deleted = [];
  db.updates = [];
  calls = [];
  failOn = null;
  vi.stubEnv("META_APP_ID", "app-1");
  vi.stubEnv("META_APP_SECRET", "secret-1");
  vi.stubGlobal("fetch", fakeMeta());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("conectar o numero do espaco", () => {
  it("numero novo: troca o codigo, guarda token e PIN, registra e inscreve os avisos", async () => {
    const result = await whatsappCredentialsGateway.connect({ ...input, onboarding: "cloud" });
    expect(result).toEqual({ displayPhoneNumber: "+55 92 98888-7777", verifiedName: "Academia Ribeiro" });

    const exchange = calls[0]!;
    expect(exchange.url).toContain("/oauth/access_token?client_id=app-1&client_secret=secret-1&code=one-time");

    const save = db.rpc.find((r) => r.fn === "whatsapp_credentials_save")!;
    expect(save.args).toMatchObject({
      p_organization_id: "org_1",
      p_phone_number_id: "1111111111",
      p_waba_id: "2222222222",
      p_onboarding: "cloud",
      p_token: "space-token",
    });
    expect(String(save.args.p_pin)).toMatch(/^\d{6}$/);

    const register = calls.find((c) => c.url.endsWith("/1111111111/register"))!;
    expect(register).toMatchObject({ method: "POST", body: { messaging_product: "whatsapp", pin: save.args.p_pin } });
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/2222222222/subscribed_apps"))).toBe(true);
    expect(Object.keys(db.updates[0]!)).toEqual(["registered_at", "subscribed_at"]);
  });

  it("coexistencia (app WhatsApp Business no mesmo numero): sem registro e sem PIN", async () => {
    await whatsappCredentialsGateway.connect({ ...input, onboarding: "coexistence" });
    expect(db.rpc.find((r) => r.fn === "whatsapp_credentials_save")!.args.p_pin).toBeNull();
    expect(calls.some((c) => c.url.includes("/register"))).toBe(false);
    expect(calls.some((c) => c.url.endsWith("/subscribed_apps"))).toBe(true);
  });

  it("id que nao e numero da Meta nao chega a Graph API", async () => {
    await expect(
      whatsappCredentialsGateway.connect({ ...input, phoneNumberId: "../me", onboarding: "cloud" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(calls).toHaveLength(0);
  });

  it("sem o segredo do app da Meta, nao conecta", async () => {
    vi.stubEnv("META_APP_SECRET", "");
    await expect(whatsappCredentialsGateway.connect({ ...input, onboarding: "cloud" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(calls).toHaveLength(0);
  });

  it("numero ja ligado a outro espaco e recusado", async () => {
    db.saveError = { code: "PT409", message: "whatsapp: numero ligado a outro espaco" };
    await expect(whatsappCredentialsGateway.connect({ ...input, onboarding: "cloud" })).rejects.toMatchObject({
      message: "Este número já está conectado a outro espaço no GestaraHub.",
    });
    expect(calls.some((c) => c.url.includes("/register"))).toBe(false);
  });

  it("falha ao inscrever os avisos apaga as credenciais guardadas", async () => {
    failOn = "subscribed_apps";
    await expect(whatsappCredentialsGateway.connect({ ...input, onboarding: "coexistence" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(db.deleted).toEqual(["org_1"]);
  });
});

describe("usar e desconectar", () => {
  it("configuracao do espaco vem do Vault; sem credencial, null", async () => {
    expect(await whatsappCredentialsGateway.configFor("org_sem")).toBeNull();
    db.stored = { phone_number_id: "1111111111", waba_id: "2222222222", token: "space-token" };
    expect(await whatsappCredentialsGateway.configFor("org_2")).toEqual({
      apiToken: "space-token",
      phoneNumberId: "1111111111",
      businessAccountId: "2222222222",
    });
  });

  it("desconectar cancela os avisos na conta e apaga as credenciais", async () => {
    db.stored = { phone_number_id: "1111111111", waba_id: "2222222222", token: "space-token" };
    await whatsappCredentialsGateway.disconnect("org_3");
    expect(calls).toEqual([{ method: "DELETE", url: expect.stringContaining("/2222222222/subscribed_apps"), body: undefined }]);
    expect(db.deleted).toEqual(["org_3"]);
  });
});
