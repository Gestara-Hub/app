import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import {
  DEFAULT_AWS_SES_REGION,
  buildSesRawMimeMessage,
  emailSenderFromEnv,
  formatSesAddress,
  sendSesEmail,
  sesCredentialsFromEnv,
  sesOutboundEndpoint,
  signSesV2Request,
} from "../src/ses.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restoreAll();
});

describe("credenciais e remetente do AWS SES", () => {
  it("devolve null sem AWS_ACCESS_KEY_ID ou AWS_SECRET_ACCESS_KEY", () => {
    assert.equal(sesCredentialsFromEnv({}), null);
    assert.equal(sesCredentialsFromEnv({ AWS_ACCESS_KEY_ID: "AKIA..." }), null);
    assert.equal(sesCredentialsFromEnv({ AWS_SECRET_ACCESS_KEY: "secret" }), null);
  });

  it("usa us-east-2 por padrão e aceita AWS_SES_REGION acima de AWS_REGION", () => {
    assert.deepEqual(
      sesCredentialsFromEnv({ AWS_ACCESS_KEY_ID: " key ", AWS_SECRET_ACCESS_KEY: " sec " }),
      { accessKeyId: "key", secretAccessKey: "sec", region: DEFAULT_AWS_SES_REGION },
    );
    assert.deepEqual(
      sesCredentialsFromEnv({
        AWS_ACCESS_KEY_ID: "key",
        AWS_SECRET_ACCESS_KEY: "sec",
        AWS_REGION: "sa-east-1",
        AWS_SES_REGION: "us-east-1",
      }),
      { accessKeyId: "key", secretAccessKey: "sec", region: "us-east-1" },
    );
  });

  it("aplica valores padrão ao remetente", () => {
    assert.deepEqual(emailSenderFromEnv({}), {
      email: "naoresponda@gestarahub.com.br",
      name: "GestaraHub",
    });
    assert.deepEqual(
      emailSenderFromEnv({ EMAIL_FROM_ADDRESS: "contato@gestarahub.com.br", EMAIL_FROM_NAME: "Equipe" }),
      { email: "contato@gestarahub.com.br", name: "Equipe" },
    );
  });
});

describe("formatação de endereço RFC 5322 / RFC 2047", () => {
  it("formata sem nome, com nome ASCII e com nome acentuado em Base64 UTF-8", () => {
    assert.equal(formatSesAddress({ email: "ana@exemplo.com" }), "ana@exemplo.com");
    assert.equal(formatSesAddress({ email: "ana@exemplo.com", name: "GestaraHub" }), "GestaraHub <ana@exemplo.com>");
    assert.equal(formatSesAddress({ email: "ana@exemplo.com", name: "Silva, Ana" }), '"Silva, Ana" <ana@exemplo.com>');
    const encoded = formatSesAddress({ email: "joao@exemplo.com", name: "João Silva" });
    assert.equal(encoded, `=?UTF-8?B?${Buffer.from("João Silva", "utf8").toString("base64")}?= <joao@exemplo.com>`);
  });

  it("remove quebras de linha para evitar injeção de cabeçalho", () => {
    assert.equal(
      formatSesAddress({ email: "ana@exemplo.com\r\nBcc: evil@x.com", name: "Ana\nTeste" }),
      "Ana Teste <ana@exemplo.com Bcc: evil@x.com>",
    );
  });
});

describe("assinatura AWS SigV4 para SES v2", () => {
  it("gera Authorization com escopo ses, x-amz-date e assinatura determinística", () => {
    const body = JSON.stringify({ ok: true });
    const now = new Date("2026-11-16T15:30:45.123Z");
    const headers = signSesV2Request({
      accessKeyId: "AKIAEXAMPLE",
      secretAccessKey: "secret-example",
      region: "us-east-2",
      host: "email.us-east-2.amazonaws.com",
      path: "/v2/email/outbound-emails",
      body,
      now,
    });

    assert.equal(headers["X-Amz-Date"], "20261116T153045Z");
    assert.equal(headers["Content-Type"], "application/json");
    assert.match(
      headers.Authorization,
      /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/20261116\/us-east-2\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/,
    );

    // Conferencia independente do HMAC SigV4 sobre os mesmos dados.
    const payloadHash = createHash("sha256").update(body).digest("hex");
    const canonical =
      "POST\n/v2/email/outbound-emails\n\ncontent-type:application/json\nhost:email.us-east-2.amazonaws.com\nx-amz-date:20261116T153045Z\n\ncontent-type;host;x-amz-date\n" +
      payloadHash;
    const stringToSign =
      "AWS4-HMAC-SHA256\n20261116T153045Z\n20261116/us-east-2/ses/aws4_request\n" +
      createHash("sha256").update(canonical).digest("hex");
    const kDate = createHmac("sha256", "AWS4secret-example").update("20261116").digest();
    const kRegion = createHmac("sha256", kDate).update("us-east-2").digest();
    const kService = createHmac("sha256", kRegion).update("ses").digest();
    const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
    const expectedSig = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
    assert.ok(headers.Authorization.endsWith(`Signature=${expectedSig}`));
  });

  it("recusa região fora do padrão seguro de host AWS", () => {
    assert.throws(() => sesOutboundEndpoint("us-east-2.evil.com"), /Região AWS SES inválida/);
  });
});

describe("sendSesEmail", () => {
  it("monta Content.Simple quando não há anexos e devolve MessageId", async () => {
    let seenUrl = "";
    let seenBody: Record<string, unknown> = {};
    let seenHeaders: Record<string, string> = {};

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seenUrl = String(input);
      seenBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      seenHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify({ MessageId: "ses-msg-123" }), { status: 200 });
    }) as typeof fetch;

    const result = await sendSesEmail({
      credentials: { accessKeyId: "AKIA1", secretAccessKey: "SEC1", region: "us-east-2" },
      from: { email: "naoresponda@gestarahub.com.br", name: "GestaraHub" },
      to: [{ email: "aluno@exemplo.com", name: "Ana Silva" }],
      replyTo: [{ email: "contato@gestarahub.com.br", name: "GestaraHub" }],
      subject: "Bem-vindo\naui",
      html: "<p>Oi</p>",
      text: "Oi",
    });

    assert.deepEqual(result, { ok: true, messageId: "ses-msg-123" });
    assert.equal(seenUrl, "https://email.us-east-2.amazonaws.com/v2/email/outbound-emails");
    assert.ok(seenHeaders.Authorization.includes("/us-east-2/ses/aws4_request"));
    assert.deepEqual(seenBody, {
      FromEmailAddress: "GestaraHub <naoresponda@gestarahub.com.br>",
      Destination: { ToAddresses: ["Ana Silva <aluno@exemplo.com>"] },
      ReplyToAddresses: ["GestaraHub <contato@gestarahub.com.br>"],
      Content: {
        Simple: {
          Subject: { Data: "Bem-vindo aui", Charset: "UTF-8" },
          Body: {
            Html: { Data: "<p>Oi</p>", Charset: "UTF-8" },
            Text: { Data: "Oi", Charset: "UTF-8" },
          },
        },
      },
    });
  });

  it("com anexo inline, envia Content.Raw em multipart/related com Content-ID e base64", async () => {
    let seenBody: Record<string, unknown> = {};
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ MessageId: "ses-raw-1" }), { status: 200 });
    }) as typeof fetch;

    const result = await sendSesEmail({
      credentials: { accessKeyId: "AKIA1", secretAccessKey: "SEC1", region: "us-east-2" },
      from: { email: "naoresponda@gestarahub.com.br", name: "GestaraHub" },
      to: [{ email: "aluno@exemplo.com", name: "Ana Silva" }],
      replyTo: [{ email: "contato@gestarahub.com.br", name: "GestaraHub" }],
      subject: "Você foi convidado",
      html: '<img src="cid:gestarahub-icon" />',
      text: "Oi",
      attachments: [
        {
          fileName: "email-icon.png",
          contentType: "image/png",
          contentDisposition: "INLINE",
          contentId: "gestarahub-icon",
          rawContentBase64: "AAAA",
        },
      ],
    });

    assert.deepEqual(result, { ok: true, messageId: "ses-raw-1" });
    const rawData = (seenBody.Content as { Raw?: { Data?: string } }).Raw?.Data;
    assert.ok(rawData);
    const mime = Buffer.from(rawData, "base64").toString("utf8");
    assert.ok(mime.includes("Content-Type: multipart/related;"));
    assert.ok(mime.includes("Content-Type: multipart/alternative;"));
    assert.ok(mime.includes("Content-ID: <gestarahub-icon>"));
    assert.ok(mime.includes('Content-Disposition: inline; filename="email-icon.png"'));
    assert.ok(mime.includes("Content-Transfer-Encoding: base64"));
    assert.ok(mime.includes("Subject: =?UTF-8?B?"));
    for (const line of mime.split("\r\n")) {
      assert.ok(line.length <= 998, `linha MIME longa demais (${line.length})`);
    }
  });

  it("buildSesRawMimeMessage separa partes inline e anexos comuns quando existem os dois", () => {
    const mime = buildSesRawMimeMessage({
      credentials: { accessKeyId: "AKIA1", secretAccessKey: "SEC1", region: "us-east-2" },
      from: { email: "naoresponda@gestarahub.com.br" },
      to: [{ email: "a@b.com" }],
      subject: "Teste",
      html: "<p>Oi</p>",
      attachments: [
        { fileName: "icon.png", contentType: "image/png", contentDisposition: "INLINE", contentId: "ic1", rawContentBase64: "AAAA" },
        { fileName: "doc.pdf", contentType: "application/pdf", contentDisposition: "ATTACHMENT", rawContentBase64: "BBBB" },
      ],
    });
    assert.ok(mime.includes("Content-Type: multipart/mixed;"));
    assert.ok(mime.includes("Content-Type: multipart/related;"));
    assert.ok(mime.includes("Content-ID: <ic1>"));
    assert.ok(mime.includes('Content-Disposition: attachment; filename="doc.pdf"'));
  });

  it("extrai erro HTTP e header x-amzn-errortype quando o SES recusa", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "Email address is not verified." }), {
        status: 400,
        headers: { "x-amzn-errortype": "MessageRejectedException:http://..." },
      })) as typeof fetch;

    const result = await sendSesEmail({
      credentials: { accessKeyId: "AKIA1", secretAccessKey: "SEC1", region: "us-east-2" },
      from: { email: "naoresponda@gestarahub.com.br" },
      to: [{ email: "nao-verificado@exemplo.com" }],
      subject: "Teste",
      text: "Oi",
    });

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      errorType: "MessageRejectedException",
      error: "MessageRejectedException: Email address is not verified.",
    });
  });

  it("tenta de novo quando o SES está fora (5xx) e para no sucesso", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return calls === 1
        ? new Response("Service Unavailable", { status: 503 })
        : new Response(JSON.stringify({ MessageId: "m-1" }), { status: 200 });
    }) as typeof fetch;

    const result = await sendSesEmail({
      credentials: { accessKeyId: "AKIA1", secretAccessKey: "SEC1", region: "us-east-2" },
      from: { email: "naoresponda@gestarahub.com.br" },
      to: [{ email: "ana@exemplo.com" }],
      subject: "Teste",
      text: "Oi",
      retryDelaysMs: [0, 0],
    });

    assert.deepEqual(result, { ok: true, messageId: "m-1" });
    assert.equal(calls, 2);
  });

  it("não tenta de novo quando o SES recusa o e-mail (4xx)", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ message: "Email address is not verified." }), { status: 400 });
    }) as typeof fetch;

    const result = await sendSesEmail({
      credentials: { accessKeyId: "AKIA1", secretAccessKey: "SEC1", region: "us-east-2" },
      from: { email: "naoresponda@gestarahub.com.br" },
      to: [{ email: "ana@exemplo.com" }],
      subject: "Teste",
      text: "Oi",
      retryDelaysMs: [0, 0],
    });

    assert.equal(result.ok, false);
    assert.equal(calls, 1);
  });

  it("falha de rede em todas as tentativas: três tentativas e o erro", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    const result = await sendSesEmail({
      credentials: { accessKeyId: "AKIA1", secretAccessKey: "SEC1", region: "us-east-2" },
      from: { email: "naoresponda@gestarahub.com.br" },
      to: [{ email: "ana@exemplo.com" }],
      subject: "Teste",
      text: "Oi",
      retryDelaysMs: [0, 0],
    });

    assert.deepEqual(result, { ok: false, error: "fetch failed" });
    assert.equal(calls, 3);
  });
});
