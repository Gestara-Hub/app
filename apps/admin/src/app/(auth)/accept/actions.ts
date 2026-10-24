"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { recordAudit } from "@/lib/server/audit";
import { sql } from "@/lib/server/db";
import { getEnv } from "@/lib/server/env";
import { allow } from "@/lib/server/rate-limit";
import { requestInfo } from "@/lib/server/request";
import { createAuthClient } from "@/lib/server/supabase";
import { SESSION_MAX_AGE_SECONDS, SESSION_STARTED_COOKIE, signSessionStart } from "@/lib/session-token";

const EXPIRED = "Este convite venceu ou já foi usado. Peça um novo convite a quem convidou você.";

const schema = z
  .object({
    token: z.string().min(10).max(500),
    password: z.string().min(12, "A senha precisa ter 12 ou mais caracteres.").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

/**
 * Aceita o convite: troca o codigo do link (uso unico) por uma sessao, so para
 * quem esta "convidado" em `platform.admins`; define a senha, ativa a conta e
 * segue para o segundo fator. O codigo e conferido so aqui, no envio da senha
 * (nao ao abrir a pagina), para que programas de e-mail que "abrem" links nao
 * gastem o convite.
 */
export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse({ token: formData.get("token"), password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };

  const { ip } = await requestInfo();
  if (!(await allow(`accept:${ip}`, 10, 60))) return { error: "Muitas tentativas. Aguarde 1 minuto antes de tentar de novo." };

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: parsed.data.token, type: "recovery" });
  const user = data?.user;
  if (error || !user) return { error: EXPIRED };

  const [row] = await sql()<{ id: string; name: string }[]>`
    select id, name from platform.admins where auth_user_id = ${user.id} and status = 'invited'`;
  if (user.app_metadata?.platform !== true || !row) {
    // Qualquer outra conta nao usa este caminho (nem como "esqueci a senha").
    await supabase.auth.signOut();
    return { error: EXPIRED };
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (passwordError) {
    await supabase.auth.signOut();
    return { error: "Não foi possível criar a senha. Use uma senha mais forte e peça um novo convite." };
  }

  await sql()`update platform.admins set status = 'active', updated_at = now() where id = ${row.id}`;
  await recordAudit({ admin: { id: row.id, name: row.name }, action: "admin.invite_accepted" });
  (await cookies()).set(SESSION_STARTED_COOKIE, signSessionStart(getEnv().ADMIN_SESSION_SECRET, user.id, Date.now()), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect("/mfa");
}
