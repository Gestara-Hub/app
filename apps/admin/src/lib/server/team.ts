import "server-only";
import {
  escapeEmailHtml,
  renderBrandEmailLayout,
  renderEmailButtonHtml,
  renderEmailFallbackLinkHtml,
  renderEmailNoticeHtml,
} from "@gestarahub/core/email-layouts";
import { isAdminRole, type AdminRole } from "../permissions";
import { createLogin, deleteLogin, inviteLink, resetFactors } from "./auth-admin";
import { sendEmail } from "./email";
import { sql } from "./db";

/**
 * Equipe do painel (doc technical/26, fase 6): convidar, mudar papel,
 * desativar/reativar e reiniciar o 2FA. Quem manda e `platform_owner`; as
 * trancas (nao mexer em si, nunca ficar sem proprietario ativo) valem aqui e
 * nao dependem da tela.
 */
export class TeamError extends Error {}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "active" | "invited" | "disabled";
  lastLoginAt: Date | null;
  invitedByName: string | null;
}

export async function listTeam(): Promise<TeamMember[]> {
  const rows = await sql()<
    { id: string; name: string; email: string; role: string; status: TeamMember["status"]; last_login_at: Date | null; invited_by_name: string | null }[]
  >`
    select a.id, a.name, a.email, a.role, a.status, a.last_login_at, i.name as invited_by_name
      from platform.admins a left join platform.admins i on i.id = a.invited_by
     order by a.created_at`;
  return rows
    .filter((r) => isAdminRole(r.role))
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role as AdminRole,
      status: r.status,
      lastLoginAt: r.last_login_at,
      invitedByName: r.invited_by_name,
    }));
}

async function member(id: string) {
  const [row] = await sql()<{ id: string; auth_user_id: string; name: string; email: string; role: string; status: string }[]>`
    select id, auth_user_id, name, email, role, status from platform.admins where id = ${id}`;
  if (!row) throw new TeamError("Administrador não encontrado.");
  return row;
}

async function activeOwnersExcept(id: string): Promise<number> {
  const [row] = await sql()<{ n: number }[]>`
    select count(*)::int as n from platform.admins where role = 'platform_owner' and status = 'active' and id <> ${id}`;
  return row.n;
}

async function sendInvite(input: { email: string; name: string; inviterName: string }): Promise<{ emailed: boolean; link: string }> {
  const link = await inviteLink(input.email);
  const firstName = input.name.split(" ")[0] || input.name;
  const safeFirstName = escapeEmailHtml(firstName);
  const safeInviter = escapeEmailHtml(input.inviterName);
  const emailed = await sendEmail({
    to: { email: input.email, name: input.name },
    subject: "Convite para o painel do GestaraHub",
    html: (icon) =>
      renderBrandEmailLayout({
        title: "Convite para o painel do GestaraHub",
        preheader: `${safeInviter} convidou você para o painel de administração do GestaraHub.`,
        badge: "Painel de administração",
        heading: `Você recebeu um convite, ${safeFirstName}!`,
        intro: `<strong style="color:#ffffff;">${safeInviter}</strong> convidou você para o painel de administração do GestaraHub.`,
        body: `<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Abra o link abaixo para criar sua senha e configurar o aplicativo autenticador de acesso.
              </p>
              ${renderEmailButtonHtml(link, "Aceitar convite e criar senha")}
              ${renderEmailNoticeHtml("<strong>&#9201; Atenção:</strong> este link vale por pouco tempo e só funciona uma vez.")}
              ${renderEmailFallbackLinkHtml(link)}`,
        footer: "Se você não esperava este convite, ignore esta mensagem com segurança.",
        icon,
      }),
    text: [
      `Olá, ${firstName}!`,
      "",
      `${input.inviterName} convidou você para o painel de administração do GestaraHub.`,
      "Abra o link abaixo, crie sua senha e configure o aplicativo autenticador. O link vale por pouco tempo e só funciona uma vez.",
      "",
      link,
      "",
      "Se você não esperava este convite, ignore esta mensagem.",
    ].join("\n"),
  });
  return { emailed, link };
}

/** Convida: cria o login, a linha "convidado" e manda o link. Sem e-mail configurado, devolve o link para quem convida repassar. */
export async function inviteAdmin(input: { name: string; email: string; role: AdminRole; inviter: { id: string; name: string } }) {
  const email = input.email.trim().toLowerCase();
  const [taken] = await sql()<{ taken: boolean }[]>`select exists(select 1 from platform.admins where lower(email) = ${email}) as taken`;
  if (taken.taken) throw new TeamError("Já existe um administrador com este e-mail.");
  const authUserId = await createLogin({ email, name: input.name });
  try {
    const [row] = await sql()<{ id: string }[]>`
      insert into platform.admins (auth_user_id, name, email, role, status, invited_by)
      values (${authUserId}, ${input.name}, ${email}, ${input.role}, 'invited', ${input.inviter.id}) returning id`;
    const sent = await sendInvite({ email, name: input.name, inviterName: input.inviter.name });
    return { id: row.id, ...sent };
  } catch (error) {
    // Sem a linha do painel o login nao serve: desfaz.
    await deleteLogin(authUserId).catch(() => undefined);
    const pg = error as { code?: string; message?: string };
    // 23505: e-mail ja e de usuario de espaco (gatilho do banco).
    if (pg.code === "23505") throw new TeamError(pg.message ?? "Este e-mail já está em uso.");
    throw error;
  }
}

export async function resendInvite(id: string, inviterName: string) {
  const row = await member(id);
  if (row.status !== "invited") throw new TeamError("Só quem ainda não aceitou recebe o convite de novo.");
  return sendInvite({ email: row.email, name: row.name, inviterName });
}

export async function changeRole(id: string, role: AdminRole, actorId: string) {
  const row = await member(id);
  if (row.id === actorId) throw new TeamError("Você não pode mudar o seu próprio papel.");
  if (row.role === role) return { before: row.role };
  if (row.role === "platform_owner" && row.status === "active" && (await activeOwnersExcept(id)) === 0) {
    throw new TeamError("O painel precisa de ao menos um proprietário ativo.");
  }
  await sql()`update platform.admins set role = ${role}, updated_at = now() where id = ${id}`;
  return { before: row.role };
}

export async function setActive(id: string, active: boolean, actorId: string) {
  const row = await member(id);
  if (row.id === actorId) throw new TeamError("Você não pode desativar o seu próprio acesso.");
  if (!active && row.role === "platform_owner" && row.status === "active" && (await activeOwnersExcept(id)) === 0) {
    throw new TeamError("O painel precisa de ao menos um proprietário ativo.");
  }
  if (active && row.status === "invited") throw new TeamError("Esta pessoa ainda não aceitou o convite.");
  await sql()`update platform.admins set status = ${active ? "active" : "disabled"}, updated_at = now() where id = ${id}`;
  return row;
}

export async function resetMfa(id: string, actorId: string) {
  const row = await member(id);
  if (row.id === actorId) throw new TeamError("Para o seu próprio acesso, peça a outro proprietário.");
  const removed = await resetFactors(row.auth_user_id);
  return { row, removed };
}
