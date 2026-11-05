import "server-only";
import { getEnv } from "./env";

/**
 * E-mail de texto simples pelo MailerSend (respostas do suporte, resumo diario).
 * Sem `MAILERSEND_API_KEY`, ou com o MailerSend recusando: devolve false e, fora
 * de producao, mostra o e-mail inteiro no terminal (links como o de criar senha
 * da troca de e-mail de acesso ficam a mao para testar localmente).
 * Nunca lanca: a resposta ja foi gravada, o e-mail e um aviso.
 */
export interface OutgoingEmail {
  to: { email: string; name?: string };
  subject: string;
  text: string;
  replyTo?: string;
}

/** Fora de producao: o e-mail que nao saiu aparece inteiro no terminal. */
function printForDevelopment(mail: OutgoingEmail, reason: string): void {
  if (process.env.NODE_ENV === "production") return;
  // Saida de proposito (so desenvolvimento): o texto e lido daqui.
  console.warn(`[email] ${reason} (só desenvolvimento). Para ${mail.to.email}: ${mail.subject}\n${mail.text}`);
}

export async function sendEmail(mail: OutgoingEmail): Promise<boolean> {
  const env = getEnv();
  if (!env.MAILERSEND_API_KEY) {
    printForDevelopment(mail, "Sem MAILERSEND_API_KEY");
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
    if (!response.ok) {
      console.error(`[email] MailerSend recusou (${response.status}).`);
      printForDevelopment(mail, `MailerSend recusou (${response.status})`);
    }
    return response.ok;
  } catch (error) {
    console.error("[email] Falha de conexão com o MailerSend:", error instanceof Error ? error.message : error);
    printForDevelopment(mail, "Falha de conexão com o MailerSend");
    return false;
  }
}
