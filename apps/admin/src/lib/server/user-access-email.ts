import "server-only";
import { createHash, randomBytes } from "node:crypto";
import {
  escapeEmailHtml,
  GESTARAHUB_COMPANY,
  renderBrandEmailLayout,
  renderEmailButtonHtml,
  renderEmailFallbackLinkHtml,
  renderEmailNoticeHtml,
} from "@gestarahub/core/email-layouts";
import { sendEmail } from "./email";
import { sql } from "./db";
import { getEnv } from "./env";
import { requestInfo } from "./request";

/**
 * Trocar o e-mail de acesso de uma pessoa do espaco (05/11/2026, doc
 * technical/17): para quem perdeu o acesso ao e-mail (ex.: perdeu o Gmail) e
 * nao consegue trocar sozinha. O proprietario do GestaraHub confirma quem e a
 * pessoa por fora do sistema antes. Uma funcao do banco faz tudo de uma vez
 * (`platform.change_user_access_email`, migracao 88): troca o e-mail, tira o
 * login do Google antigo, encerra as sessoes, grava o link de criar senha (so o
 * hash) e registra nas duas auditorias. O e-mail novo recebe o link (24 horas)
 * e o antigo recebe um aviso.
 */
export class UserAccessEmailError extends Error {}

const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "";
  return `${local.length > 2 ? local.slice(0, 2) : local.slice(0, 1)}***@${domain}`;
};

export async function changeUserAccessEmail(input: {
  organizationId: string;
  userId: string;
  newEmail: string;
  reason: string;
  admin: { id: string; name: string };
}): Promise<{ name: string; emailed: boolean }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { ip, userAgent } = await requestInfo();
  let row: { name: string; old_email: string; new_email: string } | undefined;
  try {
    [row] = await sql()<{ name: string; old_email: string; new_email: string }[]>`
      select * from platform.change_user_access_email(${input.organizationId}, ${input.userId}, ${input.newEmail},
        ${input.reason}, ${tokenHash}, ${input.admin.id}, ${input.admin.name}, ${ip}, ${userAgent})`;
  } catch (error) {
    const pg = error as { code?: string; message?: string };
    if (pg.code === "22023" || pg.code === "P0002" || pg.code === "23505") {
      throw new UserAccessEmailError(pg.message ?? "Não foi possível concluir.");
    }
    throw error;
  }
  if (!row) throw new UserAccessEmailError("Não foi possível concluir.");

  const firstName = row.name.split(" ")[0] || row.name;
  const safeFirstName = escapeEmailHtml(firstName);
  const maskedNewEmail = maskEmail(row.new_email);
  const link = `${getEnv().WEB_APP_URL.replace(/\/+$/, "")}/reset-password?token=${token}`;
  const emailed = await sendEmail({
    to: { email: row.new_email, name: row.name },
    subject: "Crie sua senha para entrar no GestaraHub",
    html: (icon) =>
      renderBrandEmailLayout({
        title: "Crie sua senha para entrar no GestaraHub",
        preheader: "Seu e-mail de acesso foi atualizado pela equipe. Crie uma senha para entrar.",
        badge: "Segurança da conta",
        heading: `Crie sua senha, ${safeFirstName}`,
        intro: "A equipe do GestaraHub trocou o e-mail de acesso da sua conta para este endereço, a pedido seu.",
        body: `<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Clique no botão abaixo para definir sua senha. Depois, entre usando este novo e-mail.
              </p>
              ${renderEmailButtonHtml(link, "Criar minha senha")}
              ${renderEmailNoticeHtml("<strong>&#9201; Este link vale por 24 horas</strong> e só pode ser usado uma vez.")}
              ${renderEmailFallbackLinkHtml(link)}`,
        footer: `Este e-mail foi enviado após alteração solicitada ao suporte do GestaraHub.<br />
                <span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
        supportEmail: GESTARAHUB_COMPANY.supportEmail,
        icon,
      }),
    text: [
      `Olá, ${firstName}!`,
      "",
      "A equipe do GestaraHub trocou o e-mail de acesso da sua conta para este, a pedido seu.",
      "Crie sua senha pelo link abaixo (vale por 24 horas e só uma vez):",
      "",
      link,
      "",
      "Depois, entre com este e-mail e a senha nova.",
    ].join("\n"),
  });
  await sendEmail({
    to: { email: row.old_email, name: row.name },
    subject: "O e-mail de acesso da sua conta no GestaraHub mudou",
    html: (icon) =>
      renderBrandEmailLayout({
        title: "O e-mail de acesso da sua conta no GestaraHub mudou",
        preheader: "O e-mail de acesso da sua conta no GestaraHub mudou.",
        badge: "Segurança da conta",
        heading: `Seu e-mail de acesso mudou, ${safeFirstName}`,
        intro: `A equipe do GestaraHub trocou o e-mail de acesso da sua conta para <strong>${escapeEmailHtml(maskedNewEmail)}</strong>, a pedido seu.`,
        body: renderEmailNoticeHtml(
          `<strong>Não foi você?</strong> Responda este e-mail ou use o <strong>Fale com a gente</strong> agora mesmo.`,
        ),
        footer: `Este aviso vai para o e-mail antigo por segurança.<br />
                <span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
        supportEmail: GESTARAHUB_COMPANY.supportEmail,
        icon,
      }),
    text: [
      `Olá, ${firstName}!`,
      "",
      `A equipe do GestaraHub trocou o e-mail de acesso da sua conta para ${maskedNewEmail}, a pedido seu.`,
      "",
      "Se você não pediu isso, responda este e-mail ou use o Fale com a gente agora mesmo.",
    ].join("\n"),
  });
  return { name: row.name, emailed };
}
