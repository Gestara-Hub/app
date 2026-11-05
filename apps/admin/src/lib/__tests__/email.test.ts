import { afterEach, describe, expect, it, vi } from "vitest";

/** E-mail do painel que nao sai: fora de producao, o texto inteiro vai para o terminal. */

let apiKey: string | undefined;
vi.mock("@/lib/server/env", () => ({ getEnv: () => ({ MAILERSEND_API_KEY: apiKey }) }));

const { sendEmail } = await import("@/lib/server/email");

const mail = { to: { email: "pessoa@teste.com" }, subject: "Crie sua senha", text: "Link: http://localhost:3000/reset-password?token=abc" };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  apiKey = undefined;
});

describe("sendEmail sem envio", () => {
  it("sem chave: devolve false e mostra o texto com o link no terminal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await sendEmail(mail)).toBe(false);
    expect(String(warn.mock.calls[0]?.[0])).toContain("reset-password?token=abc");
  });

  it("MailerSend recusando: também mostra o texto", async () => {
    apiKey = "teste";
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 422 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await sendEmail(mail)).toBe(false);
    expect(String(warn.mock.calls[0]?.[0])).toContain("reset-password?token=abc");
  });

  it("em produção nada do texto vai para o terminal", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await sendEmail(mail)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
