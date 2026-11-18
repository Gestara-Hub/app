import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Entrega da fila (doc technical/07 §1.1 e §3.3): sai pelo numero do proprio
 * espaco, por modelo aprovado quando o registro tem um, e a falha da Meta vira
 * um motivo em portugues no Historico. Meta e banco falsos.
 */
const db = vi.hoisted(() => ({ updates: [] as Array<Record<string, unknown>> }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => {
        db.updates.push(values);
        const chain = { eq: () => chain, then: (resolve: (v: { error: null }) => void) => resolve({ error: null }) };
        return chain;
      },
    }),
  }),
}));

type Modules = {
  deliver: typeof import("@/services/communication/messageDelivery").deliverQueuedMessage;
  setGateway: typeof import("@/services/communication/whatsappCredentialsGateway").setWhatsAppCredentialsGateway;
};
let m: Modules;

beforeAll(async () => {
  // O setup dos testes ja carregou os modulos com o banco real: carrega de novo, com o falso.
  vi.resetModules();
  const delivery = await import("@/services/communication/messageDelivery");
  const gateway = await import("@/services/communication/whatsappCredentialsGateway");
  m = { deliver: delivery.deliverQueuedMessage, setGateway: gateway.setWhatsAppCredentialsGateway };
});

let requests: Array<{ url: string; body: Record<string, unknown> }> = [];
let reply: { status: number; data: unknown } = { status: 200, data: { messages: [{ id: "wamid.1" }] } };

beforeEach(() => {
  db.updates = [];
  requests = [];
  reply = { status: 200, data: { messages: [{ id: "wamid.1" }] } };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify(reply.data), { status: reply.status });
    }),
  );
  m.setGateway({
    connect: vi.fn(),
    disconnect: vi.fn(),
    syncTemplates: vi.fn(async () => undefined),
    configFor: vi.fn(async (org: string) =>
      org === "org_1" ? { apiToken: "space-token", phoneNumberId: "1111111111", businessAccountId: "2222222222" } : null,
    ),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  m.setGateway(null);
});

const job = {
  logId: "log-1",
  organizationId: "org_1",
  phone: "5511977770000",
  content: "Olá, Maria!",
};

describe("entrega da fila", () => {
  it("com modelo: envia o modelo pelo numero do espaco, com as variaveis em ordem", async () => {
    await m.deliver({ ...job, template: { name: "welcome_student", language: "pt_BR", params: ["Maria", "Academia"] } });
    expect(requests[0]!.url).toContain("/1111111111/messages");
    expect(requests[0]!.body).toMatchObject({
      type: "template",
      template: {
        name: "welcome_student",
        language: { code: "pt_BR" },
        components: [{ type: "body", parameters: [{ type: "text", text: "Maria" }, { type: "text", text: "Academia" }] }],
      },
    });
    expect(db.updates[0]).toMatchObject({ id: "wamid.1", status: "sent" });
  });

  it("sem modelo: texto livre", async () => {
    await m.deliver(job);
    expect(requests[0]!.body).toMatchObject({ type: "text", text: { body: "Olá, Maria!" } });
  });

  it("fora da janela de 24 horas: falha com o motivo em portugues", async () => {
    reply = { status: 400, data: { error: { message: "Re-engagement message", code: 131047 } } };
    await m.deliver(job);
    expect(db.updates[0]).toEqual({
      status: "failed",
      error_reason: "Fora da janela de 24 horas: esta mensagem precisa de um modelo aprovado no WhatsApp.",
    });
  });

  it("espaco sem o WhatsApp conectado nao envia pelo numero de outro", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      await m.deliver({ ...job, organizationId: "org_sem" });
    } finally {
      vi.unstubAllEnvs();
    }
    expect(requests).toHaveLength(0);
    expect(db.updates[0]).toMatchObject({ status: "failed" });
  });
});
