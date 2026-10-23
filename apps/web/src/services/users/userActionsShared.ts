import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { can, canManageProfile } from "@/lib/permissions";
import { requireTenant } from "../server/tenant";
import type { UserProfile } from "@gestarahub/contracts";

/**
 * Apoio das acoes de usuarios (so servidor): guarda de permissao, hash do token do convite e endereco do app.
 */

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Quem chama precisa estar logado no mesmo espaco (doc 15, fatia 3). Antes
 * estas actions usavam a chave de servico com o espaco vindo do navegador, sem
 * conferir sessao: qualquer um criava ou inativava usuario em qualquer espaco.
 * Gravar pede `users:manage` e so mexe nos perfis que o usuario administra
 * (dono: todos; gerente: atendente e profissional); a pessoa pode mudar o
 * proprio nome e e-mail.
 */
export async function guard(
  organizationId: string,
  opts: { manage?: boolean; targetProfile?: UserProfile; targetUserId?: string } = {},
): Promise<string | null> {
  let ctx;
  try {
    ctx = await requireTenant();
  } catch {
    return "Sua sessão expirou. Entre de novo.";
  }
  if (ctx.organizationId !== organizationId) return "Você não tem permissão para esta ação.";
  if (!opts.manage) return null;
  if (opts.targetUserId && opts.targetUserId === ctx.userId && !opts.targetProfile) return null;
  if (!can(ctx.profile, "users:manage")) return "Você não tem permissão para esta ação.";
  if (opts.targetProfile && !canManageProfile(ctx.profile, opts.targetProfile)) {
    return "Você não tem permissão para gerenciar este perfil.";
  }
  if (opts.targetUserId) {
    const { data } = await createSupabaseAdminClient()
      .from("users")
      .select("profile")
      .eq("id", opts.targetUserId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (data && !canManageProfile(ctx.profile, data.profile as UserProfile) && opts.targetUserId !== ctx.userId) {
      return "Você não tem permissão para gerenciar este perfil.";
    }
  }
  return null;
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function resolveAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  const hdrs = await headers();
  const host =
    hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto =
    hdrs.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
