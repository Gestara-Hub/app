import { readFile } from "node:fs/promises";
import path from "node:path";
import { COMPANY_ADDRESS, COMPANY_CNPJ, COMPANY_NAME, INSTAGRAM_HANDLE, INSTAGRAM_URL, SITE_URL, SUPPORT_EMAIL } from "@/config/site";
import { logError } from "@/lib/log";
import {
  EMAIL_ICON_CONTENT_ID,
  EMAIL_ICON_VERSION,
  type EmailIconState,
  escapeEmailHtml as escapeHtml,
  hostedEmailAssetUrl,
  renderBrandEmailLayout,
  renderEmailButtonHtml as emailButton,
  renderEmailFallbackLinkHtml as emailFallbackLink,
  renderEmailNoticeHtml as emailNotice,
  renderOpsAlertEmail,
} from "@gestarahub/core/email-layouts";
import { formatCents } from "@gestarahub/core/format";
import {
  emailSenderFromEnv,
  sendSesEmail,
  sesCredentialsFromEnv,
  type SesEmailAttachment,
} from "@gestarahub/core/ses";

export interface SendSignupLinkEmailInput {
  toEmail: string;
  toName: string;
  signupUrl: string;
}

/**
 * Icone do topo dos e-mails (04/11/2026): com o site num endereco publico, vem
 * da propria CDN do site (`public/email-icon.png`), sem anexo em cada mensagem;
 * sem ele (localhost, tunel de desenvolvimento), segue anexado inline (cid),
 * para aparecer nos testes. O `v` troca quando o icone muda (proxy do Gmail).
 */
export function hostedEmailIconUrl(siteUrl: string = SITE_URL, file = "email-icon.png"): string | null {
  return hostedEmailAssetUrl(siteUrl, file, EMAIL_ICON_VERSION);
}

let cachedIconBase64: string | null = null;

export async function getEmailIconBase64(): Promise<string | null> {
  // Icone servido pelo site: nada a anexar.
  if (hostedEmailIconUrl()) return null;
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

export function inlineIconAttachment(iconBase64: string): SesEmailAttachment {
  return {
    fileName: "email-icon.png",
    contentType: "image/png",
    contentDisposition: "INLINE",
    contentId: EMAIL_ICON_CONTENT_ID,
    rawContentBase64: iconBase64,
  };
}

/** Caixa que le as respostas e aparece no "Duvidas?" de todos os e-mails. */
function replyToEmail(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || SUPPORT_EMAIL;
}

/** Moldura principal dos e-mails de marca no `@gestarahub/core/email-layouts`. */
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
  return renderBrandEmailLayout({
    title,
    preheader,
    badge,
    heading,
    intro,
    body,
    footer,
    supportEmail: replyToEmail(),
    icon: {
      hasInlineIcon,
      hostedIconUrl: hostedEmailIconUrl(),
    },
    company: {
      name: COMPANY_NAME,
      cnpj: COMPANY_CNPJ,
      address: COMPANY_ADDRESS,
    },
  });
}

/**
 * Em desenvolvimento e nos e2e, se o envio falhar (ex.: credenciais AWS ausentes,
 * ou conta em Sandbox para destinatario nao verificado), o link ou codigo sai no
 * terminal para nao travar o fluxo nem revogar convites.
 * Em producao e falha real: nunca dizer que enviou sem enviar.
 */
function devDeliveryFallback(
  linkOrCode: string,
  what = "Link gerado",
  reason = "Credenciais AWS SES ausentes",
  prodErrorMessage = "O envio de e-mails está fora do ar. Tente novamente mais tarde.",
): { ok: true } | { ok: false; error: string } {
  // E2E_NOW so existe no servidor dos e2e (tambem no modo producao, doc 20).
  if (process.env.NODE_ENV === "production" && !process.env.E2E_NOW) {
    logError(`[ses] Falha de envio em produção (${reason}): e-mail não enviado.`);
    return { ok: false, error: prodErrorMessage };
  }
  // Saida de proposito (em desenvolvimento o link e lido daqui): nao e erro, nao vai ao registro.
  console.warn(`[ses] ${reason}. ${what} (só desenvolvimento):`, linkOrCode);
  return { ok: true };
}

interface DeliverEmailInput {
  toEmail: string;
  toName?: string;
  subject: string;
  html: (icons: { hasInlineIcon: boolean; hasInstagramIcon: boolean }) => string;
  text: string;
  devText: string;
  what: string;
  context: string;
  prodErrorMessage?: string;
  includeInstagramIcon?: boolean;
}

async function deliverEmail(input: DeliverEmailInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const credentials = sesCredentialsFromEnv();
  if (!credentials) {
    return devDeliveryFallback(input.devText, input.what, "Credenciais AWS SES ausentes");
  }

  const [iconBase64, instagramBase64] = await Promise.all([
    getEmailIconBase64(),
    input.includeInstagramIcon ? getInstagramIconBase64() : Promise.resolve(null),
  ]);

  const attachments: SesEmailAttachment[] = [];
  if (iconBase64) {
    attachments.push(inlineIconAttachment(iconBase64));
  }
  if (instagramBase64) {
    attachments.push({
      fileName: "email-instagram.png",
      contentType: "image/png",
      contentDisposition: "INLINE",
      contentId: "gestarahub-instagram",
      rawContentBase64: instagramBase64,
    });
  }

  const from = emailSenderFromEnv();
  const replyTo = replyToEmail();
  const toName = input.toName?.trim();
  const result = await sendSesEmail({
    credentials,
    from,
    to: [{ email: input.toEmail.trim(), ...(toName ? { name: toName } : {}) }],
    replyTo: [{ email: replyTo, name: from.name }],
    subject: input.subject,
    html: input.html({
      hasInlineIcon: Boolean(iconBase64),
      hasInstagramIcon: Boolean(instagramBase64),
    }),
    text: input.text,
    ...(attachments.length > 0 ? { attachments } : {}),
  });

  if (!result.ok) {
    logError(`[ses] Erro ao enviar ${input.context}:`, result.status ?? "rede", result.error);
    return devDeliveryFallback(
      input.devText,
      input.what,
      result.status ? `Amazon SES recusou (status ${result.status})` : "Falha de conexão com Amazon SES",
      input.prodErrorMessage ?? "Não foi possível enviar o e-mail. Tente novamente em instantes.",
    );
  }
  return { ok: true };
}

export function buildSignupEmailHtml({
  toName,
  toEmail,
  signupUrl,
  hasInlineIcon,
}: SendSignupLinkEmailInput & { hasInlineIcon: boolean }): string {
  const firstName = escapeHtml(toName.trim().split(/\s+/)[0] || toName.trim());
  const safeEmail = escapeHtml(toEmail.trim());

  return renderEmailLayout({
    title: "Conclua seu cadastro no GestaraHub",
    preheader: "Defina sua senha para concluir o cadastro. O link vale por 24 horas.",
    heading: `Falta só criar sua senha, ${firstName}!`,
    intro: "Um passo e sua conta grátis está pronta.",
    body: `<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Recebemos seu pedido para criar uma conta no <strong>GestaraHub</strong> com o e-mail <strong style="color:#0f172a;">${safeEmail}</strong>. Clique no botão abaixo para definir sua senha e configurar seu espaço.
              </p>
              ${emailButton(signupUrl, "Definir minha senha")}
              ${emailNotice("<strong>&#9201; Este link expira em 24 horas.</strong> Se o prazo vencer, abra o link mesmo assim ou preencha seu e-mail de novo para gerar outro na hora.")}
              ${emailFallbackLink(signupUrl)}`,
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

export function sendSignupLinkEmail(
  input: SendSignupLinkEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return deliverEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Conclua seu cadastro no GestaraHub — defina sua senha",
    html: ({ hasInlineIcon }) => buildSignupEmailHtml({ ...input, hasInlineIcon }),
    text: buildSignupEmailText(input),
    devText: input.signupUrl,
    what: `Link de cadastro para ${input.toEmail}`,
    context: "cadastro",
    prodErrorMessage: "Não foi possível enviar o e-mail de confirmação. Tente novamente em instantes.",
  });
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
    heading: `Você recebeu um convite, ${firstName}!`,
    intro: `<strong style="color:#ffffff;">${safeOrgName}</strong> adicionou você à equipe no GestaraHub com o perfil de acesso <strong style="color:#ffffff;">${safeProfile}</strong>.`,
    body: `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#475569;">
                Com a sua conta no GestaraHub (${safeEmail}), você poderá:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                ${features}
              </table>
              ${emailButton(inviteUrl, "Aceitar convite e criar senha")}
              ${emailNotice(`<strong>&#9201; Este convite expira em ${expiresInDays} dias.</strong> Caso expire, peça a quem administra o espaço para reenviar.`)}
              ${emailFallbackLink(inviteUrl)}`,
    footer: `Você recebeu este convite porque quem administra ${safeOrgName} cadastrou seu e-mail.`,
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
    `Você recebeu um convite, ${firstName}!`,
    "",
    `${organizationName.trim()} adicionou você à equipe no GestaraHub com o perfil de acesso ${profileLabel.trim()}.`,
    "Aceite o convite e crie sua senha pelo link abaixo:",
    "",
    inviteUrl,
    "",
    `Este link expira em ${expiresInDays} dias. Caso expire, peça a quem administra o espaço para reenviar.`,
    "",
    `Dúvidas? Escreva para ${replyToEmail()}.`,
  ].join("\n");
}

export function sendOrganizationInvitationEmail(
  input: SendOrganizationInvitationEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return deliverEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: `${input.organizationName} convidou você para a equipe no GestaraHub`,
    html: ({ hasInlineIcon }) => buildOrganizationInvitationEmailHtml({ ...input, hasInlineIcon }),
    text: buildOrganizationInvitationEmailText(input),
    devText: input.inviteUrl,
    what: `Link de convite para ${input.toEmail}`,
    context: "convite",
    prodErrorMessage: "Não foi possível enviar o e-mail de convite. Tente novamente em instantes.",
  });
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

  return renderEmailLayout({
    title: "Crie uma nova senha no GestaraHub",
    preheader: "Crie uma nova senha. O link vale por 1 hora.",
    heading: `Crie uma nova senha, ${firstName}`,
    intro: "Recebemos um pedido para trocar a senha da sua conta.",
    body: `<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Clique no botão abaixo para criar uma nova senha no <strong>GestaraHub</strong>.
              </p>
              ${emailButton(resetUrl, "Criar nova senha")}
              ${emailNotice("<strong>&#9201; Este link vale por 1 hora</strong> e só pode ser usado uma vez. Depois disso, peça outro na tela de login.")}
              ${emailFallbackLink(resetUrl)}`,
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

export function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return deliverEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Crie uma nova senha no GestaraHub",
    html: ({ hasInlineIcon }) => buildPasswordResetEmailHtml({ ...input, hasInlineIcon }),
    text: buildPasswordResetEmailText(input),
    devText: input.resetUrl,
    what: `Link de nova senha para ${input.toEmail}`,
    context: "nova senha",
  });
}

// --- Troca do e-mail de acesso (05/11/2026) ---------------------------------------

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

export interface SendEmailChangeConfirmInput {
  toEmail: string;
  toName: string;
  confirmUrl: string;
}

/** Para o e-mail NOVO: confirmar a troca (o link vale 1 hora). */
export function buildEmailChangeConfirmHtml({
  toName,
  toEmail,
  confirmUrl,
  hasInlineIcon,
}: SendEmailChangeConfirmInput & { hasInlineIcon: boolean }): string {
  const firstName = escapeHtml(firstNameOf(toName));
  return renderEmailLayout({
    title: "Confirme seu novo e-mail de acesso",
    preheader: "Confirme o novo e-mail de acesso. O link vale por 1 hora.",
    heading: `Confirme seu novo e-mail, ${firstName}`,
    intro: `Você pediu para entrar no GestaraHub com <strong>${escapeHtml(toEmail)}</strong>.`,
    body: `<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                A troca só vale depois que você confirmar no botão abaixo.
              </p>
              ${emailButton(confirmUrl, "Confirmar novo e-mail")}
              ${emailNotice("<strong>&#9201; Este link vale por 1 hora</strong> e só pode ser usado uma vez.")}
              ${emailFallbackLink(confirmUrl)}`,
    footer: `Se não foi você que pediu, ignore este e-mail: nada muda.<br />
              <span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
    hasInlineIcon,
  });
}

export function buildEmailChangeConfirmText({ toName, toEmail, confirmUrl }: SendEmailChangeConfirmInput): string {
  return [
    `Confirme seu novo e-mail, ${firstNameOf(toName)}`,
    "",
    `Você pediu para entrar no GestaraHub com ${toEmail}.`,
    "A troca só vale depois que você confirmar pelo link abaixo:",
    "",
    confirmUrl,
    "",
    "O link vale por 1 hora e só pode ser usado uma vez.",
    "Se não foi você que pediu, ignore este e-mail: nada muda.",
    `Dúvidas? Escreva para ${replyToEmail()}.`,
  ].join("\n");
}

export function sendEmailChangeConfirmEmail(
  input: SendEmailChangeConfirmInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return deliverEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Confirme seu novo e-mail de acesso ao GestaraHub",
    html: ({ hasInlineIcon }) => buildEmailChangeConfirmHtml({ ...input, hasInlineIcon }),
    text: buildEmailChangeConfirmText(input),
    devText: input.confirmUrl,
    what: `Link de troca de e-mail para ${input.toEmail}`,
    context: "troca de e-mail",
  });
}

export interface SendEmailChangedNoticeInput {
  toEmail: string;
  toName: string;
  /** O e-mail novo, ja mascarado (o aviso vai para o antigo). */
  maskedNewEmail: string;
}

/** Para o e-mail ANTIGO: o acesso mudou (se nao foi a pessoa, ela fala com a gente). */
export function buildEmailChangedNoticeHtml({
  toName,
  maskedNewEmail,
  hasInlineIcon,
}: SendEmailChangedNoticeInput & { hasInlineIcon: boolean }): string {
  const firstName = escapeHtml(firstNameOf(toName));
  return renderEmailLayout({
    title: "Seu e-mail de acesso mudou",
    preheader: "O e-mail de acesso da sua conta no GestaraHub mudou.",
    heading: `Seu e-mail de acesso mudou, ${firstName}`,
    intro: `A partir de agora você entra no GestaraHub com <strong>${escapeHtml(maskedNewEmail)}</strong>.`,
    body: emailNotice(
      `<strong>Não foi você?</strong> Responda este e-mail ou escreva para ${escapeHtml(replyToEmail())} agora mesmo.`,
    ),
    footer: `Este aviso vai para o e-mail antigo por segurança.<br />
              <span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
    hasInlineIcon,
  });
}

export function buildEmailChangedNoticeText({ toName, maskedNewEmail }: SendEmailChangedNoticeInput): string {
  return [
    `Seu e-mail de acesso mudou, ${firstNameOf(toName)}`,
    "",
    `A partir de agora você entra no GestaraHub com ${maskedNewEmail}.`,
    "",
    `Não foi você? Responda este e-mail ou escreva para ${replyToEmail()} agora mesmo.`,
  ].join("\n");
}

export function sendEmailChangedNoticeEmail(
  input: SendEmailChangedNoticeInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return deliverEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Seu e-mail de acesso ao GestaraHub mudou",
    html: ({ hasInlineIcon }) => buildEmailChangedNoticeHtml({ ...input, hasInlineIcon }),
    text: buildEmailChangedNoticeText(input),
    devText: `aviso para o e-mail antigo (novo: ${input.maskedNewEmail})`,
    what: `Aviso de troca de e-mail para ${input.toEmail}`,
    context: "aviso de troca de e-mail",
  });
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

export function sendTwoFactorCodeEmail(
  input: SendTwoFactorCodeEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return deliverEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Seu código de acesso ao GestaraHub",
    html: ({ hasInlineIcon }) => buildTwoFactorCodeEmailHtml({ ...input, hasInlineIcon }),
    text: buildTwoFactorCodeEmailText(input),
    devText: input.code,
    what: `Código 2FA para ${input.toEmail}`,
    context: "código de acesso",
    prodErrorMessage: "Não foi possível enviar o código. Tente novamente em instantes.",
  });
}

export interface SendWelcomeEmailInput {
  toEmail: string;
  toName: string;
  /** Raiz do app; o botao vai ao login, que leva a configuracao inicial ou ao Painel. */
  appUrl: string;
}

let cachedInstagramIconBase64: string | null = null;

async function getInstagramIconBase64(): Promise<string | null> {
  if (hostedEmailIconUrl(SITE_URL, "email-instagram.png")) return null;
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
  const loginHref = `${base}/login`;
  const siteUrl = escapeHtml(base);
  const termsUrl = escapeHtml(`${base}/terms`);
  const privacyUrl = escapeHtml(`${base}/privacy`);
  const instagramUrl = escapeHtml(INSTAGRAM_URL);
  const instagramHandle = escapeHtml(INSTAGRAM_HANDLE);

  const hostedInstagram = hostedEmailIconUrl(SITE_URL, "email-instagram.png");
  const instagramIcon = hasInstagramIcon
    ? `<img src="cid:gestarahub-instagram" width="44" height="44" alt="Instagram" style="display:block;border:0;border-radius:12px;" />`
    : hostedInstagram
      ? `<img src="${escapeHtml(hostedInstagram)}" width="44" height="44" alt="Instagram" style="display:block;border:0;border-radius:12px;" />`
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
    title: "Boas-vindas ao GestaraHub",
    preheader: "Sua conta está criada. Veja os primeiros passos para deixar seu espaço pronto.",
    heading: `Que bom ter você aqui, ${firstName}!`,
    intro: "Sua conta está criada. Agora é deixar seu espaço pronto para o dia a dia.",
    body: `<p style="margin:0 0 18px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Seus primeiros passos</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps}
              </table>
              <div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>
              ${emailButton(loginHref, "Continuar configuração")}

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
    `Que bom ter você aqui, ${firstName}!`,
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
export function sendWelcomeEmail(
  input: SendWelcomeEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const replyTo = replyToEmail();
  return deliverEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Boas-vindas ao GestaraHub",
    html: ({ hasInlineIcon, hasInstagramIcon }) =>
      buildWelcomeEmailHtml({ ...input, hasInlineIcon, hasInstagramIcon }),
    text: buildWelcomeEmailText({ ...input, replyTo }),
    devText: input.appUrl,
    what: `Boas-vindas para ${input.toEmail}`,
    context: "boas-vindas",
    prodErrorMessage: "Não foi possível enviar o e-mail de boas-vindas.",
    includeInstagramIcon: true,
  });
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

/**
 * Resumo diario dos erros (doc technical/21) e alerta na hora de erro nunca
 * visto (`instant`, doc technical/27): para quem cuida do sistema, nao para o cliente.
 */
export function buildErrorDigestHtml(input: {
  rows: ErrorDigestItem[];
  total: number;
  mode?: "daily" | "instant";
  release?: string;
  icon?: EmailIconState;
}): string {
  const instant = input.mode === "instant";
  const intro = instant
    ? `Erro novo no sistema${input.release ? ` (versão ${input.release})` : ""}: nunca tinha acontecido antes.`
    : `${input.total} erro(s) novos ou que voltaram nas últimas 24 horas.`;
  const firstRow = input.rows[0];
  const title = instant
    ? `Erro novo agora${firstRow ? `: ${firstRow.source}/${firstRow.event}` : ""}`
    : `${input.total} erro(s) nas últimas 24 horas`;

  return renderOpsAlertEmail({
    tone: instant ? "danger" : "warning",
    sectionLabel: "Saúde do sistema",
    badge: instant ? "ERRO NOVO" : "RESUMO 24H",
    title,
    subtitle: intro,
    items: input.rows.map((r) => ({
      badge: { text: r.isNew ? "Novo" : "Voltou", tone: r.isNew ? "danger" : "warning" },
      title: `${r.count}x · ${r.source}/${r.event}`,
      meta: [r.organization_id ? `Espaço ${r.organization_id}` : null, r.last_reference ? `Código ${r.last_reference}` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
      detail: r.message.slice(0, 300),
    })),
    overflowNote: input.total > input.rows.length ? `... e mais ${input.total - input.rows.length} ocorrência(s).` : undefined,
    note: "Detalhes completos na tabela error_logs (busque pelo código).",
    footer: "GestaraHub · Monitoramento interno",
    icon: input.icon ?? { hasInlineIcon: false, hostedIconUrl: hostedEmailIconUrl() },
  });
}

export async function sendErrorDigestEmail(input: {
  toEmail: string;
  rows: ErrorDigestItem[];
  total: number;
  mode?: "daily" | "instant";
  /** Versao do app em que o erro aconteceu (so no alerta na hora). */
  release?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const instant = input.mode === "instant";
  const intro = instant
    ? `Erro novo no sistema${input.release ? ` (versão ${input.release})` : ""}: nunca tinha acontecido antes.`
    : `${input.total} erro(s) novos ou que voltaram nas últimas 24 horas.`;
  const subject = instant
    ? `GestaraHub: erro novo agora (${input.rows[0]?.source ?? ""}/${input.rows[0]?.event ?? ""})`
    : `GestaraHub: ${input.total} erro(s) nas últimas 24 horas`;
  const line = (r: ErrorDigestItem) =>
    `${r.isNew ? "NOVO" : "voltou"} · ${r.count}x · ${r.source}/${r.event}${r.organization_id ? ` · espaço ${r.organization_id}` : ""}` +
    `${r.last_reference ? ` · código ${r.last_reference}` : ""}\n  ${r.message.slice(0, 300)}`;
  const text =
    `${intro}\n\n` +
    input.rows.map(line).join("\n\n") +
    (input.total > input.rows.length ? `\n\n... e mais ${input.total - input.rows.length}.` : "") +
    "\n\nDetalhes: tabela error_logs (busque pelo código).";

  const credentials = sesCredentialsFromEnv();
  if (!credentials) {
    // Desenvolvimento: o resumo sai no console (nao e erro).
    console.info("[ses] Credenciais AWS SES ausentes. Resumo de erros (só desenvolvimento):\n" + text);
    return { ok: true };
  }

  const iconBase64 = await getEmailIconBase64();
  const html = buildErrorDigestHtml({
    ...input,
    icon: { hasInlineIcon: Boolean(iconBase64), hostedIconUrl: hostedEmailIconUrl() },
  });

  const result = await sendSesEmail({
    credentials,
    from: emailSenderFromEnv(),
    to: [{ email: input.toEmail.trim() }],
    subject,
    html,
    text,
    ...(iconBase64 ? { attachments: [inlineIconAttachment(iconBase64)] } : {}),
  });
  if (!result.ok) {
    return { ok: false, error: `Amazon SES ${result.status ?? "rede"}: ${result.error.slice(0, 300)}` };
  }
  return { ok: true };
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
export function sendPlanNoticeEmail(
  input: SendPlanNoticeEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const firstName = input.toName.trim().split(/\s+/)[0] || input.toName.trim();
  return deliverEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: input.title,
    html: ({ hasInlineIcon }) =>
      renderEmailLayout({
        title: escapeHtml(input.title),
        preheader: escapeHtml(input.text),
        heading: escapeHtml(input.title),
        intro: `${escapeHtml(firstName)}, ${escapeHtml(input.text.charAt(0).toLowerCase() + input.text.slice(1))}`,
        body: `${emailButton(input.actionUrl, input.actionLabel)}${emailFallbackLink(input.actionUrl)}`,
        footer: `<span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
        hasInlineIcon,
      }),
    text: [input.title, "", input.text, "", `${input.actionLabel}: ${input.actionUrl}`, `Dúvidas? Escreva para ${replyToEmail()}.`].join("\n"),
    devText: input.actionUrl,
    what: `Aviso do plano para ${input.toEmail}`,
    context: "aviso do plano",
    prodErrorMessage: "Não foi possível enviar o aviso do plano.",
  });
}

// --- Ingresso do evento pelo link (12/11/2026) -------------------------------------

export interface SendEventTicketEmailInput {
  toEmail: string;
  toName: string;
  /** Inscricao de menor: o nome do participante (quem recebe e o responsavel). */
  participantName?: string;
  organizationName: string;
  eventName: string;
  /** Dias da inscricao ja escritos ("Terça-feira, 10/11 · 09:00 às 12:00"). */
  days: string[];
  ticketUrl: string;
  status: "confirmed" | "reserved";
  /** Valor em aberto (0: nada a pagar). */
  pendingCents: number;
  /** Reserva: por quantos minutos a vaga fica guardada. */
  holdMinutes?: number;
}

/** A frase do que falta: vaga garantida, falta pagar ou reserva com prazo. */
export function eventTicketStatusLine({ status, pendingCents, holdMinutes }: SendEventTicketEmailInput): string {
  if (status === "reserved") {
    return `Sua vaga fica reservada por ${holdMinutes ?? 30} minutos. Pague ${formatCents(pendingCents)} pela página do ingresso para garantir a vaga.`;
  }
  return pendingCents > 0
    ? `Sua vaga está garantida. Falta pagar ${formatCents(pendingCents)}: pague pela página do ingresso.`
    : "Sua vaga está garantida. Mostre o ingresso na entrada.";
}

/** Como usar o link: um QR so, mostrado em cada dia quando o evento tem mais de um. */
export function eventTicketUsageLine({ days }: SendEventTicketEmailInput): string {
  return days.length > 1
    ? "Guarde este link. Use o mesmo ingresso em todos os dias: mostre o QR code na entrada de cada dia."
    : "Guarde este link. Na entrada, mostre o QR code que aparece nele.";
}

export function buildEventTicketEmailSubject({ eventName }: SendEventTicketEmailInput): string {
  return `Seu ingresso: ${eventName}`;
}

export function buildEventTicketEmailText(input: SendEventTicketEmailInput): string {
  return [
    `Inscrição feita, ${firstNameOf(input.toName)}!`,
    "",
    `${input.eventName} · ${input.organizationName}`,
    ...(input.participantName ? [`Participante: ${input.participantName}`] : []),
    ...input.days,
    "",
    eventTicketStatusLine(input),
    "",
    `Seu ingresso: ${input.ticketUrl}`,
    eventTicketUsageLine(input),
    "",
    `Você recebeu este e-mail porque se inscreveu em ${input.eventName} pelo link de ${input.organizationName}. Se não foi você, ignore esta mensagem.`,
  ].join("\n");
}

export function buildEventTicketEmailHtml(input: SendEventTicketEmailInput & { hasInlineIcon: boolean }): string {
  const participant = input.participantName ? `Participante: ${escapeHtml(input.participantName)}<br />` : "";
  const days = participant + input.days.map((d) => `${escapeHtml(d)}<br />`).join("");
  return renderEmailLayout({
    title: escapeHtml(buildEventTicketEmailSubject(input)),
    preheader: escapeHtml(eventTicketStatusLine(input)),
    heading: `Inscrição feita, ${escapeHtml(firstNameOf(input.toName))}!`,
    intro: `${escapeHtml(input.eventName)} · ${escapeHtml(input.organizationName)}`,
    body: `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#475569;">${days}</p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">${escapeHtml(eventTicketStatusLine(input))}</p>
              ${emailButton(input.ticketUrl, "Ver meu ingresso")}
              ${emailNotice(escapeHtml(eventTicketUsageLine(input)))}
              ${emailFallbackLink(input.ticketUrl)}`,
    footer: `Você recebeu este e-mail porque se inscreveu em ${escapeHtml(input.eventName)} pelo link de ${escapeHtml(input.organizationName)}. Se não foi você, ignore esta mensagem.<br />
              <span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
    hasInlineIcon: input.hasInlineIcon,
  });
}

/**
 * Link do ingresso para o e-mail informado na inscricao pelo link. Em
 * desenvolvimento (e nos e2e) nao envia: imprime a mensagem no terminal do
 * servidor, como sairia, para pegar o link.
 */
export async function sendEventTicketEmail(input: SendEventTicketEmailInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const subject = buildEventTicketEmailSubject(input);
  const text = buildEventTicketEmailText(input);
  if (process.env.NODE_ENV !== "production" || process.env.E2E_NOW) {
    // Saida de proposito (o link e lido daqui em desenvolvimento): nao e erro, nao vai ao registro.
    console.info(`\n[e-mail não enviado: desenvolvimento]\nPara: ${input.toEmail}\nAssunto: ${subject}\n\n${text}\n`);
    return { ok: true };
  }
  return deliverEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject,
    html: ({ hasInlineIcon }) => buildEventTicketEmailHtml({ ...input, hasInlineIcon }),
    text,
    devText: input.ticketUrl,
    what: `Ingresso do evento para ${input.toEmail}`,
    context: "ingresso do evento",
  });
}
