import { SUPPORT_EMAIL } from "@/config/site";
import { logError } from "@/lib/log";

/**
 * Aviso interno de chamado (texto simples) para quem atende o suporte. Sem
 * MAILERSEND_API_KEY (desenvolvimento), so registra no log. Nunca lanca: o
 * chamado ja foi gravado, o e-mail e um aviso.
 */
export interface SupportNotice {
  kind: "new" | "reply";
  urgent: boolean;
  subject: string;
  spaceName: string;
  userName: string;
  userEmail: string;
  preview: string;
}

export function supportNoticeText(notice: SupportNotice): { subject: string; text: string } {
  const head = notice.kind === "new" ? "Novo chamado" : "Nova resposta do cliente";
  const subject = `${notice.urgent ? "[URGENTE] " : ""}${head}: ${notice.subject}`;
  const text = [
    `${head}${notice.urgent ? " (urgente)" : ""}`,
    "",
    `Espaço: ${notice.spaceName}`,
    `Pessoa: ${notice.userName} (${notice.userEmail})`,
    `Assunto: ${notice.subject}`,
    "",
    notice.preview,
    "",
    "Responda pelo painel do GestaraHub, na tela Suporte.",
  ].join("\n");
  return { subject, text };
}

export async function sendSupportNotice(notice: SupportNotice, to?: string): Promise<boolean> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const recipient = to?.trim() || SUPPORT_EMAIL;
  const { subject, text } = supportNoticeText(notice);
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") logError("[support] MAILERSEND_API_KEY ausente: aviso de chamado não enviado.");
    else console.warn(`[support] (só desenvolvimento) ${subject} -> ${recipient}`);
    return false;
  }
  try {
    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: {
          email: process.env.MAILERSEND_FROM_EMAIL || "naoresponda@gestarahub.com.br",
          name: process.env.MAILERSEND_FROM_NAME || "GestaraHub",
        },
        to: [{ email: recipient }],
        subject,
        text,
      }),
    });
    if (!response.ok) {
      logError("[support] Erro ao enviar o aviso de chamado:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    logError("[support] Falha de conexão ao enviar o aviso de chamado:", error);
    return false;
  }
}
