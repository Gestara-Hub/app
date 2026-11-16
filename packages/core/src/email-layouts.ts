/**
 * Layouts HTML dos e-mails do GestaraHub (web e painel admin).
 *
 * Tres familias visuais, cada uma para um papel:
 * 1. `renderBrandEmailLayout` — marca/conta/seguranca (topo escuro, CTA azul).
 * 2. `renderSupportConversationEmail` — atendimento ao cliente (topo claro, foco na resposta).
 * 3. `renderOpsAlertEmail` — operacao interna (card compacto com badge de prioridade e lista).
 */

export const GESTARAHUB_COMPANY = {
  name: "MHMJ Desenvolvimento e Consultoria em Informática Ltda.",
  cnpj: "45.160.928/0001-71",
  address: "Rua Bela Cintra, 746, Conjunto 142, Consolação, São Paulo/SP, CEP 01415-902",
  supportEmail: "contato@gestarahub.com.br",
} as const;

export const EMAIL_ICON_VERSION = "6";
export const EMAIL_ICON_CONTENT_ID = "gestarahub-icon";

export interface EmailCompanyInfo {
  name: string;
  cnpj: string;
  address: string;
}

export interface EmailIconState {
  hasInlineIcon?: boolean;
  hostedIconUrl?: string | null;
}

export type OpsAlertTone = "danger" | "warning" | "info" | "neutral";

const TONE_PALETTE: Record<OpsAlertTone, { strip: string; bg: string; border: string; text: string }> = {
  danger: { strip: "#dc2626", bg: "#fef2f2", border: "#fecaca", text: "#b91c1c" },
  warning: { strip: "#d97706", bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  info: { strip: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  neutral: { strip: "#64748b", bg: "#f1f5f9", border: "#cbd5e1", text: "#334155" },
};

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO_STACK = "'SFMono-Regular',Menlo,Consolas,monospace";
const BRAND_GRADIENT = "linear-gradient(90deg,#f38020 0%,#25b4b8 50%,#8a1b9e 100%)";

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Converte quebras de linha em `<br />` depois de escapar HTML. */
export function formatEmailParagraphsHtml(text: string): string {
  return escapeEmailHtml(text).replace(/\r?\n/g, "<br />");
}

/**
 * URL publica do icone (`https://.../email-icon.png?v=6`) quando o app esta
 * num dominio real; em localhost ou tuneis retorna `null` para anexar inline (cid).
 */
export function hostedEmailAssetUrl(
  siteUrl: string | undefined | null,
  file = "email-icon.png",
  version: string = EMAIL_ICON_VERSION,
): string | null {
  if (!siteUrl) return null;
  let url: URL;
  try {
    url = new URL(siteUrl);
  } catch {
    return null;
  }
  const host = url.hostname;
  const local =
    host === "localhost" ||
    host.startsWith("127.") ||
    host.endsWith(".localhost") ||
    host.endsWith(".test") ||
    /trycloudflare\.com$|ngrok|loca\.lt$/.test(host);
  if (url.protocol !== "https:" || local) return null;
  return `${url.origin}/${file}?v=${version}`;
}

/** Renderiza o icone do GestaraHub via `cid:`, URL publica ou monograma HTML. */
export function renderBrandIconHtml({
  icon,
  size = 36,
}: {
  icon?: EmailIconState;
  size?: number;
} = {}): string {
  const radius = Math.max(6, Math.round(size / 4));
  if (icon?.hasInlineIcon) {
    return `<img src="cid:${EMAIL_ICON_CONTENT_ID}" width="${size}" height="${size}" alt="GestaraHub" style="display:block;border:0;border-radius:${radius}px;" />`;
  }
  if (icon?.hostedIconUrl) {
    return `<img src="${escapeEmailHtml(icon.hostedIconUrl)}" width="${size}" height="${size}" alt="GestaraHub" style="display:block;border:0;border-radius:${radius}px;" />`;
  }
  const fontSize = Math.max(12, Math.round(size * 0.47));
  return `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:#2563eb;color:#ffffff;font-weight:800;font-size:${fontSize}px;line-height:${size}px;text-align:center;">G</div>`;
}

/** Botao principal de acao nos e-mails (ja escapa label e href). */
export function renderEmailButtonHtml(
  href: string,
  label: string,
  variant: "primary" | "dark" = "primary",
): string {
  const bg = variant === "dark" ? "#0f172a" : "#2563eb";
  const padding = variant === "dark" ? "11px 20px" : "14px 30px";
  const fontSize = variant === "dark" ? "14px" : "15px";
  const marginBottom = variant === "dark" ? "16px" : "24px";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 ${marginBottom} 0;">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:${bg};">
                    <a href="${escapeEmailHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:${padding};font-size:${fontSize};font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                      ${escapeEmailHtml(label)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>`;
}

/** Aviso em destaque (amarelo claro). Aceita HTML controlado pelo chamador. */
export function renderEmailNoticeHtml(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 16px;font-size:13px;line-height:1.5;color:#92400e;">${html}</td>
                </tr>
              </table>`;
}

/** Bloco "Se o botao nao abrir" com a URL por extenso. */
export function renderEmailFallbackLinkHtml(url: string): string {
  const safeUrl = escapeEmailHtml(url);
  return `<hr style="border:0;border-top:1px solid #e2e8f0;margin:0 0 16px 0;" />
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                Se o botão não abrir, copie e cole este endereço no navegador:<br />
                <a href="${safeUrl}" style="color:#2563eb;word-break:break-all;text-decoration:underline;">${safeUrl}</a>
              </p>`;
}

/**
 * Familia 1: moldura principal da marca (conta, convite, senha, 2FA, boas-vindas, ingresso).
 * Recebe `title`, `preheader`, `heading`, `intro`, `body` e `footer` ja escapados.
 */
export function renderBrandEmailLayout({
  title,
  preheader,
  badge,
  heading,
  intro,
  body,
  footer,
  supportEmail,
  icon,
  company = GESTARAHUB_COMPANY,
}: {
  title: string;
  preheader: string;
  badge?: string;
  heading: string;
  intro: string;
  body: string;
  footer: string;
  supportEmail?: string;
  icon?: EmailIconState;
  company?: EmailCompanyInfo;
}): string {
  const iconMarkup = renderBrandIconHtml({ icon, size: 36 });
  const safeSupport = supportEmail ? escapeEmailHtml(supportEmail) : null;
  const badgeMarkup = badge
    ? `<div style="display:inline-block;padding:4px 10px;margin-bottom:14px;border:1px solid #334155;border-radius:20px;background-color:#1e293b;font-size:12px;font-weight:700;color:#93c5fd;">${badge}</div>`
    : "";
  const supportBlock = safeSupport
    ? `<tr>
            <td style="padding:0 36px 28px 36px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">
                <strong style="color:#0f172a;">Dúvidas?</strong> Escreva para
                <a href="mailto:${safeSupport}" style="color:#2563eb;text-decoration:underline;">${safeSupport}</a>. A gente ajuda.
              </p>
            </td>
          </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:${FONT_STACK};color:#0f172a;-webkit-font-smoothing:antialiased;">
  <!-- Pre-visualizacao na caixa de entrada -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
          <tr>
            <td style="height:5px;background:${BRAND_GRADIENT};font-size:0;line-height:0;">&nbsp;</td>
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

          ${supportBlock}

          <!-- Rodape -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;font-size:12px;line-height:1.6;color:#94a3b8;">
              ${footer}
              <p style="margin:12px 0 0 0;color:#94a3b8;">${escapeEmailHtml(company.name)} · CNPJ ${escapeEmailHtml(company.cnpj)}<br />${escapeEmailHtml(company.address)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Familia 2: atendimento ao cliente (conversa de suporte).
 * Cabecalho branco enxuto com protocolo e foco total na resposta humana.
 */
export function renderSupportConversationEmail({
  firstName,
  protocol,
  threadSubject,
  replyBody,
  appUrl,
  icon,
  company = GESTARAHUB_COMPANY,
}: {
  firstName: string;
  protocol: string;
  threadSubject: string;
  replyBody: string;
  appUrl: string;
  icon?: EmailIconState;
  company?: EmailCompanyInfo;
}): string {
  const iconMarkup = renderBrandIconHtml({ icon, size: 28 });
  const safeProtocol = escapeEmailHtml(protocol);
  const safeSubject = escapeEmailHtml(threadSubject);
  const safeFirstName = escapeEmailHtml(firstName);
  const previewSnippet = escapeEmailHtml(replyBody.trim().replace(/\s+/g, " ").slice(0, 140));

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resposta do suporte (${safeProtocol})</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:${FONT_STACK};color:#0f172a;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safeProtocol} · ${previewSnippet}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.04);">
          <tr>
            <td style="height:4px;background:${BRAND_GRADIENT};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Cabecalho limpo de conversa -->
          <tr>
            <td style="padding:22px 32px 18px 32px;border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">${iconMarkup}</td>
                        <td style="vertical-align:middle;">
                          <span style="font-size:16px;letter-spacing:-0.02em;color:#0f172a;"><span style="font-weight:400;">Gestara</span><span style="font-weight:800;">Hub</span></span>
                          <span style="font-size:13px;color:#64748b;"> · Atendimento</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:#f1f5f9;border:1px solid #cbd5e1;font-family:${MONO_STACK};font-size:12px;font-weight:700;color:#334155;">${safeProtocol}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Resposta -->
          <tr>
            <td style="padding:28px 32px 28px 32px;">
              <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Resposta ao seu chamado</p>
              <h1 style="margin:0 0 18px 0;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;line-height:1.3;">${safeSubject}</h1>

              <p style="margin:0 0 10px 0;font-size:15px;line-height:1.6;color:#334155;">Olá, <strong style="color:#0f172a;">${safeFirstName}</strong>!</p>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">Nossa equipe respondeu à sua mensagem:</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #2563eb;border-radius:10px;margin:0 0 24px 0;">
                <tr>
                  <td style="padding:18px 20px;font-size:15px;line-height:1.65;color:#0f172a;">${formatEmailParagraphsHtml(replyBody)}</td>
                </tr>
              </table>

              ${renderEmailButtonHtml(appUrl, "Abrir GestaraHub")}

              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                Para continuar a conversa, abra o GestaraHub e acesse <strong>Fale com a gente</strong> no menu do seu usuário.
              </p>
            </td>
          </tr>

          <!-- Rodape -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px;font-size:12px;line-height:1.6;color:#94a3b8;">
              Atendimento GestaraHub · Protocolo ${safeProtocol}
              <p style="margin:8px 0 0 0;color:#94a3b8;">${escapeEmailHtml(company.name)} · CNPJ ${escapeEmailHtml(company.cnpj)}<br />${escapeEmailHtml(company.address)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface OpsAlertMetaItem {
  label: string;
  value: string;
  mono?: boolean;
}

export interface OpsAlertListItem {
  badge?: { text: string; tone?: OpsAlertTone };
  title: string;
  meta?: string;
  detail?: string;
}

/**
 * Familia 3: notificacoes e alertas operacionais internos (suporte, fila e erros).
 * Card compacto com faixa de severidade, tabela de contexto, itens escaneaveis e CTA.
 */
export function renderOpsAlertEmail({
  tone = "info",
  sectionLabel,
  badge,
  title,
  subtitle,
  meta,
  quote,
  items,
  overflowNote,
  action,
  note,
  footer = "GestaraHub · Notificação interna",
  icon,
}: {
  tone?: OpsAlertTone;
  sectionLabel: string;
  badge: string;
  title: string;
  subtitle?: string;
  meta?: ReadonlyArray<OpsAlertMetaItem>;
  quote?: { label?: string; text: string };
  items?: ReadonlyArray<OpsAlertListItem>;
  overflowNote?: string;
  action?: { label: string; href: string };
  note?: string;
  footer?: string;
  icon?: EmailIconState;
}): string {
  const palette = TONE_PALETTE[tone];
  const iconMarkup = renderBrandIconHtml({ icon, size: 24 });
  const safeTitle = escapeEmailHtml(title);
  const safeSubtitle = subtitle ? escapeEmailHtml(subtitle) : "";
  const safeBadge = escapeEmailHtml(badge);

  const metaMarkup =
    meta && meta.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 18px 0;">
                <tr>
                  <td style="padding:10px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${meta
                        .map((row, index) => {
                          const border = index < meta.length - 1 ? "border-bottom:1px solid #e2e8f0;" : "";
                          const font = row.mono ? `font-family:${MONO_STACK};` : "";
                          return `<tr>
                            <td style="padding:7px 12px 7px 0;${border}font-size:12px;font-weight:600;color:#64748b;width:118px;vertical-align:top;">${escapeEmailHtml(row.label)}</td>
                            <td style="padding:7px 0;${border}font-size:13px;font-weight:600;color:#0f172a;${font}word-break:break-word;">${escapeEmailHtml(row.value)}</td>
                          </tr>`;
                        })
                        .join("")}
                    </table>
                  </td>
                </tr>
              </table>`
      : "";

  const quoteMarkup = quote
    ? `${quote.label ? `<p style="margin:0 0 6px 0;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">${escapeEmailHtml(quote.label)}</p>` : ""}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-left:3px solid ${palette.strip};border-radius:10px;margin:0 0 18px 0;">
                <tr>
                  <td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#1e293b;">${formatEmailParagraphsHtml(quote.text)}</td>
                </tr>
              </table>`
    : "";

  const itemsMarkup =
    items && items.length > 0
      ? `<div style="margin:0 0 ${overflowNote ? "12px" : "18px"} 0;">
                ${items
                  .map((item) => {
                    const itemPalette = TONE_PALETTE[item.badge?.tone ?? "neutral"];
                    const pill = item.badge
                      ? `<span style="display:inline-block;padding:2px 8px;margin-right:6px;border-radius:999px;background-color:${itemPalette.bg};border:1px solid ${itemPalette.border};font-size:11px;font-weight:700;color:${itemPalette.text};vertical-align:middle;">${escapeEmailHtml(item.badge.text)}</span>`
                      : "";
                    const metaLine = item.meta
                      ? `<p style="margin:5px 0 0 0;font-size:12px;line-height:1.5;color:#64748b;font-family:${MONO_STACK};word-break:break-word;">${escapeEmailHtml(item.meta)}</p>`
                      : "";
                    const detailLine = item.detail
                      ? `<p style="margin:6px 0 0 0;font-size:13px;line-height:1.5;color:#334155;word-break:break-word;">${escapeEmailHtml(item.detail)}</p>`
                      : "";
                    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 10px 0;">
                      <tr>
                        <td style="padding:12px 14px;">
                          <div style="font-size:14px;font-weight:700;color:#0f172a;line-height:1.4;">${pill}<span style="vertical-align:middle;">${escapeEmailHtml(item.title)}</span></div>
                          ${metaLine}
                          ${detailLine}
                        </td>
                      </tr>
                    </table>`;
                  })
                  .join("")}
              </div>`
      : "";

  const overflowMarkup = overflowNote
    ? `<p style="margin:0 0 18px 0;font-size:13px;font-weight:600;color:#64748b;">${escapeEmailHtml(overflowNote)}</p>`
    : "";

  const actionMarkup = action ? renderEmailButtonHtml(action.href, action.label, "dark") : "";
  const noteMarkup = note ? `<p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;">${escapeEmailHtml(note)}</p>` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:${FONT_STACK};color:#0f172a;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safeTitle}${safeSubtitle ? ` · ${safeSubtitle}` : ""}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,0.04);">
          <tr>
            <td style="height:4px;background-color:${palette.strip};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Cabecalho operacional compacto -->
          <tr>
            <td style="padding:20px 28px 16px 28px;border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:8px;">${iconMarkup}</td>
                        <td style="vertical-align:middle;">
                          <span style="font-size:14px;font-weight:700;color:#0f172a;">GestaraHub</span>
                          <span style="font-size:12px;color:#64748b;"> · ${escapeEmailHtml(sectionLabel)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:${palette.bg};border:1px solid ${palette.border};font-size:11px;font-weight:700;color:${palette.text};">${safeBadge}</span>
                  </td>
                </tr>
              </table>

              <h1 style="margin:14px 0 4px 0;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;line-height:1.3;">${safeTitle}</h1>
              ${safeSubtitle ? `<p style="margin:0;font-size:14px;line-height:1.5;color:#475569;">${safeSubtitle}</p>` : ""}
            </td>
          </tr>

          <!-- Conteudo -->
          <tr>
            <td style="padding:22px 28px 24px 28px;">
              ${metaMarkup}
              ${quoteMarkup}
              ${itemsMarkup}
              ${overflowMarkup}
              ${actionMarkup}
              ${noteMarkup}
            </td>
          </tr>

          <!-- Rodape -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;font-size:12px;line-height:1.5;color:#94a3b8;">
              ${escapeEmailHtml(footer)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
