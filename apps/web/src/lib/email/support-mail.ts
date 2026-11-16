import { SUPPORT_EMAIL } from "@/config/site";
import { formatProtocol } from "@gestarahub/core/support-protocol";
import { renderOpsAlertEmail, type EmailIconState, type OpsAlertMetaItem } from "@gestarahub/core/email-layouts";
import { emailSenderFromEnv, sendSesEmail, sesCredentialsFromEnv } from "@gestarahub/core/ses";
import { logError } from "@/lib/log";
import type { SupportKind } from "@/services/support/supportTypes";
import { getEmailIconBase64, hostedEmailIconUrl, inlineIconAttachment } from "./ses";

/**
 * Aviso interno de chamado para quem atende o suporte. Sem credenciais AWS SES
 * (desenvolvimento), so registra no log. Nunca lanca: o chamado ja foi gravado.
 */
export interface SupportNotice {
  kind: "new" | "reply";
  /** Número do protocolo da conversa. */
  number: number;
  /** Tipo da conversa; sem tipo, é uma dúvida. */
  topic?: SupportKind;
  urgent: boolean;
  subject: string;
  spaceName: string;
  userName: string;
  userEmail: string;
  /** Tela de onde a conversa saiu, quando se sabe. */
  originScreen?: string;
  /** Código do erro que a pessoa viu (liga a conversa ao registro de erros). */
  errorReference?: string;
  preview: string;
}

export function supportNoticeText(notice: SupportNotice): { subject: string; text: string } {
  const newHead = notice.topic === "bug" ? "Novo problema relatado" : notice.topic === "suggestion" ? "Nova sugestão" : "Novo chamado";
  const head = notice.kind === "new" ? newHead : "Nova resposta do cliente";
  const protocol = formatProtocol(notice.number);
  const subject = `${notice.urgent ? "[URGENTE] " : ""}[${protocol}] ${head}: ${notice.subject}`;
  const text = [
    `${head}${notice.urgent ? " (urgente)" : ""}`,
    "",
    `Protocolo: ${protocol}`,
    `Espaço: ${notice.spaceName}`,
    `Pessoa: ${notice.userName} (${notice.userEmail})`,
    `Assunto: ${notice.subject}`,
    ...(notice.originScreen ? [`Tela: ${notice.originScreen}`] : []),
    ...(notice.errorReference ? [`Código do erro: ${notice.errorReference} (busque em Saúde, no painel)`] : []),
    "",
    notice.preview,
    "",
    "Responda pelo painel do GestaraHub, na tela Suporte.",
  ].join("\n");
  return { subject, text };
}

export function supportNoticeHtml(notice: SupportNotice, icon?: EmailIconState): string {
  const newHead = notice.topic === "bug" ? "Novo problema relatado" : notice.topic === "suggestion" ? "Nova sugestão" : "Novo chamado";
  const head = notice.kind === "new" ? newHead : "Nova resposta do cliente";
  const protocol = formatProtocol(notice.number);
  const tone = notice.urgent ? "danger" : notice.topic === "bug" ? "warning" : "info";
  const badge = notice.urgent
    ? "URGENTE"
    : notice.kind === "reply"
      ? "Resposta"
      : notice.topic === "bug"
        ? "Problema"
        : notice.topic === "suggestion"
          ? "Sugestão"
          : "Chamado";

  const meta: OpsAlertMetaItem[] = [
    { label: "Protocolo", value: protocol, mono: true },
    { label: "Espaço", value: notice.spaceName },
    { label: "Pessoa", value: `${notice.userName} (${notice.userEmail})` },
    ...(notice.originScreen ? [{ label: "Tela", value: notice.originScreen, mono: true }] : []),
    ...(notice.errorReference ? [{ label: "Código do erro", value: notice.errorReference, mono: true }] : []),
  ];

  return renderOpsAlertEmail({
    tone,
    sectionLabel: "Suporte",
    badge,
    title: head,
    subtitle: notice.subject,
    meta,
    quote: {
      label: notice.kind === "reply" ? "Nova mensagem" : "Mensagem",
      text: notice.preview,
    },
    note: notice.errorReference
      ? "Responda pelo painel do GestaraHub, na tela Suporte. Para o erro citado, busque o código em Saúde."
      : "Responda pelo painel do GestaraHub, na tela Suporte.",
    footer: `GestaraHub · Suporte interno · Protocolo ${protocol}`,
    icon: icon ?? { hasInlineIcon: false, hostedIconUrl: hostedEmailIconUrl() },
  });
}

export async function sendSupportNotice(notice: SupportNotice, to?: string): Promise<boolean> {
  const credentials = sesCredentialsFromEnv();
  const recipient = to?.trim() || SUPPORT_EMAIL;
  const { subject, text } = supportNoticeText(notice);
  if (!credentials) {
    if (process.env.NODE_ENV === "production") logError("[support] Credenciais AWS SES ausentes: aviso de chamado não enviado.");
    else console.warn(`[support] (só desenvolvimento) ${subject} -> ${recipient}`);
    return false;
  }
  const iconBase64 = await getEmailIconBase64();
  const html = supportNoticeHtml(notice, {
    hasInlineIcon: Boolean(iconBase64),
    hostedIconUrl: hostedEmailIconUrl(),
  });
  const result = await sendSesEmail({
    credentials,
    from: emailSenderFromEnv(),
    to: [{ email: recipient }],
    subject,
    html,
    text,
    ...(iconBase64 ? { attachments: [inlineIconAttachment(iconBase64)] } : {}),
  });
  if (!result.ok) {
    logError("[support] Erro ao enviar o aviso de chamado:", result.status ?? "rede", result.error);
    return false;
  }
  return true;
}
