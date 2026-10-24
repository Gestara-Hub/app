import "server-only";
import { getEnv } from "./env";

/**
 * E-mail de texto simples pelo MailerSend (respostas do suporte, resumo diario).
 * Sem `MAILERSEND_API_KEY`: so registra no log (desenvolvimento) e devolve false.
 * Nunca lanca: a resposta ja foi gravada, o e-mail e um aviso.
 */
export interface OutgoingEmail {
  to: { email: string; name?: string };
  subject: string;
  text: string;
  replyTo?: string;
}

export async function sendEmail(mail: OutgoingEmail): Promise<boolean> {
  const env = getEnv();
  if (!env.MAILERSEND_API_KEY) {
    console.warn(`[email] (sem MAILERSEND_API_KEY, só desenvolvimento) ${mail.subject} -> ${mail.to.email}`);
    return false;
  }
  try {
    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.MAILERSEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: { email: env.MAILERSEND_FROM_EMAIL ?? "naoresponda@gestarahub.com.br", name: env.MAILERSEND_FROM_NAME ?? "GestaraHub" },
        to: [mail.to],
        ...(mail.replyTo ? { reply_to: { email: mail.replyTo } } : {}),
        subject: mail.subject,
        text: mail.text,
      }),
    });
    if (!response.ok) console.error(`[email] MailerSend recusou (${response.status}).`);
    return response.ok;
  } catch (error) {
    console.error("[email] Falha de conexão com o MailerSend:", error instanceof Error ? error.message : error);
    return false;
  }
}
