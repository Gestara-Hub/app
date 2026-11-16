import { afterEach, describe, expect, it, vi } from "vitest";

/** E-mail do painel que nao sai: fora de producao, o texto inteiro vai para o terminal. */

let accessKeyId: string | undefined;
let secretAccessKey: string | undefined;
vi.mock("@/lib/server/env", () => ({
  getEnv: () => ({
    AWS_ACCESS_KEY_ID: accessKeyId,
    AWS_SECRET_ACCESS_KEY: secretAccessKey,
    AWS_SES_REGION: "us-east-2",
  }),
}));

const { sendEmail } = await import("@/lib/server/email");

const mail = { to: { email: "pessoa@teste.com" }, subject: "Crie sua senha", text: "Link: http://localhost:3000/reset-password?token=abc" };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  accessKeyId = undefined;
  secretAccessKey = undefined;
});

describe("sendEmail sem envio", () => {
  it("sem chave: devolve false e mostra o texto com o link no terminal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await sendEmail(mail)).toBe(false);
    expect(String(warn.mock.calls[0]?.[0])).toContain("reset-password?token=abc");
  });

  it("Amazon SES recusando: também mostra o texto", async () => {
    accessKeyId = "teste";
    secretAccessKey = "segredo";
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ message: "Email address is not verified." }), { status: 400 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await sendEmail(mail)).toBe(false);
    expect(String(warn.mock.calls[0]?.[0])).toContain("reset-password?token=abc");
  });

  it("com credenciais válidas: envia para o endpoint do Amazon SES e devolve true", async () => {
    accessKeyId = "teste";
    secretAccessKey = "segredo";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ MessageId: "msg-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendEmail(mail)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://email.us-east-2.amazonaws.com/v2/email/outbound-emails");
  });

  it("com html em função no localhost, anexa o ícone inline e envia via SES", async () => {
    accessKeyId = "teste";
    secretAccessKey = "segredo";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ MessageId: "msg-html" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ok = await sendEmail({
      ...mail,
      html: ({ hasInlineIcon }) => `<p>${hasInlineIcon ? "cid:gestarahub-icon" : "sem-icone"}</p>`,
    });
    expect(ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { Content: { Raw?: { Data?: string } } };
    const mime = Buffer.from(payload.Content.Raw?.Data ?? "", "base64").toString("utf8");
    expect(mime).toContain("Content-ID: <gestarahub-icon>");
  });

  it("em produção nada do texto vai para o terminal", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await sendEmail(mail)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
