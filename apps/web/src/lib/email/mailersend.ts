import { readFile } from "node:fs/promises";
import path from "node:path";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, SUPPORT_EMAIL } from "@/config/site";
import { logError, logWarn } from "@/lib/log";

const MAILERSEND_API_URL = "https://api.mailersend.com/v1/email";

const SUPPRESSED_ERROR =
  "Não conseguimos entregar e-mails para este endereço. Use outro e-mail ou fale com o suporte.";

/**
 * O MailerSend responde 202 mesmo quando o destinatario esta na lista de
 * bloqueio (bounce, spam, descadastro): com `ALL_SUPPRESSED` nada e enviado e
 * nao vem `x-message-id`. Le os avisos do corpo e diz se o envio nao saiu.
 */
async function wasSuppressed(response: Response, context: string): Promise<boolean> {
  if (!response.headers.get("content-type")?.includes("application/json")) return false;
  const body = (await response.json().catch(() => null)) as {
    warnings?: { type?: string; message?: string; recipients?: unknown }[];
  } | null;
  const warnings = body?.warnings ?? [];
  if (warnings.length === 0) return false;
  logWarn(`[mailersend] Avisos ao enviar ${context}:`, JSON.stringify(warnings));
  return warnings.some((w) => w.type === "ALL_SUPPRESSED");
}

export interface SendSignupLinkEmailInput {
  toEmail: string;
  toName: string;
  signupUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let cachedIconBase64: string | null = null;

async function getEmailIconBase64(): Promise<string | null> {
  if (cachedIconBase64) return cachedIconBase64;
  try {
    const iconPath = path.join(process.cwd(), "public", "email-icon.png");
    const buffer = await readFile(iconPath);
    cachedIconBase64 = buffer.toString("base64");
    return cachedIconBase64;
  } catch {
    return null;
  }
}

/**
 * Moldura comum dos e-mails (padrao desde 22/10/2026): faixa com o gradiente
 * da marca, topo escuro com logo, titulo e introducao, corpo branco, "Duvidas?"
 * com o contato e rodape cinza. Cada e-mail entra so com o conteudo (ja escapado).
 */
function renderEmailLayout({
  title,
  preheader,
  badge,
  heading,
  intro,
  body,
  footer,
  hasInlineIcon,
}: {
  title: string;
  preheader: string;
  badge?: string;
  heading: string;
  intro: string;
  body: string;
  footer: string;
  hasInlineIcon: boolean;
}): string {
  const iconMarkup = hasInlineIcon
    ? `<img src="cid:gestarahub-icon" width="36" height="36" alt="GestaraHub" style="display:block;border:0;border-radius:9px;" />`
    : `<div style="width:36px;height:36px;border-radius:9px;background:#2563eb;color:#ffffff;font-weight:800;font-size:17px;line-height:36px;text-align:center;">G</div>`;
  const support = escapeHtml(replyToEmail());
  const badgeMarkup = badge
    ? `<div style="display:inline-block;padding:4px 10px;margin-bottom:14px;border:1px solid #334155;border-radius:20px;background-color:#1e293b;font-size:12px;font-weight:700;color:#93c5fd;">${badge}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <!-- Pre-visualizacao na caixa de entrada -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#f38020 0%,#25b4b8 50%,#8a1b9e 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Topo escuro com a marca -->
          <tr>
            <td style="background-color:#0f172a;padding:32px 36px 34px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">${iconMarkup}</td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:20px;letter-spacing:-0.02em;color:#ffffff;"><span style="font-weight:400;">Gestara</span><span style="font-weight:800;">Hub</span></span>
                  </td>
                </tr>
              </table>
              ${badgeMarkup}
              <h1 style="margin:0 0 10px 0;font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;line-height:1.2;">
                ${heading}
              </h1>
              <p style="margin:0;font-size:16px;line-height:1.6;color:#cbd5e1;">
                ${intro}
              </p>
            </td>
          </tr>

          <!-- Conteudo -->
          <tr>
            <td style="padding:32px 36px 32px 36px;">
              ${body}
            </td>
          </tr>

          <!-- Duvidas: em todos os e-mails, sempre a caixa de contato -->
          <tr>
            <td style="padding:0 36px 28px 36px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">
                <strong style="color:#0f172a;">Dúvidas?</strong> Escreva para
                <a href="mailto:${support}" style="color:#2563eb;text-decoration:underline;">${support}</a>. A gente ajuda.
              </p>
            </td>
          </tr>

          <!-- Rodape -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;font-size:12px;line-height:1.6;color:#94a3b8;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Botao principal azul dos e-mails. */
function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:#2563eb;">
                    <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                      ${label} &rarr;
                    </a>
                  </td>
                </tr>
              </table>`;
}

/** Aviso de prazo do link (amarelo claro). */
function emailNotice(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 16px;font-size:13px;line-height:1.5;color:#92400e;">${html}</td>
                </tr>
              </table>`;
}

/** "Se o botao nao abrir" com o endereco cru. */
function emailFallbackLink(url: string): string {
  return `<hr style="border:0;border-top:1px solid #e2e8f0;margin:0 0 16px 0;" />
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                Se o botão não abrir, copie e cole este endereço no navegador:<br />
                <a href="${url}" style="color:#2563eb;word-break:break-all;text-decoration:underline;">${url}</a>
              </p>`;
}

export function buildSignupEmailHtml({
  toName,
  toEmail,
  signupUrl,
  hasInlineIcon,
}: SendSignupLinkEmailInput & { hasInlineIcon: boolean }): string {
  const firstName = escapeHtml(toName.trim().split(/\s+/)[0] || toName.trim());
  const safeEmail = escapeHtml(toEmail.trim());
  const safeUrl = escapeHtml(signupUrl);

  return renderEmailLayout({
    title: "Conclua seu cadastro no GestaraHub",
    preheader: "Defina sua senha para concluir o cadastro. O link vale por 24 horas.",
    heading: `Falta só criar sua senha, ${firstName}!`,
    intro: "Um passo e sua conta grátis está pronta.",
    body: `<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Recebemos seu pedido para criar uma conta no <strong>GestaraHub</strong> com o e-mail <strong style="color:#0f172a;">${safeEmail}</strong>. Clique no botão abaixo para definir sua senha e configurar seu espaço.
              </p>
              ${emailButton(safeUrl, "Definir minha senha")}
              ${emailNotice("<strong>&#9201; Este link expira em 24 horas.</strong> Se o prazo vencer, abra o link mesmo assim ou preencha seu e-mail de novo para gerar outro na hora.")}
              ${emailFallbackLink(safeUrl)}`,
    footer: `Você recebeu este e-mail porque pediu para criar uma conta no GestaraHub. Se não foi você, pode ignorar esta mensagem.<br />
              <span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
    hasInlineIcon,
  });
}

export function buildSignupEmailText({
  toName,
  toEmail,
  signupUrl,
}: SendSignupLinkEmailInput): string {
  const firstName = toName.trim().split(/\s+/)[0] || toName.trim();
  return [
    `Falta só criar sua senha, ${firstName}!`,
    "",
    `Recebemos seu pedido para criar uma conta grátis no GestaraHub com o e-mail ${toEmail.trim()}.`,
    "Acesse o link abaixo para definir sua senha e configurar seu espaço:",
    "",
    signupUrl,
    "",
    "Importante: este link expira em 24 horas. Se o prazo vencer, basta solicitar um novo link na página de login ou cadastro.",
    "",
    "Se você não solicitou este cadastro, ignore este e-mail com segurança.",
    `Dúvidas? Escreva para ${replyToEmail()}.`,
  ].join("\n");
}

/**
 * Sem MAILERSEND_API_KEY: em desenvolvimento e nos e2e o link vai para o log e
 * o fluxo segue. Em producao e falha: nunca dizer que enviou sem enviar.
 */
function withoutApiKey(link: string, what = "Link gerado"): { ok: true } | { ok: false; error: string } {
  // E2E_NOW so existe no servidor dos e2e (tambem no modo producao, doc 20).
  if (process.env.NODE_ENV === "production" && !process.env.E2E_NOW) {
    logError("[mailersend] MAILERSEND_API_KEY ausente em producao: e-mail nao enviado.");
    return { ok: false, error: "O envio de e-mails está fora do ar. Tente novamente mais tarde." };
  }
  // Saida de proposito (em desenvolvimento o link e lido daqui): nao e erro, nao vai ao registro.
  console.warn(`[mailersend] MAILERSEND_API_KEY ausente. ${what} (so desenvolvimento):`, link);
  return { ok: true };
}

export async function sendSignupLinkEmail(
  input: SendSignupLinkEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL || "naoresponda@gestarahub.com.br";
  const fromName = process.env.MAILERSEND_FROM_NAME || "GestaraHub";

  if (!apiKey) return withoutApiKey(input.signupUrl);

  const iconBase64 = await getEmailIconBase64();
  const html = buildSignupEmailHtml({
    ...input,
    hasInlineIcon: Boolean(iconBase64),
  });
  const text = buildSignupEmailText(input);

  const payload: Record<string, unknown> = {
    from: {
      email: fromEmail,
      name: fromName,
    },
    reply_to: { email: replyToEmail(), name: fromName },
    to: [
      {
        email: input.toEmail.trim(),
        name: input.toName.trim(),
      },
    ],
    subject: "Conclua seu cadastro no GestaraHub — defina sua senha",
    html,
    text,
  };

  if (iconBase64) {
    payload.attachments = [
      {
        content: iconBase64,
        filename: "email-icon.png",
        disposition: "inline",
        id: "gestarahub-icon",
      },
    ];
  }

  try {
    const response = await fetch(MAILERSEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logError("[mailersend] Erro ao enviar e-mail:", response.status, errorBody);
      return {
        ok: false,
        error: "Não foi possível enviar o e-mail de confirmação. Tente novamente em instantes.",
      };
    }
    if (await wasSuppressed(response, "cadastro")) return { ok: false, error: SUPPRESSED_ERROR };

    return { ok: true };
  } catch (err) {
    logError("[mailersend] Falha de conexão ao enviar e-mail:", err);
    return {
      ok: false,
      error: "Não foi possível enviar o e-mail de confirmação. Verifique sua conexão e tente novamente.",
    };
  }
}

export interface SendOrganizationInvitationEmailInput {
  toEmail: string;
  toName: string;
  organizationName: string;
  profileLabel: string;
  inviteUrl: string;
  expiresInDays?: number;
}

export function buildOrganizationInvitationEmailHtml({
  toName,
  toEmail,
  organizationName,
  profileLabel,
  inviteUrl,
  expiresInDays = 7,
  hasInlineIcon,
}: SendOrganizationInvitationEmailInput & { hasInlineIcon: boolean }): string {
  const firstName = escapeHtml(toName.trim().split(/\s+/)[0] || toName.trim());
  const safeEmail = escapeHtml(toEmail.trim());
  const safeOrgName = escapeHtml(organizationName.trim());
  const safeProfile = escapeHtml(profileLabel.trim());
  const safeUrl = escapeHtml(inviteUrl);

  const features = [
    "Fazer chamada rápida e registrar presenças no celular durante a aula",
    "Acompanhar os alunos matriculados e o controle de faltas",
    "Lançar notas, avaliações e acompanhar a evolução de faixas ou graus",
    "Consultar a grade e o cronograma completo das suas turmas",
  ]
    .map(
      (item) =>
        `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;font-size:14px;line-height:1.5;color:#2563eb;font-weight:700;">&#10003;</td><td style="padding:4px 0;font-size:14px;line-height:1.5;color:#475569;">${item}</td></tr>`,
    )
    .join("");

  return renderEmailLayout({
    title: "Convite para a equipe no GestaraHub",
    preheader: `${safeOrgName} convidou você para a equipe no GestaraHub.`,
    badge: "Convite de equipe",
    heading: `Você foi convidado, ${firstName}!`,
    intro: `O espaço <strong style="color:#ffffff;">${safeOrgName}</strong> chamou você para a equipe como <strong style="color:#ffffff;">${safeProfile}</strong>.`,
    body: `<p style="margin:0 0 14px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Com o seu acesso, você poderá</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${features}</table>
              ${emailButton(safeUrl, "Aceitar convite e definir senha")}
              ${emailNotice(`<strong>&#9201; Este link vale por ${expiresInDays} dias</strong> e foi gerado só para <strong>${safeEmail}</strong>.`)}
              ${emailFallbackLink(safeUrl)}`,
    footer: `Se você não reconhece este convite, basta ignorar este e-mail.<br />
              <span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
    hasInlineIcon,
  });
}

export function buildOrganizationInvitationEmailText({
  toName,
  organizationName,
  profileLabel,
  inviteUrl,
  expiresInDays = 7,
}: SendOrganizationInvitationEmailInput): string {
  const firstName = toName.trim().split(/\s+/)[0] || toName.trim();
  return [
    `Olá, ${firstName}!`,
    "",
    `O espaço "${organizationName}" convidou você para fazer parte da equipe no GestaraHub como ${profileLabel}.`,
    "",
    "Com seu acesso, você poderá fazer chamada pelo celular, acompanhar alunos, lançar notas e consultar suas turmas.",
    "",
    "Para aceitar o convite e criar sua senha, clique no link abaixo:",
    inviteUrl,
    "",
    `Este link expira em ${expiresInDays} dias.`,
    "",
    `Dúvidas? Escreva para ${replyToEmail()}.`,
  ].join("\n");
}

export async function sendOrganizationInvitationEmail(
  input: SendOrganizationInvitationEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL || "naoresponda@gestarahub.com.br";
  const fromName = process.env.MAILERSEND_FROM_NAME || "GestaraHub";

  if (!apiKey) return withoutApiKey(input.inviteUrl);

  const iconBase64 = await getEmailIconBase64();
  const html = buildOrganizationInvitationEmailHtml({
    ...input,
    hasInlineIcon: Boolean(iconBase64),
  });
  const text = buildOrganizationInvitationEmailText(input);

  const payload: Record<string, unknown> = {
    from: {
      email: fromEmail,
      name: fromName,
    },
    reply_to: { email: replyToEmail(), name: fromName },
    to: [
      {
        email: input.toEmail.trim(),
        name: input.toName.trim(),
      },
    ],
    subject: `${input.organizationName} convidou você para a equipe no GestaraHub`,
    html,
    text,
  };

  if (iconBase64) {
    payload.attachments = [
      {
        content: iconBase64,
        filename: "email-icon.png",
        disposition: "inline",
        id: "gestarahub-icon",
      },
    ];
  }

  try {
    const response = await fetch(MAILERSEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logError("[mailersend] Erro ao enviar convite:", response.status, errorBody);
      return {
        ok: false,
        error: "Não foi possível enviar o e-mail de convite. Tente novamente em instantes.",
      };
    }
    if (await wasSuppressed(response, "convite")) return { ok: false, error: SUPPRESSED_ERROR };

    return { ok: true };
  } catch (err) {
    logError("[mailersend] Falha de conexão ao enviar convite:", err);
    return {
      ok: false,
      error: "Falha ao conectar com o serviço de e-mail. Verifique a conexão.",
    };
  }
}


// --- Nova senha ("Esqueci minha senha") ------------------------------------------

export interface SendPasswordResetEmailInput {
  toEmail: string;
  toName: string;
  resetUrl: string;
}

export function buildPasswordResetEmailHtml({
  toName,
  resetUrl,
  hasInlineIcon,
}: SendPasswordResetEmailInput & { hasInlineIcon: boolean }): string {
  const firstName = escapeHtml(toName.trim().split(/\s+/)[0] || toName.trim());
  const safeUrl = escapeHtml(resetUrl);

  return renderEmailLayout({
    title: "Crie uma nova senha no GestaraHub",
    preheader: "Crie uma nova senha. O link vale por 1 hora.",
    heading: `Crie uma nova senha, ${firstName}`,
    intro: "Recebemos um pedido para trocar a senha da sua conta.",
    body: `<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Clique no botão abaixo para criar uma nova senha no <strong>GestaraHub</strong>.
              </p>
              ${emailButton(safeUrl, "Criar nova senha")}
              ${emailNotice("<strong>&#9201; Este link vale por 1 hora</strong> e só pode ser usado uma vez. Depois disso, peça outro na tela de login.")}
              ${emailFallbackLink(safeUrl)}`,
    footer: `Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.<br />
              <span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
    hasInlineIcon,
  });
}

export function buildPasswordResetEmailText({ toName, resetUrl }: SendPasswordResetEmailInput): string {
  const firstName = toName.trim().split(/\s+/)[0] || toName.trim();
  return [
    `Crie uma nova senha, ${firstName}`,
    "",
    "Recebemos um pedido para trocar a senha da sua conta no GestaraHub.",
    "Acesse o link abaixo para criar uma nova:",
    "",
    resetUrl,
    "",
    "O link vale por 1 hora e só pode ser usado uma vez.",
    "Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.",
    `Dúvidas? Escreva para ${replyToEmail()}.`,
  ].join("\n");
}

export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL || "naoresponda@gestarahub.com.br";
  const fromName = process.env.MAILERSEND_FROM_NAME || "GestaraHub";

  if (!apiKey) return withoutApiKey(input.resetUrl);

  const iconBase64 = await getEmailIconBase64();
  const payload: Record<string, unknown> = {
    from: { email: fromEmail, name: fromName },
    to: [{ email: input.toEmail.trim(), name: input.toName.trim() }],
    reply_to: { email: replyToEmail(), name: fromName },
    subject: "Crie uma nova senha no GestaraHub",
    html: buildPasswordResetEmailHtml({ ...input, hasInlineIcon: Boolean(iconBase64) }),
    text: buildPasswordResetEmailText(input),
  };
  if (iconBase64) {
    payload.attachments = [
      { content: iconBase64, filename: "email-icon.png", disposition: "inline", id: "gestarahub-icon" },
    ];
  }

  try {
    const response = await fetch(MAILERSEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logError("[mailersend] Erro ao enviar e-mail de nova senha:", response.status, errorBody);
      return { ok: false, error: "Não foi possível enviar o e-mail. Tente novamente em instantes." };
    }
    if (await wasSuppressed(response, "nova senha")) return { ok: false, error: SUPPRESSED_ERROR };
    return { ok: true };
  } catch (err) {
    logError("[mailersend] Falha de conexão ao enviar e-mail de nova senha:", err);
    return { ok: false, error: "Não foi possível enviar o e-mail. Verifique sua conexão e tente novamente." };
  }
}

// --- Codigo da verificacao em duas etapas (doc technical/17) ------------------

export interface SendTwoFactorCodeEmailInput {
  toEmail: string;
  toName: string;
  code: string;
}

export function buildTwoFactorCodeEmailHtml({
  toName,
  code,
  hasInlineIcon,
}: SendTwoFactorCodeEmailInput & { hasInlineIcon: boolean }): string {
  const firstName = escapeHtml(toName.trim().split(/\s+/)[0] || toName.trim());
  const safeCode = escapeHtml(code);

  return renderEmailLayout({
    title: "Seu código de acesso ao GestaraHub",
    preheader: `Seu código: ${safeCode}. Vale por 10 minutos.`,
    heading: `Seu código de acesso, ${firstName}`,
    intro: "Use este código para entrar no GestaraHub.",
    body: `<p style="margin:0 0 24px 0;font-size:34px;font-weight:800;letter-spacing:0.3em;color:#0f172a;text-align:center;font-family:'SFMono-Regular',Menlo,Consolas,monospace;">
                ${safeCode}
              </p>
              ${emailNotice("<strong>&#9201; Vale por 10 minutos.</strong> Se não foi você, troque sua senha.")}`,
    footer: `Nunca passe este código para outra pessoa. A equipe do GestaraHub não pede o código.<br />
              <span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
    hasInlineIcon,
  });
}

export function buildTwoFactorCodeEmailText({ toName, code }: SendTwoFactorCodeEmailInput): string {
  const firstName = toName.trim().split(/\s+/)[0] || toName.trim();
  return [
    `Seu código de acesso, ${firstName}`,
    "",
    `Código: ${code}`,
    "",
    "Vale por 10 minutos. Se não foi você, troque sua senha.",
    "Nunca passe este código para outra pessoa.",
    `Dúvidas? Escreva para ${replyToEmail()}.`,
  ].join("\n");
}

export async function sendTwoFactorCodeEmail(
  input: SendTwoFactorCodeEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL || "naoresponda@gestarahub.com.br";
  const fromName = process.env.MAILERSEND_FROM_NAME || "GestaraHub";

  if (!apiKey) return withoutApiKey(input.code, `Código para ${input.toEmail}`);

  const iconBase64 = await getEmailIconBase64();
  const payload: Record<string, unknown> = {
    from: { email: fromEmail, name: fromName },
    to: [{ email: input.toEmail.trim(), name: input.toName.trim() }],
    reply_to: { email: replyToEmail(), name: fromName },
    subject: "Seu código de acesso ao GestaraHub",
    html: buildTwoFactorCodeEmailHtml({ ...input, hasInlineIcon: Boolean(iconBase64) }),
    text: buildTwoFactorCodeEmailText(input),
  };
  if (iconBase64) {
    payload.attachments = [
      { content: iconBase64, filename: "email-icon.png", disposition: "inline", id: "gestarahub-icon" },
    ];
  }

  try {
    const response = await fetch(MAILERSEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logError("[mailersend] Erro ao enviar o código de acesso:", response.status, errorBody);
      return { ok: false, error: "Não foi possível enviar o código. Tente novamente em instantes." };
    }
    if (await wasSuppressed(response, "código de acesso")) return { ok: false, error: SUPPRESSED_ERROR };
    return { ok: true };
  } catch (err) {
    logError("[mailersend] Falha de conexão ao enviar o código de acesso:", err);
    return { ok: false, error: "Não foi possível enviar o código. Verifique sua conexão e tente novamente." };
  }
}

export interface SendWelcomeEmailInput {
  toEmail: string;
  toName: string;
  /** Raiz do app; o botao vai ao login, que leva a configuracao inicial ou ao Painel. */
  appUrl: string;
}

/** Caixa que le as respostas e aparece no "Duvidas?" de todos os e-mails. */
function replyToEmail(): string {
  return process.env.MAILERSEND_REPLY_TO_EMAIL?.trim() || SUPPORT_EMAIL;
}

let cachedInstagramIconBase64: string | null = null;

async function getInstagramIconBase64(): Promise<string | null> {
  if (cachedInstagramIconBase64) return cachedInstagramIconBase64;
  try {
    const buffer = await readFile(path.join(process.cwd(), "public", "email-instagram.png"));
    cachedInstagramIconBase64 = buffer.toString("base64");
    return cachedInstagramIconBase64;
  } catch {
    return null;
  }
}

const WELCOME_STEPS = [
  { title: "Configure seu espaço", text: "Nome, área e as aulas que você dá." },
  { title: "Matricule seus alunos", text: "Monte as turmas e adicione quem já frequenta." },
  { title: "Faça a chamada", text: "Presença em um toque e cobranças em dia." },
];

export function buildWelcomeEmailHtml({
  toName,
  appUrl,
  hasInlineIcon,
  hasInstagramIcon,
}: SendWelcomeEmailInput & { hasInlineIcon: boolean; hasInstagramIcon: boolean }): string {
  const firstName = escapeHtml(toName.trim().split(/\s+/)[0] || toName.trim());
  const base = appUrl.replace(/\/+$/, "");
  const loginUrl = escapeHtml(`${base}/login`);
  const siteUrl = escapeHtml(base);
  const termsUrl = escapeHtml(`${base}/terms`);
  const privacyUrl = escapeHtml(`${base}/privacy`);
  const instagramUrl = escapeHtml(INSTAGRAM_URL);
  const instagramHandle = escapeHtml(INSTAGRAM_HANDLE);

  const instagramIcon = hasInstagramIcon
    ? `<img src="cid:gestarahub-instagram" width="44" height="44" alt="Instagram" style="display:block;border:0;border-radius:12px;" />`
    : `<div style="width:44px;height:44px;border-radius:12px;background:#d6249f;color:#ffffff;font-weight:800;font-size:13px;line-height:44px;text-align:center;">IG</div>`;

  const steps = WELCOME_STEPS.map(
    (step, index) => `
                <tr>
                  <td style="width:40px;padding:0 14px 18px 0;vertical-align:top;">
                    <div style="width:32px;height:32px;border-radius:999px;background-color:#eff6ff;color:#2563eb;font-size:14px;font-weight:800;line-height:32px;text-align:center;">${index + 1}</div>
                  </td>
                  <td style="padding:0 0 18px 0;vertical-align:top;">
                    <p style="margin:0;font-size:15px;font-weight:700;line-height:1.4;color:#0f172a;">${step.title}</p>
                    <p style="margin:2px 0 0 0;font-size:14px;line-height:1.5;color:#64748b;">${step.text}</p>
                  </td>
                </tr>`,
  ).join("");

  return renderEmailLayout({
    title: "Bem-vindo ao GestaraHub",
    preheader: "Sua conta está criada. Veja os primeiros passos para deixar seu espaço pronto.",
    heading: `Bem-vindo, ${firstName}!`,
    intro: "Sua conta está criada. Agora é deixar seu espaço pronto para o dia a dia.",
    body: `<p style="margin:0 0 18px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Seus primeiros passos</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps}
              </table>
              <div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>
              ${emailButton(loginUrl, "Continuar configuração")}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;margin:6px 0 0 0;">
                <tr>
                  <td style="width:44px;padding:18px 14px 18px 18px;vertical-align:middle;">
                    <a href="${instagramUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">${instagramIcon}</a>
                  </td>
                  <td style="padding:18px 8px 18px 0;vertical-align:middle;">
                    <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">Acompanhe as novidades</p>
                    <p style="margin:2px 0 0 0;font-size:13px;line-height:1.5;color:#64748b;">Novidades do produto e dicas para o seu dia a dia.</p>
                  </td>
                  <td style="padding:18px 18px 18px 0;vertical-align:middle;text-align:right;white-space:nowrap;">
                    <a href="${instagramUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:9px 14px;font-size:13px;font-weight:700;color:#0f172a;text-decoration:none;border:1px solid #cbd5e1;border-radius:9px;background-color:#ffffff;">Seguir @${instagramHandle}</a>
                  </td>
                </tr>
              </table>`,
    footer: `<a href="${siteUrl}" style="color:#64748b;text-decoration:none;">Site</a>
              &nbsp;·&nbsp;
              <a href="${instagramUrl}" style="color:#64748b;text-decoration:none;">Instagram</a>
              &nbsp;·&nbsp;
              <a href="${termsUrl}" style="color:#64748b;text-decoration:none;">Termos de uso</a>
              &nbsp;·&nbsp;
              <a href="${privacyUrl}" style="color:#64748b;text-decoration:none;">Privacidade</a>
              <br />
              Você recebeu este e-mail porque criou uma conta no GestaraHub.`,
    hasInlineIcon,
  });
}

export function buildWelcomeEmailText({ toName, appUrl, replyTo }: SendWelcomeEmailInput & { replyTo: string }): string {
  const firstName = toName.trim().split(/\s+/)[0] || toName.trim();
  const base = appUrl.replace(/\/+$/, "");
  return [
    `Bem-vindo, ${firstName}!`,
    "",
    "Sua conta está criada. Agora é deixar seu espaço pronto para o dia a dia.",
    "",
    "Seus primeiros passos:",
    ...WELCOME_STEPS.map((step, index) => `${index + 1}. ${step.title}: ${step.text}`),
    "",
    `Continuar configuração: ${base}/login`,
    "",
    `Acompanhe as novidades no Instagram: ${INSTAGRAM_URL}`,
    "",
    `Dúvidas? Escreva para ${replyTo}.`,
  ].join("\n");
}

/**
 * Boas-vindas do dono, no primeiro aceite dos termos. Quem chama nao trava o
 * fluxo se falhar. Respostas vao para a caixa de contato (reply-to).
 */
export async function sendWelcomeEmail(
  input: SendWelcomeEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL || "naoresponda@gestarahub.com.br";
  const fromName = process.env.MAILERSEND_FROM_NAME || "GestaraHub";
  if (!apiKey) return withoutApiKey(input.appUrl);

  const replyTo = replyToEmail();
  const [iconBase64, instagramBase64] = await Promise.all([getEmailIconBase64(), getInstagramIconBase64()]);
  const payload: Record<string, unknown> = {
    from: { email: fromEmail, name: fromName },
    to: [{ email: input.toEmail.trim(), name: input.toName.trim() }],
    reply_to: { email: replyTo, name: fromName },
    subject: "Bem-vindo ao GestaraHub",
    html: buildWelcomeEmailHtml({
      ...input,
      hasInlineIcon: Boolean(iconBase64),
      hasInstagramIcon: Boolean(instagramBase64),
    }),
    text: buildWelcomeEmailText({ ...input, replyTo }),
  };
  const attachments = [
    ...(iconBase64
      ? [{ content: iconBase64, filename: "email-icon.png", disposition: "inline", id: "gestarahub-icon" }]
      : []),
    ...(instagramBase64
      ? [{ content: instagramBase64, filename: "email-instagram.png", disposition: "inline", id: "gestarahub-instagram" }]
      : []),
  ];
  if (attachments.length > 0) payload.attachments = attachments;

  try {
    const response = await fetch(MAILERSEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logError("[mailersend] Erro ao enviar boas-vindas:", response.status, errorBody);
      return { ok: false, error: "Não foi possível enviar o e-mail de boas-vindas." };
    }
    if (await wasSuppressed(response, "boas-vindas")) return { ok: false, error: SUPPRESSED_ERROR };
    return { ok: true };
  } catch (err) {
    logError("[mailersend] Falha de conexão ao enviar boas-vindas:", err);
    return { ok: false, error: "Não foi possível enviar o e-mail de boas-vindas." };
  }
}

export interface ErrorDigestItem {
  event: string;
  message: string;
  count: number;
  level: string;
  source: string;
  last_seen: string;
  last_reference: string | null;
  organization_id: string | null;
  isNew: boolean;
}

/** Resumo diario dos erros (doc technical/21): para quem cuida do sistema, nao para o cliente. */
export async function sendErrorDigestEmail(input: {
  toEmail: string;
  rows: ErrorDigestItem[];
  total: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL || "naoresponda@gestarahub.com.br";
  const fromName = process.env.MAILERSEND_FROM_NAME || "GestaraHub";
  const line = (r: ErrorDigestItem) =>
    `${r.isNew ? "NOVO" : "voltou"} · ${r.count}x · ${r.source}/${r.event}${r.organization_id ? ` · espaço ${r.organization_id}` : ""}` +
    `${r.last_reference ? ` · código ${r.last_reference}` : ""}\n  ${r.message.slice(0, 300)}`;
  const text =
    `${input.total} erro(s) novos ou que voltaram nas últimas 24 horas.\n\n` +
    input.rows.map(line).join("\n\n") +
    (input.total > input.rows.length ? `\n\n... e mais ${input.total - input.rows.length}.` : "") +
    "\n\nDetalhes: tabela error_logs (busque pelo código).";
  const html =
    `<p>${input.total} erro(s) novos ou que voltaram nas últimas 24 horas.</p><ul>` +
    input.rows
      .map(
        (r) =>
          `<li><strong>${r.isNew ? "Novo" : "Voltou"}</strong> · ${r.count}x · ${escapeHtml(r.source)}/${escapeHtml(r.event)}` +
          `${r.organization_id ? ` · espaço ${escapeHtml(r.organization_id)}` : ""}` +
          `${r.last_reference ? ` · código <code>${escapeHtml(r.last_reference)}</code>` : ""}` +
          `<br><span style="color:#555">${escapeHtml(r.message.slice(0, 300))}</span></li>`,
      )
      .join("") +
    `</ul>${input.total > input.rows.length ? `<p>... e mais ${input.total - input.rows.length}.</p>` : ""}` +
    "<p>Detalhes: tabela <code>error_logs</code> (busque pelo código).</p>";

  if (!apiKey) {
    // Desenvolvimento: o resumo sai no console (nao e erro).
    console.info("[mailersend] MAILERSEND_API_KEY ausente. Resumo de erros (so desenvolvimento):\n" + text);
    return { ok: true };
  }
  try {
    const response = await fetch(MAILERSEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: { email: fromEmail, name: fromName },
        to: [{ email: input.toEmail }],
        subject: `GestaraHub: ${input.total} erro(s) nas últimas 24 horas`,
        html,
        text,
      }),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return { ok: false, error: `MailerSend ${response.status}: ${errorBody.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface SendPlanNoticeEmailInput {
  toEmail: string;
  toName: string;
  /** Titulo do aviso (vira o assunto). */
  title: string;
  text: string;
  actionLabel: string;
  actionUrl: string;
}

/**
 * Aviso da renovacao do Plano GestaraHub ao dono e ao gerente (doc product/13
 * §6): os mesmos textos do aviso fixo no topo do app (`lib/plan-notice-copy`).
 */
export async function sendPlanNoticeEmail(
  input: SendPlanNoticeEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL || "naoresponda@gestarahub.com.br";
  const fromName = process.env.MAILERSEND_FROM_NAME || "GestaraHub";
  if (!apiKey) return withoutApiKey(input.actionUrl, `Aviso do plano para ${input.toEmail}`);

  const firstName = input.toName.trim().split(/\s+/)[0] || input.toName.trim();
  const iconBase64 = await getEmailIconBase64();
  const html = renderEmailLayout({
    title: escapeHtml(input.title),
    preheader: escapeHtml(input.text),
    heading: escapeHtml(input.title),
    intro: `${escapeHtml(firstName)}, ${escapeHtml(input.text.charAt(0).toLowerCase() + input.text.slice(1))}`,
    body: `${emailButton(input.actionUrl, escapeHtml(input.actionLabel))}${emailFallbackLink(input.actionUrl)}`,
    footer: `<span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
    hasInlineIcon: Boolean(iconBase64),
  });
  const payload: Record<string, unknown> = {
    from: { email: fromEmail, name: fromName },
    to: [{ email: input.toEmail.trim(), name: input.toName.trim() }],
    reply_to: { email: replyToEmail(), name: fromName },
    subject: input.title,
    html,
    text: [input.title, "", input.text, "", `${input.actionLabel}: ${input.actionUrl}`, `Dúvidas? Escreva para ${replyToEmail()}.`].join("\n"),
  };
  if (iconBase64) {
    payload.attachments = [
      { content: iconBase64, filename: "email-icon.png", disposition: "inline", id: "gestarahub-icon" },
    ];
  }

  try {
    const response = await fetch(MAILERSEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logError("[mailersend] Erro ao enviar o aviso do plano:", response.status, errorBody);
      return { ok: false, error: "Não foi possível enviar o aviso do plano." };
    }
    if (await wasSuppressed(response, "aviso do plano")) return { ok: false, error: SUPPRESSED_ERROR };
    return { ok: true };
  } catch (err) {
    logError("[mailersend] Falha de conexão ao enviar o aviso do plano:", err);
    return { ok: false, error: "Não foi possível enviar o aviso do plano." };
  }
}
