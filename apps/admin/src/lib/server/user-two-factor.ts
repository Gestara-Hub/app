import "server-only";
import {
  escapeEmailHtml,
  GESTARAHUB_COMPANY,
  renderBrandEmailLayout,
  renderEmailNoticeHtml,
} from "@gestarahub/core/email-layouts";
import { clearEmailTwoFactor, resetFactors } from "./auth-admin";
import { sendEmail } from "./email";
import { sql } from "./db";
import { requestInfo } from "./request";

/**
 * Reiniciar a verificacao em duas etapas de um usuario de espaco (doc
 * technical/17 e 26): quando a pessoa perde o aplicativo e nao guardou os
 * codigos de recuperacao. O painel nao le `public.users` nem a autenticacao:
 * usa duas funcoes do banco (listar a equipe do espaco e fechar o reinicio com
 * registro) e a API de administracao do Auth so para remover o app e desligar o
 * e-mail. A pessoa recebe um aviso por e-mail.
 */
export class UserTwoFactorError extends Error {}

export interface SpaceUser {
  userId: string;
  authUserId: string | null;
  name: string;
  email: string;
  profile: string;
  status: string;
  app: boolean;
  email2fa: boolean;
  recoveryLeft: number;
}

export async function listSpaceUsers(organizationId: string): Promise<SpaceUser[]> {
  const rows = await sql()<
    { user_id: string; auth_user_id: string | null; name: string; email: string; profile: string; status: string; two_factor_app: boolean; two_factor_email: boolean; recovery_codes_left: number }[]
  >`select * from platform.list_space_users(${organizationId})`;
  return rows.map((r) => ({
    userId: r.user_id,
    authUserId: r.auth_user_id,
    name: r.name,
    email: r.email,
    profile: r.profile,
    status: r.status,
    app: r.two_factor_app,
    email2fa: r.two_factor_email,
    recoveryLeft: r.recovery_codes_left,
  }));
}

export async function resetUserTwoFactor(input: { organizationId: string; userId: string; reason: string; admin: { id: string; name: string } }): Promise<{ name: string; emailed: boolean }> {
  const user = (await listSpaceUsers(input.organizationId)).find((u) => u.userId === input.userId);
  if (!user) throw new UserTwoFactorError("Pessoa não encontrada neste espaço.");
  if (!user.authUserId) throw new UserTwoFactorError("Esta pessoa ainda não tem login (convite não aceito).");
  if (!user.app && !user.email2fa) throw new UserTwoFactorError("Esta pessoa não usa a verificação em duas etapas.");

  // Primeiro o Auth (o que tranca a pessoa), depois a limpeza e o registro no banco.
  await resetFactors(user.authUserId);
  await clearEmailTwoFactor(user.authUserId);
  const { ip, userAgent } = await requestInfo();
  try {
    await sql()`select platform.finish_user_two_factor_reset(${input.organizationId}, ${input.userId}, ${input.reason}, ${input.admin.id}, ${input.admin.name}, ${ip}, ${userAgent})`;
  } catch (error) {
    const pg = error as { code?: string; message?: string };
    if (pg.code === "22023" || pg.code === "P0002") throw new UserTwoFactorError(pg.message ?? "Não foi possível concluir.");
    throw error;
  }
  const firstName = user.name.split(" ")[0] || user.name;
  const safeFirstName = escapeEmailHtml(firstName);
  const emailed = await sendEmail({
    to: { email: user.email, name: user.name },
    subject: "A verificação em duas etapas da sua conta foi reiniciada",
    html: (icon) =>
      renderBrandEmailLayout({
        title: "A verificação em duas etapas da sua conta foi reiniciada",
        preheader: "Sua verificação em duas etapas foi reiniciada a pedido seu.",
        badge: "Segurança da conta",
        heading: `Verificação em duas etapas reiniciada, ${safeFirstName}`,
        intro: "A equipe do GestaraHub reiniciou a verificação em duas etapas da sua conta, a pedido seu.",
        body: `<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                No próximo acesso você entra apenas com a senha. Depois, ligue a verificação de novo em <strong>Segurança</strong>, no menu do seu usuário, e guarde os novos códigos de recuperação.
              </p>
              ${renderEmailNoticeHtml("<strong>Não foi você?</strong> Responda este e-mail ou use o <strong>Fale com a gente</strong> e troque sua senha agora.")}`,
        footer: `Este aviso confirma uma alteração de segurança solicitada ao suporte.<br />
                <span style="color:#64748b;">GestaraHub · E-mail automático.</span>`,
        supportEmail: GESTARAHUB_COMPANY.supportEmail,
        icon,
      }),
    text: [
      `Olá, ${firstName}!`,
      "",
      "A equipe do GestaraHub reiniciou a verificação em duas etapas da sua conta, a pedido seu.",
      "No próximo acesso você entra só com a senha. Depois, ligue a verificação de novo em Segurança, no menu do seu usuário, e guarde os novos códigos de recuperação.",
      "",
      "Se você não pediu isso, responda este e-mail ou use o Fale com a gente e troque sua senha agora.",
    ].join("\n"),
  });
  return { name: user.name, emailed };
}
