import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  EMAIL_ICON_CONTENT_ID,
  EMAIL_ICON_VERSION,
  hostedEmailAssetUrl,
  type EmailIconState,
} from "@gestarahub/core/email-layouts";
import {
  emailSenderFromEnv,
  sendSesEmail,
  sesCredentialsFromEnv,
  type SesEmailAttachment,
} from "@gestarahub/core/ses";
import { getEnv } from "./env";

/**
 * E-mail pelo Amazon SES (HTML da marca/atendimento/alertas + texto simples).
 * Sem credenciais AWS SES, ou com o SES recusando: devolve false e, fora de
 * producao, mostra o e-mail inteiro no terminal (links como o de criar senha da
 * troca de e-mail de acesso ficam a mao para testar localmente).
 * Nunca lanca: a resposta ja foi gravada, o e-mail e um aviso.
 */
export interface OutgoingEmail {
  to: { email: string; name?: string };
  subject: string;
  text: string;
  html?: string | ((icon: EmailIconState) => string);
  replyTo?: string;
}

let cachedIconBase64: string | null | undefined;

async function getBrandIconBase64(): Promise<string | null> {
  if (cachedIconBase64 !== undefined) return cachedIconBase64;
  for (const candidate of [
    path.join(process.cwd(), "public", "email-icon.png"),
    path.join(process.cwd(), "../web/public", "email-icon.png"),
  ]) {
    try {
      const buffer = await readFile(candidate);
      cachedIconBase64 = buffer.toString("base64");
      return cachedIconBase64;
    } catch {
      // tenta proximo caminho
    }
  }
  cachedIconBase64 = null;
  return null;
}

/** Fora de producao: o e-mail que nao saiu aparece inteiro no terminal. */
function printForDevelopment(mail: OutgoingEmail, reason: string): void {
  if (process.env.NODE_ENV === "production") return;
  // Saida de proposito (so desenvolvimento): o texto e lido daqui.
  console.warn(`[email] ${reason} (só desenvolvimento). Para ${mail.to.email}: ${mail.subject}\n${mail.text}`);
}

export async function sendEmail(mail: OutgoingEmail): Promise<boolean> {
  const env = getEnv();
  const credentials = sesCredentialsFromEnv(env);
  if (!credentials) {
    printForDevelopment(mail, "Sem credenciais AWS SES");
    return false;
  }

  let html: string | undefined;
  let attachments: SesEmailAttachment[] | undefined;
  if (typeof mail.html === "function") {
    const hostedIconUrl = hostedEmailAssetUrl(env.WEB_APP_URL, "email-icon.png", EMAIL_ICON_VERSION);
    const iconBase64 = hostedIconUrl ? null : await getBrandIconBase64();
    html = mail.html({ hasInlineIcon: Boolean(iconBase64), hostedIconUrl });
    if (iconBase64) {
      attachments = [
        {
          fileName: "email-icon.png",
          contentType: "image/png",
          contentDisposition: "INLINE",
          contentId: EMAIL_ICON_CONTENT_ID,
          rawContentBase64: iconBase64,
        },
      ];
    }
  } else {
    html = mail.html;
  }

  const result = await sendSesEmail({
    credentials,
    from: emailSenderFromEnv(env),
    to: [mail.to],
    ...(mail.replyTo ? { replyTo: [{ email: mail.replyTo }] } : {}),
    subject: mail.subject,
    ...(html ? { html } : {}),
    text: mail.text,
    ...(attachments ? { attachments } : {}),
  });
  if (!result.ok) {
    const label = result.status ? `Amazon SES recusou (${result.status})` : "Falha de conexão com o Amazon SES";
    console.error(`[email] ${label}: ${result.error}`);
    printForDevelopment(mail, label);
    return false;
  }
  return true;
}
