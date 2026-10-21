import { readFile } from "node:fs/promises";
import path from "node:path";

const MAILERSEND_API_URL = "https://api.mailersend.com/v1/email";

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

export function buildSignupEmailHtml({
  toName,
  toEmail,
  signupUrl,
  hasInlineIcon,
}: SendSignupLinkEmailInput & { hasInlineIcon: boolean }): string {
  const firstName = escapeHtml(toName.trim().split(/\s+/)[0] || toName.trim());
  const safeEmail = escapeHtml(toEmail.trim());
  const safeUrl = escapeHtml(signupUrl);

  const iconMarkup = hasInlineIcon
    ? `<img src="cid:gestarahub-icon" width="38" height="38" alt="GestaraHub" style="display:block;border:0;border-radius:9px;" />`
    : `<div style="width:38px;height:38px;border-radius:9px;background:#2563eb;color:#ffffff;font-weight:800;font-size:18px;line-height:38px;text-align:center;">G</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Conclua seu cadastro no GestaraHub</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
          <!-- Top Brand Gradient Bar -->
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#f38020 0%,#25b4b8 50%,#8a1b9e 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              <!-- Brand Header -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    ${iconMarkup}
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:21px;font-weight:800;letter-spacing:-0.03em;color:#0f172a;">Gestara<span style="color:#2563eb;">Hub</span></span>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;letter-spacing:-0.025em;color:#0f172a;line-height:1.25;">
                Falta só criar sua senha, ${firstName}!
              </h1>

              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Recebemos seu pedido para criar uma conta grátis no <strong>GestaraHub</strong> com o e-mail <strong style="color:#0f172a;">${safeEmail}</strong>. Clique no botão abaixo para definir sua senha e configurar seu espaço em menos de 1 minuto.
              </p>

              <!-- Primary CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:#2563eb;">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Definir minha senha e acessar &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- 24h Expiration Notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 16px;font-size:13px;line-height:1.5;color:#92400e;">
                    <strong>&#9201; Este link expira em 24 horas.</strong> Se o prazo vencer, basta clicar no link mesmo assim ou preencher seu e-mail novamente para gerar um novo na hora.
                  </td>
                </tr>
              </table>

              <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0 16px 0;" />

              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                Se o botão não abrir, copie e cole este endereço no navegador:<br />
                <a href="${safeUrl}" style="color:#2563eb;word-break:break-all;text-decoration:underline;">${safeUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;font-size:12px;line-height:1.5;color:#94a3b8;">
              Você recebeu este e-mail porque solicitou a criação de conta no GestaraHub. Se não foi você, pode ignorar esta mensagem com segurança.<br />
              <span style="color:#64748b;">GestaraHub · E-mail automático, não responda.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    "GestaraHub — E-mail automático, não responda.",
  ].join("\n");
}

export async function sendSignupLinkEmail(
  input: SendSignupLinkEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL || "naoresponda@gestarahub.com.br";
  const fromName = process.env.MAILERSEND_FROM_NAME || "GestaraHub";

  if (!apiKey) {
    console.warn("[mailersend] MAILERSEND_API_KEY ausente. Link gerado:", input.signupUrl);
    return { ok: true };
  }

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
      console.error("[mailersend] Erro ao enviar e-mail:", response.status, errorBody);
      return {
        ok: false,
        error: "Não foi possível enviar o e-mail de confirmação. Tente novamente em instantes.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("[mailersend] Falha de conexão ao enviar e-mail:", err);
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

  const iconMarkup = hasInlineIcon
    ? `<img src="cid:gestarahub-icon" width="38" height="38" alt="GestaraHub" style="display:block;border:0;border-radius:9px;" />`
    : `<div style="width:38px;height:38px;border-radius:9px;background:#2563eb;color:#ffffff;font-weight:800;font-size:18px;line-height:38px;text-align:center;">G</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Convite para a equipe no GestaraHub</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
          <!-- Top Brand Gradient Bar -->
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#f38020 0%,#25b4b8 50%,#8a1b9e 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              <!-- Brand Header -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    ${iconMarkup}
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:21px;font-weight:800;letter-spacing:-0.03em;color:#0f172a;">Gestara<span style="color:#2563eb;">Hub</span></span>
                  </td>
                </tr>
              </table>

              <div style="display:inline-block;padding:4px 10px;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;font-size:12px;font-weight:700;color:#2563eb;margin-bottom:16px;">
                Convite de Equipe
              </div>

              <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;letter-spacing:-0.025em;color:#0f172a;line-height:1.25;">
                Você foi convidado para a equipe, ${firstName}!
              </h1>

              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#475569;">
                O espaço <strong style="color:#0f172a;">${safeOrgName}</strong> convidou você para fazer parte da equipe no <strong>GestaraHub</strong> como <strong>${safeProfile}</strong>.
              </p>

              <!-- Feature Highlights Box -->
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 22px;margin-bottom:24px;">
                <p style="margin:0 0 12px 0;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:#334155;">
                  Com seu acesso ao sistema, você poderá:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0;font-size:14px;color:#475569;line-height:1.5;">
                      <span style="color:#10b981;font-weight:700;margin-right:8px;">✓</span> Fazer chamada rápida e registrar presenças no celular durante a aula
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:14px;color:#475569;line-height:1.5;">
                      <span style="color:#10b981;font-weight:700;margin-right:8px;">✓</span> Acompanhar os alunos matriculados e o controle de faltas
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:14px;color:#475569;line-height:1.5;">
                      <span style="color:#10b981;font-weight:700;margin-right:8px;">✓</span> Lançar notas, avaliações e acompanhar a evolução de faixas ou graus
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:14px;color:#475569;line-height:1.5;">
                      <span style="color:#10b981;font-weight:700;margin-right:8px;">✓</span> Consultar a grade e o cronograma completo das suas turmas
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Primary CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:#2563eb;">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Aceitar convite e definir senha &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice -->
              <div style="background-color:#fefce8;border:1px solid #fef08a;border-radius:10px;padding:12px 14px;margin-bottom:24px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#854d0e;">
                  <strong>Atenção:</strong> Este link é válido por <strong>${expiresInDays} dias</strong> e foi gerado exclusivamente para <strong>${safeEmail}</strong>.
                </p>
              </div>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                Se você não reconhece este convite ou não faz parte desta equipe, basta ignorar este e-mail.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;">
                GestaraHub — Gestão simples para quem ensina.
              </p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;">
                Este é um e-mail transacional automático. Por favor, não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    "GestaraHub — E-mail automático, não responda.",
  ].join("\n");
}

export async function sendOrganizationInvitationEmail(
  input: SendOrganizationInvitationEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL || "naoresponda@gestarahub.com.br";
  const fromName = process.env.MAILERSEND_FROM_NAME || "GestaraHub";

  if (!apiKey) {
    console.warn("[mailersend] MAILERSEND_API_KEY ausente. Link de convite gerado:", input.inviteUrl);
    return { ok: true };
  }

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
      console.error("[mailersend] Erro ao enviar convite:", response.status, errorBody);
      return {
        ok: false,
        error: "Não foi possível enviar o e-mail de convite. Tente novamente em instantes.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("[mailersend] Falha de conexão ao enviar convite:", err);
    return {
      ok: false,
      error: "Falha ao conectar com o serviço de e-mail. Verifique a conexão.",
    };
  }
}

