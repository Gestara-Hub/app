import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildErrorDigestHtml,
  buildOrganizationInvitationEmailHtml,
  buildOrganizationInvitationEmailText,
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  sendErrorDigestEmail,
  sendSignupLinkEmail,
  sendWelcomeEmail,
} from "../ses";
import { sendSupportNotice } from "../support-mail";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("envio de e-mails via Amazon SES (apps/web)", () => {
  it("em desenvolvimento sem credenciais, imprime o link no terminal e devolve ok", async () => {
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await sendSignupLinkEmail({
      toEmail: "ana@exemplo.com",
      toName: "Ana",
      signupUrl: "http://localhost:3200/login?signup=123",
    });

    expect(result).toEqual({ ok: true });
    expect(String(warn.mock.calls[0]?.[1])).toContain("signup=123");
  });

  it("em produção sem credenciais, registra erro e falha sem vazar link", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_NOW", undefined);
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await sendSignupLinkEmail({
      toEmail: "ana@exemplo.com",
      toName: "Ana",
      signupUrl: "https://gestarahub.com.br/login?signup=123",
    });

    expect(result.ok).toBe(false);
    expect(errorLog).toHaveBeenCalled();
    expect(String(errorLog.mock.calls[0]?.[0])).toContain("Falha de envio em produção");
    expect(warn).not.toHaveBeenCalled();
  });

  it("com credenciais, envia para o endpoint do SES na região configurada com anexo inline em dev", async () => {
    vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIA-TEST");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "SECRET-TEST");
    vi.stubEnv("AWS_SES_REGION", "us-east-2");
    vi.stubEnv("EMAIL_REPLY_TO", "suporte@gestarahub.com.br");

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ MessageId: "ses-ok" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWelcomeEmail({
      toEmail: "ana@exemplo.com",
      toName: "Ana Silva",
      appUrl: "http://localhost:3200",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://email.us-east-2.amazonaws.com/v2/email/outbound-emails");
    const payload = JSON.parse(String(init.body)) as {
      ReplyToAddresses?: string[];
      Content: { Raw?: { Data?: string } };
    };
    expect(payload.ReplyToAddresses?.[0]).toContain("suporte@gestarahub.com.br");
    const mime = Buffer.from(payload.Content.Raw?.Data ?? "", "base64").toString("utf8");
    expect(mime).toContain("Content-ID: <gestarahub-icon>");
    expect(mime).toContain("Content-ID: <gestarahub-instagram>");
  });

  it("sendErrorDigestEmail devolve erro legível quando o SES recusa", async () => {
    vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIA-TEST");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "SECRET-TEST");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "Signature mismatch" }), { status: 403 })),
    );

    const result = await sendErrorDigestEmail({
      toEmail: "ops@gestarahub.com.br",
      total: 1,
      rows: [
        {
          event: "cron.test",
          message: "Falhou",
          count: 1,
          level: "error",
          source: "cron",
          last_seen: "2026-11-16T12:00:00Z",
          last_reference: "ERR1",
          organization_id: null,
          isNew: true,
        },
      ],
    });

    expect(result).toEqual({ ok: false, error: "Amazon SES 403: Signature mismatch" });
  });

  it("sendSupportNotice envia aviso de suporte pelo Amazon SES", async () => {
    vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIA-TEST");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "SECRET-TEST");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ MessageId: "ses-sup" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const ok = await sendSupportNotice({
      kind: "new",
      number: 42,
      urgent: false,
      subject: "Dúvida",
      spaceName: "Academia X",
      userName: "Ana",
      userEmail: "ana@exemplo.com",
      preview: "Olá",
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("e-mail de convite usa linguagem neutra em gênero e não inclui o slogan no rodapé", () => {
    const input = {
      toEmail: "jessica@exemplo.com",
      toName: "Jessica Silva",
      organizationName: "Dojo Norte",
      profileLabel: "Proprietário",
      inviteUrl: "https://app.gestarahub.com.br/accept-invite?token=abc",
      expiresInDays: 7,
    };
    const html = buildOrganizationInvitationEmailHtml({ ...input, hasInlineIcon: false });
    const text = buildOrganizationInvitationEmailText(input);

    for (const content of [html, text]) {
      expect(content).toContain("Você recebeu um convite, Jessica!");
      expect(content).toContain("com o perfil de acesso Proprietário");
      expect(content).toContain("peça a quem administra o espaço para reenviar");
      expect(content).not.toContain("Você foi convidado");
      expect(content).not.toContain("como Proprietário");
      expect(content).not.toContain("um administrador");
    }
    expect(html).toContain("porque quem administra Dojo Norte cadastrou seu e-mail");
    expect(html).not.toContain("Gestão simples para escolas, estúdios e academias.");
  });

  it("e-mail de boas-vindas usa linguagem neutra em gênero", async () => {
    vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIA-TEST");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "SECRET-TEST");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ MessageId: "ses-welcome" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendWelcomeEmail({
      toEmail: "jessica@exemplo.com",
      toName: "Jessica Silva",
      appUrl: "https://app.gestarahub.com.br",
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as {
      Content: { Simple?: { Subject?: { Data?: string } }; Raw?: { Data?: string } };
    };
    const subjectSource =
      payload.Content.Simple?.Subject?.Data ?? Buffer.from(payload.Content.Raw?.Data ?? "", "base64").toString("utf8");
    expect(subjectSource).toContain("Boas-vindas ao GestaraHub");

    const html = buildWelcomeEmailHtml({
      toEmail: "jessica@exemplo.com",
      toName: "Jessica Silva",
      appUrl: "https://app.gestarahub.com.br",
      hasInlineIcon: false,
      hasInstagramIcon: false,
    });
    const text = buildWelcomeEmailText({
      toEmail: "jessica@exemplo.com",
      toName: "Jessica Silva",
      appUrl: "https://app.gestarahub.com.br",
      replyTo: "contato@gestarahub.com.br",
    });

    for (const content of [html, text]) {
      expect(content).toContain("Que bom ter você aqui, Jessica!");
      expect(content).not.toContain("Bem-vindo");
    }
  });

  it("buildErrorDigestHtml gera card operacional com badges e escape", () => {
    const html = buildErrorDigestHtml({
      total: 2,
      mode: "daily",
      rows: [
        {
          event: "asaas.webhook",
          message: "Erro <grave>",
          count: 2,
          level: "error",
          source: "api",
          last_seen: "2026-11-16T12:00:00Z",
          last_reference: "GH-91",
          organization_id: "org-1",
          isNew: true,
        },
      ],
      icon: { hasInlineIcon: false, hostedIconUrl: null },
    });
    expect(html).toContain("RESUMO 24H");
    expect(html).toContain("api/asaas.webhook");
    expect(html).toContain("Erro &lt;grave&gt;");
    expect(html).toContain("Código GH-91");
  });
});
