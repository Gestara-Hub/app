import { createHash, createHmac, randomUUID } from "node:crypto";

/**
 * Cliente enxuto para a Amazon SES API v2 (`POST /v2/email/outbound-emails`),
 * assinado com AWS Signature Version 4 usando apenas `node:crypto` e `fetch`.
 */

export const DEFAULT_AWS_SES_REGION = "us-east-2";
export const DEFAULT_EMAIL_FROM_ADDRESS = "naoresponda@gestarahub.com.br";
export const DEFAULT_EMAIL_FROM_NAME = "GestaraHub";

export interface SesCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface SesEmailRecipient {
  email: string;
  name?: string;
}

export interface SesEmailAttachment {
  fileName: string;
  contentType: string;
  contentDisposition: "INLINE" | "ATTACHMENT";
  contentId?: string;
  rawContentBase64: string;
}

export interface SendSesEmailInput {
  credentials: SesCredentials;
  from: SesEmailRecipient;
  to: SesEmailRecipient[];
  replyTo?: SesEmailRecipient[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: SesEmailAttachment[];
  now?: Date;
  /** Esperas entre as tentativas (falha de rede, limite ou SES fora). Padrao: 0,5 s e 1,5 s. */
  retryDelaysMs?: number[];
  /** Tempo maximo de cada tentativa. Padrao: 10 s. */
  timeoutMs?: number;
}

/** Falha que vale tentar de novo: rede, tempo esgotado, limite de envio (429) ou SES fora (5xx). */
export function isRetryableSesFailure(result: SendSesEmailResult): boolean {
  if (result.ok) return false;
  if (result.status === undefined) return true;
  return result.status === 429 || result.status >= 500;
}

const SES_RETRY_DELAYS_MS = [500, 1500];
const SES_TIMEOUT_MS = 10_000;

export type SendSesEmailResult =
  | { ok: true; messageId?: string }
  | { ok: false; status?: number; errorType?: string; error: string };

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeMimeHeaderValue(value: string): string {
  const clean = sanitizeHeader(value);
  if (!clean || !/[^\x20-\x7e]/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function wrapBase64(base64: string): string {
  const clean = base64.replace(/\s+/g, "");
  return clean.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function encodeUtf8Base64(text: string): string {
  return wrapBase64(Buffer.from(text, "utf8").toString("base64"));
}

/**
 * Formata destinatario ou remetente em RFC 5322, codificando nomes com
 * acentuacao em RFC 2047 (`=?UTF-8?B?...?=`) para evitar rejeicao ou corrupcao.
 */
export function formatSesAddress({ email, name }: SesEmailRecipient): string {
  const cleanEmail = sanitizeHeader(email);
  const cleanName = name ? sanitizeHeader(name) : "";
  if (!cleanName || cleanName === cleanEmail) return cleanEmail;
  if (/[^\x20-\x7e]/.test(cleanName)) {
    const encoded = Buffer.from(cleanName, "utf8").toString("base64");
    return `=?UTF-8?B?${encoded}?= <${cleanEmail}>`;
  }
  if (/[\\()<>@,;:"[\].]/.test(cleanName)) {
    const escaped = cleanName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}" <${cleanEmail}>`;
  }
  return `${cleanName} <${cleanEmail}>`;
}

/**
 * Monta mensagem MIME completa para anexos inline (`multipart/related` +
 * `multipart/alternative` + `Content-Transfer-Encoding: base64`), evitando
 * corrupcao de PNG e falha de `cid:` no Gmail quando enviada como Simple.
 */
export function buildSesRawMimeMessage(input: SendSesEmailInput): string {
  const attachments = input.attachments ?? [];
  const inline = attachments.filter((a) => a.contentDisposition === "INLINE");
  const regular = attachments.filter((a) => a.contentDisposition !== "INLINE");
  const lines: string[] = [
    `From: ${formatSesAddress(input.from)}`,
    `To: ${input.to.map(formatSesAddress).join(", ")}`,
    ...(input.replyTo && input.replyTo.length > 0 ? [`Reply-To: ${input.replyTo.map(formatSesAddress).join(", ")}`] : []),
    `Subject: ${encodeMimeHeaderValue(input.subject)}`,
    "MIME-Version: 1.0",
  ];

  const altBoundary = `gh-alt-${randomUUID()}`;
  const relBoundary = `gh-rel-${randomUUID()}`;
  const mixBoundary = `gh-mix-${randomUUID()}`;

  const pushAlternativeBody = () => {
    const hasBoth = input.text !== undefined && input.html !== undefined;
    if (hasBoth) {
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`, "");
    }
    if (input.text !== undefined) {
      if (hasBoth) lines.push(`--${altBoundary}`);
      lines.push("Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", encodeUtf8Base64(input.text));
    }
    if (input.html !== undefined) {
      if (hasBoth) lines.push(`--${altBoundary}`);
      lines.push("Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", encodeUtf8Base64(input.html));
    }
    if (hasBoth) lines.push(`--${altBoundary}--`);
  };

  const pushAttachmentPart = (attachment: SesEmailAttachment) => {
    const safeName = sanitizeHeader(attachment.fileName).replace(/"/g, "");
    const safeType = sanitizeHeader(attachment.contentType);
    const disp = attachment.contentDisposition === "INLINE" ? "inline" : "attachment";
    lines.push(
      `Content-Type: ${safeType}; name="${safeName}"`,
      `Content-Disposition: ${disp}; filename="${safeName}"`,
      "Content-Transfer-Encoding: base64",
    );
    if (attachment.contentId) {
      const cleanId = sanitizeHeader(attachment.contentId).replace(/^<|>$/g, "");
      lines.push(`Content-ID: <${cleanId}>`);
    }
    lines.push("", wrapBase64(attachment.rawContentBase64));
  };

  const pushRelatedBody = () => {
    if (inline.length === 0) {
      pushAlternativeBody();
      return;
    }
    lines.push(`Content-Type: multipart/related; boundary="${relBoundary}"`, "", `--${relBoundary}`);
    pushAlternativeBody();
    for (const part of inline) {
      lines.push(`--${relBoundary}`);
      pushAttachmentPart(part);
    }
    lines.push(`--${relBoundary}--`);
  };

  if (regular.length === 0) {
    pushRelatedBody();
  } else {
    lines.push(`Content-Type: multipart/mixed; boundary="${mixBoundary}"`, "", `--${mixBoundary}`);
    pushRelatedBody();
    for (const part of regular) {
      lines.push(`--${mixBoundary}`);
      pushAttachmentPart(part);
    }
    lines.push(`--${mixBoundary}--`);
  }

  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Le credenciais AWS IAM do ambiente. Sem `AWS_ACCESS_KEY_ID` ou
 * `AWS_SECRET_ACCESS_KEY`, devolve `null` para manter o fallback de desenvolvimento.
 */
export function sesCredentialsFromEnv(
  env: Record<string, string | undefined> = process.env,
): SesCredentials | null {
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) return null;
  const region = env.AWS_SES_REGION?.trim() || env.AWS_REGION?.trim() || DEFAULT_AWS_SES_REGION;
  return { accessKeyId, secretAccessKey, region };
}

/** Endereco e nome padrao do remetente a partir das variaveis de ambiente. */
export function emailSenderFromEnv(
  env: Record<string, string | undefined> = process.env,
): { email: string; name: string } {
  return {
    email: sanitizeHeader(env.EMAIL_FROM_ADDRESS || DEFAULT_EMAIL_FROM_ADDRESS) || DEFAULT_EMAIL_FROM_ADDRESS,
    name: sanitizeHeader(env.EMAIL_FROM_NAME || DEFAULT_EMAIL_FROM_NAME) || DEFAULT_EMAIL_FROM_NAME,
  };
}

/** Gera o endpoint regional valido da Amazon SES API v2. */
export function sesOutboundEndpoint(region: string): { host: string; path: string; url: string } {
  const cleanRegion = region.trim();
  if (!/^[a-z0-9-]+$/.test(cleanRegion)) {
    throw new Error(`Região AWS SES inválida: ${region}`);
  }
  const host = `email.${cleanRegion}.amazonaws.com`;
  const path = "/v2/email/outbound-emails";
  return { host, path, url: `https://${host}${path}` };
}

/** Assina requisicao POST JSON para o servico `ses` usando AWS SigV4. */
export function signSesV2Request({
  accessKeyId,
  secretAccessKey,
  region,
  host,
  path,
  body,
  now = new Date(),
}: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  host: string;
  path: string;
  body: string;
  now?: Date;
}): Record<string, string> {
  const amzDate = now.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/ses/aws4_request`;
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = ["POST", path, "", canonicalHeaders, signedHeaders, sha256Hex(body)].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "ses");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  return {
    "Content-Type": "application/json",
    "X-Amz-Date": amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

/** Envia um e-mail transacional via Amazon SES API v2 (`SendEmail`). */
export async function sendSesEmail(input: SendSesEmailInput): Promise<SendSesEmailResult> {
  if (input.html === undefined && input.text === undefined) {
    return { ok: false, error: "E-mail sem corpo HTML ou texto." };
  }

  let endpoint: { host: string; path: string; url: string };
  try {
    endpoint = sesOutboundEndpoint(input.credentials.region);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const hasAttachments = Boolean(input.attachments && input.attachments.length > 0);
  const bodyContent: Record<string, { Data: string; Charset: "UTF-8" }> = {};
  if (input.html !== undefined) bodyContent.Html = { Data: input.html, Charset: "UTF-8" };
  if (input.text !== undefined) bodyContent.Text = { Data: input.text, Charset: "UTF-8" };

  const content = hasAttachments
    ? { Raw: { Data: Buffer.from(buildSesRawMimeMessage(input), "utf8").toString("base64") } }
    : {
        Simple: {
          Subject: { Data: sanitizeHeader(input.subject), Charset: "UTF-8" },
          Body: bodyContent,
        },
      };

  const payload: Record<string, unknown> = {
    FromEmailAddress: formatSesAddress(input.from),
    Destination: { ToAddresses: input.to.map(formatSesAddress) },
    ...(input.replyTo && input.replyTo.length > 0 ? { ReplyToAddresses: input.replyTo.map(formatSesAddress) } : {}),
    Content: content,
  };
  const body = JSON.stringify(payload);
  const headers = signSesV2Request({
    accessKeyId: input.credentials.accessKeyId,
    secretAccessKey: input.credentials.secretAccessKey,
    region: input.credentials.region,
    host: endpoint.host,
    path: endpoint.path,
    body,
    now: input.now,
  });

  const delays = input.retryDelaysMs ?? SES_RETRY_DELAYS_MS;
  let result = await postToSes(endpoint.url, headers, body, input.timeoutMs ?? SES_TIMEOUT_MS);
  for (const delay of delays) {
    if (!isRetryableSesFailure(result)) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
    result = await postToSes(endpoint.url, headers, body, input.timeoutMs ?? SES_TIMEOUT_MS);
  }
  return result;
}

/** Uma tentativa de envio, com tempo maximo. */
async function postToSes(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
): Promise<SendSesEmailResult> {
  try {
    const response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      const errorType = response.headers.get("x-amzn-errortype")?.split(":")[0] || undefined;
      const rawText = await response.text().catch(() => "");
      let message = rawText;
      try {
        const parsed = JSON.parse(rawText) as { message?: string; Message?: string } | null;
        message = parsed?.message ?? parsed?.Message ?? rawText;
      } catch {
        // Mantem o texto cru quando a resposta nao for JSON.
      }
      const detail = [errorType, message.trim()].filter(Boolean).join(": ");
      return {
        ok: false,
        status: response.status,
        errorType,
        error: detail || `HTTP ${response.status}`,
      };
    }

    const parsed = (await response.json().catch(() => null)) as { MessageId?: string } | null;
    return { ok: true, messageId: parsed?.MessageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
