"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import type {
  Category,
  Organization,
  Unit,
  UserProfile,
  UserView,
} from "@gestarahub/contracts";
import { DEMO_USERS, isDemoOrganization } from "@/lib/demo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendSignupLinkEmail } from "@/lib/email/mailersend";
import { checkRateLimit, getClientIp, resetRateLimit } from "@/lib/security/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  encodeSession,
  safeRedirectPath,
} from "@/lib/session";
import { canAccessRoute, firstAllowedRoute } from "@/components/layout/nav";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { createOwnerAccount, loadSessionPayload } from "@/services/server/accountSetup";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function resolveAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function setSessionCookie(user: UserView): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export type RequestSignupLinkResult =
  | { status: "sent"; email: string }
  | {
      status: "pending_link_exists";
      email: string;
      name: string;
      expiresAt: string;
    }
  | { status: "account_exists"; email: string }
  | { status: "error"; message: string };

/**
 * Solicita o envio do link de cadastro (validade de 24h) pela Landing Page ou
 * pela tela de login quando o link anterior expirou.
 *
 * - Se ja existe usuario ativo com senha criada -> `account_exists`
 * - Se ja existe link `pending` nao expirado e `!forceResend` -> `pending_link_exists` (abre a modal)
 * - Se `forceResend === true` ou nao ha link ativo -> revoga links anteriores na hora,
 *   cria novo token de 24h e envia por e-mail via MailerSend.
 */
export async function requestSignupLink(input: {
  name: string;
  email: string;
  forceResend?: boolean;
}): Promise<RequestSignupLinkResult> {
  const trimmedName = input.name.trim();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (!trimmedName || !normalizedEmail) {
    return { status: "error", message: "Informe seu nome e um e-mail válido." };
  }

  const clientIp = await getClientIp();
  const allowedIp = await checkRateLimit({
    key: `signup_ip:${clientIp}`,
    maxRequests: 5,
    windowSeconds: 600, // 10 minutes
  });
  if (!allowedIp) {
    return {
      status: "error",
      message: "Muitas tentativas a partir desta conexão. Por favor, aguarde alguns minutos.",
    };
  }

  const allowedEmail = await checkRateLimit({
    key: `signup_email:${normalizedEmail}`,
    maxRequests: 3,
    windowSeconds: 900, // 15 minutes
  });
  if (!allowedEmail) {
    return {
      status: "error",
      message: "Muitas solicitações para este e-mail. Por favor, aguarde alguns minutos antes de tentar novamente.",
    };
  }

  try {
    const admin = createSupabaseAdminClient();

    // 1. Verifica se ja existe conta concluida com este e-mail em public.users
    const { data: existingUsers, error: userErr } = await admin
      .from("users")
      .select("id, email")
      .ilike("email", normalizedEmail)
      .limit(1);

    if (userErr) {
      console.error("[signup] Erro ao consultar users:", userErr);
      return {
        status: "error",
        message: "Não foi possível verificar o e-mail. Tente novamente.",
      };
    }

    if (existingUsers && existingUsers.length > 0) {
      return { status: "account_exists", email: normalizedEmail };
    }

    // 2. Busca tokens pendentes para este e-mail
    const { data: pendingTokens, error: tokenQueryErr } = await admin
      .from("signup_tokens")
      .select("id, name, email, status, expires_at")
      .ilike("email", normalizedEmail)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (tokenQueryErr) {
      console.error("[signup] Erro ao consultar signup_tokens:", tokenQueryErr);
      return {
        status: "error",
        message: "Não foi possível processar o cadastro. Tente novamente.",
      };
    }

    const now = new Date();
    const expiredIds: string[] = [];
    let activePending: { id: string; name: string; email: string; expires_at: string } | null =
      null;

    for (const row of pendingTokens ?? []) {
      if (new Date(row.expires_at) <= now) {
        expiredIds.push(row.id);
      } else if (!activePending) {
        activePending = row;
      }
    }

    if (expiredIds.length > 0) {
      await admin
        .from("signup_tokens")
        .update({ status: "expired" })
        .in("id", expiredIds);
    }

    // 3. Se existe link pendente dentro das 24h e o usuario nao pediu reenvio forcado,
    // avisa a UI para abrir a modal perguntando se quer gerar um novo link.
    if (activePending && !input.forceResend) {
      return {
        status: "pending_link_exists",
        email: normalizedEmail,
        name: activePending.name || trimmedName,
        expiresAt: activePending.expires_at,
      };
    }

    // 4. Revoga na hora qualquer link pendente anterior deste e-mail
    if (pendingTokens && pendingTokens.length > 0) {
      const activeIds = pendingTokens
        .filter((row) => !expiredIds.includes(row.id))
        .map((row) => row.id);
      if (activeIds.length > 0) {
        await admin
          .from("signup_tokens")
          .update({
            status: "revoked",
            consumed_at: now.toISOString(),
          })
          .in("id", activeIds);
      }
    }

    // 5. Gera novo token (24h) e salva o hash SHA-256
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS).toISOString();

    const { error: insertErr } = await admin.from("signup_tokens").insert({
      name: trimmedName,
      email: normalizedEmail,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
    });

    if (insertErr) {
      console.error("[signup] Erro ao criar signup_token:", insertErr);
      return {
        status: "error",
        message: "Não foi possível gerar o link de acesso. Tente novamente.",
      };
    }

    // 6. Envia o e-mail via MailerSend com o Template 1 + icone inline
    const baseUrl = await resolveAppBaseUrl();
    const signupUrl = `${baseUrl}/login?signup_token=${rawToken}`;

    const emailResult = await sendSignupLinkEmail({
      toEmail: normalizedEmail,
      toName: trimmedName,
      signupUrl,
    });

    if (!emailResult.ok) {
      return {
        status: "error",
        message: emailResult.error,
      };
    }

    return { status: "sent", email: normalizedEmail };
  } catch (err) {
    console.error("[signup] Erro inesperado em requestSignupLink:", err);
    return {
      status: "error",
      message: "Não foi possível enviar o link de cadastro. Tente novamente.",
    };
  }
}

export type ValidateSignupTokenResult =
  | {
      status: "valid";
      token: string;
      email: string;
      name: string;
      expiresAt: string;
    }
  | {
      status: "expired";
      email: string;
      name: string;
    }
  | {
      status: "consumed";
      email: string;
    }
  | {
      status: "invalid";
    };

/**
 * Valida o token recebido na URL `/login?signup_token=...`.
 */
export async function validateSignupToken(
  rawToken: string | undefined,
): Promise<ValidateSignupTokenResult> {
  const cleaned = rawToken?.trim();
  if (!cleaned) return { status: "invalid" };

  try {
    const admin = createSupabaseAdminClient();
    const tokenHash = hashToken(cleaned);

    const { data: row, error } = await admin
      .from("signup_tokens")
      .select("id, name, email, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !row) {
      return { status: "invalid" };
    }

    // Se o usuario ja concluiu o cadastro e tem registro em public.users (ou o token ja
    // foi consumido), ele ja tem senha definida: nunca deve exibir "Link expirado" com
    // opcao de gerar novo link de cadastro.
    const { data: existingUser } = await admin
      .from("users")
      .select("id, email")
      .ilike("email", row.email)
      .maybeSingle();

    if (existingUser || row.status === "consumed") {
      return { status: "consumed", email: row.email };
    }

    const isPastExpiry = new Date(row.expires_at) <= new Date();
    if (row.status === "revoked" || row.status === "expired" || isPastExpiry) {
      if (row.status === "pending" && isPastExpiry) {
        await admin
          .from("signup_tokens")
          .update({ status: "expired" })
          .eq("id", row.id);
      }
      return {
        status: "expired",
        email: row.email,
        name: row.name,
      };
    }

    return {
      status: "valid",
      token: cleaned,
      email: row.email,
      name: row.name,
      expiresAt: row.expires_at,
    };
  } catch (err) {
    console.error("[signup] Erro ao validar token:", err);
    return { status: "invalid" };
  }
}

export interface HydratedTenantPayload {
  user: UserView;
  organization: Organization;
  unit: Unit;
  categories: Category[];
}

export type CompleteSignupResult =
  | ({ ok: true } & HydratedTenantPayload)
  | { ok: false; code: "expired" | "invalid" | "error"; message: string; email?: string; name?: string };

/**
 * Conclui o cadastro definindo a senha do usuario:
 * 1. Revalida o token de 24h
 * 2. Cria o usuario no Supabase Auth (`email_confirm: true`)
 * 3. Cria `organization` (`onboardingCompleted: false`), `unit` e `public.users` (`owner`)
 * 4. Consome o token
 * 5. Grava a sessao e retorna os dados para hidratar o cliente e seguir para `/setup`
 */
export async function completeSignupWithPassword(input: {
  token: string;
  password: string;
}): Promise<CompleteSignupResult> {
  if (!input.password || input.password.length < 8) {
    return {
      ok: false,
      code: "error",
      message: "A senha deve ter pelo menos 8 caracteres.",
    };
  }

  const validation = await validateSignupToken(input.token);
  if (validation.status === "expired") {
    return {
      ok: false,
      code: "expired",
      message: "Este link expirou. Gere um novo link para continuar.",
      email: validation.email,
      name: validation.name,
    };
  }
  if (validation.status !== "valid") {
    return {
      ok: false,
      code: "invalid",
      message: "Link de cadastro inválido ou já utilizado.",
    };
  }

  const clientIp = await getClientIp();
  const allowed = await checkRateLimit({
    key: `complete_signup:${clientIp}`,
    maxRequests: 5,
    windowSeconds: 300, // 5 minutes
  });
  if (!allowed) {
    return {
      ok: false,
      code: "error",
      message: "Muitas tentativas a partir desta conexão. Por favor, aguarde alguns minutos.",
    };
  }

  try {
    const admin = createSupabaseAdminClient();
    const normalizedEmail = validation.email.trim().toLowerCase();
    const userName = validation.name.trim();

    // 1. Cria usuario no Supabase Auth
    const { data: createdAuth, error: createAuthErr } =
      await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: { name: userName },
      });

    let authUserId = createdAuth?.user?.id;

    if (createAuthErr || !authUserId) {
      // Caso o usuario ja tenha sido criado no Auth em tentativa interrompida,
      // localiza pelo e-mail e atualiza a senha.
      const { data: usersList } = await admin.auth.admin.listUsers();
      const existingAuthUser = usersList?.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail,
      );
      if (!existingAuthUser) {
        console.error("[signup] Erro ao criar usuario no Auth:", createAuthErr);
        return {
          ok: false,
          code: "error",
          message: "Não foi possível criar sua conta. Tente novamente.",
        };
      }
      authUserId = existingAuthUser.id;
      await admin.auth.admin.updateUserById(authUserId, {
        password: input.password,
        email_confirm: true,
        user_metadata: { name: userName },
      });
    }

    const nowIso = new Date().toISOString();
    // 2. Organizacao, unidade e dono no Postgres (comum ao Google).
    const created = await createOwnerAccount(admin, { authUserId, email: normalizedEmail, name: userName });
    if (!created.ok) {
      return { ok: false, code: "error", message: created.message };
    }
    const { user: userRecord, organization, unit } = created;

    // 3. Marca o token como consumido e revoga eventuais outros tokens do e-mail
    const tokenHash = hashToken(input.token.trim());
    await admin
      .from("signup_tokens")
      .update({
        status: "consumed",
        consumed_at: nowIso,
        user_id: authUserId,
      })
      .eq("token_hash", tokenHash);

    await admin
      .from("signup_tokens")
      .update({
        status: "revoked",
        consumed_at: nowIso,
      })
      .ilike("email", normalizedEmail)
      .eq("status", "pending");

    // 4. Autentica na sessao do Supabase e grava o cookie de sessao da aplicacao
    try {
      const supabaseServer = await createSupabaseServerClient();
      await supabaseServer.auth.signInWithPassword({
        email: normalizedEmail,
        password: input.password,
      });
    } catch {
      // Prossegue com o cookie de sessao da aplicacao
    }

    await setSessionCookie(userRecord);

    return {
      ok: true,
      user: userRecord,
      organization,
      unit,
      categories: [],
    };
  } catch (err) {
    console.error("[signup] Erro inesperado em completeSignupWithPassword:", err);
    return {
      ok: false,
      code: "error",
      message: "Não foi possível concluir o cadastro. Tente novamente.",
    };
  }
}

export type SignInWithPasswordResult =
  | ({ ok: true; redirectTo: string } & HydratedTenantPayload)
  | { ok: false; message: string };

/**
 * Entrar na demonstracao (doc 15, fatia 4): login de verdade no espaco de
 * demonstracao do banco, como o dono. Sem DEMO_PASSWORD no ambiente, a
 * demonstracao nao existe ali.
 */
export async function signInDemoAction(from?: string): Promise<SignInWithPasswordResult> {
  return signInAsDemo("owner", from);
}

/**
 * Troca de perfil na demonstracao (barra do topo): so dentro do espaco de
 * demonstracao, entra como o usuario daquele perfil.
 */
export async function switchDemoProfileAction(profile: UserProfile): Promise<SignInWithPasswordResult> {
  const current = await getCurrentUser();
  if (!current || !isDemoOrganization(current.organizationId)) {
    return { ok: false, message: "A troca de perfil só vale na demonstração." };
  }
  return signInAsDemo(profile);
}

async function signInAsDemo(profile: UserProfile, from?: string): Promise<SignInWithPasswordResult> {
  const password = process.env.DEMO_PASSWORD;
  const demoUser = DEMO_USERS.find((u) => u.profile === profile);
  if (!password || !demoUser) return { ok: false, message: "A demonstração não está disponível neste ambiente." };
  return signInWithPasswordAction({ email: demoUser.email, password, from });
}

/**
 * Login com e-mail e senha reais no Supabase Auth.
 */
export async function signInWithPasswordAction(input: {
  email: string;
  password: string;
  from?: string;
}): Promise<SignInWithPasswordResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail || !input.password) {
    return { ok: false, message: "Informe seu e-mail e sua senha." };
  }

  const clientIp = await getClientIp();
  const rateLimitKey = `login:${clientIp}:${normalizedEmail}`;
  const allowed = await checkRateLimit({
    key: rateLimitKey,
    maxRequests: 5,
    windowSeconds: 60, // 1 minute
  });
  if (!allowed) {
    return {
      ok: false,
      message: "Muitas tentativas de login incorretas. Aguarde 1 minuto antes de tentar novamente.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authErr } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: input.password,
      });

    if (authErr || !authData.user) {
      return {
        ok: false,
        message: "E-mail ou senha incorretos.",
      };
    }

    const admin = createSupabaseAdminClient();
    const { data: dbUser, error: userErr } = await admin
      .from("users")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (userErr || !dbUser) {
      return {
        ok: false,
        message: "Usuário não encontrado na organização.",
      };
    }

    if (dbUser.status === "inactive") {
      return {
        ok: false,
        message: "Sua conta está inativa. Procure o responsável pelo espaço.",
      };
    }

    const { user: userView, organization, unit, categories } = await loadSessionPayload(admin, dbUser);

    await setSessionCookie(userView);

    const needsSetup =
      userView.profile === "owner" && !organization.settings?.onboardingCompleted;

    const safeFrom = safeRedirectPath(input.from);
    const redirectTo = needsSetup
      ? "/setup"
      : safeFrom && canAccessRoute(userView, safeFrom, organization.model)
        ? safeFrom
        : firstAllowedRoute(userView, organization.model);

    await resetRateLimit(rateLimitKey);

    return {
      ok: true,
      user: userView,
      organization,
      unit,
      categories,
      redirectTo,
    };
  } catch (err) {
    console.error("[auth] Erro em signInWithPasswordAction:", err);
    return {
      ok: false,
      message: "Não foi possível entrar agora. Tente novamente.",
    };
  }
}

/**
 * Persiste no Postgres (Supabase) os dados escolhidos no assistente `/setup`
 * (nome do espaco, area/segmento, unidade e modalidades criadas).
 * Ignora silenciosamente se a sessao atual for do seed mockado (id nao-UUID).
 */
export async function persistSetupToBackendAction(input: {
  organization: Organization;
  unit: Unit;
  categories: Category[];
}): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !UUID_RE.test(currentUser.organizationId)) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    const orgId = currentUser.organizationId;

    await admin
      .from("organizations")
      .update({
        name: input.organization.name,
        segment: input.organization.segment,
        model: input.organization.model,
        class_segment: input.organization.classSegment ?? null,
        custom_segment_name: input.organization.customSegmentName ?? null,
        custom_segment_progression: input.organization.customSegmentProgression ?? null,
        custom_segment_billing: input.organization.customSegmentBilling ?? null,
        settings: input.organization.settings ?? {},
      })
      .eq("id", orgId);

    await admin
      .from("units")
      .update({
        name: input.unit.name,
        address: input.unit.address ?? null,
        phone: input.unit.phone ?? null,
      })
      .eq("organization_id", orgId);

    if (input.categories.length > 0) {
      for (const cat of input.categories) {
        await admin.from("categories").upsert(
          {
            id: UUID_RE.test(cat.id) ? cat.id : randomUUID(),
            organization_id: orgId,
            name: cat.name,
            progression_track: cat.progressionTrack ?? null,
            status: cat.status,
          },
          { onConflict: "organization_id,name" },
        );
      }
    }
  } catch (err) {
    console.error("[setup] Erro ao persistir setup no Supabase:", err);
  }
}

/** "Continuar com Google" ligado no ambiente (app OAuth configurado, doc 16). */
export async function googleSignInEnabled(): Promise<boolean> {
  return process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";
}

/**
 * Abre o Google: devolve o endereco do consentimento para o navegador. A volta
 * cai em `/auth/callback` (rota em app/auth/callback), que escolhe a conta. Com
 * `invite`, a pessoa aceita o convite com a conta do Google do e-mail convidado.
 */
export async function startGoogleSignInAction(
  input: { from?: string; invite?: string } = {},
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!(await googleSignInEnabled())) {
    return { ok: false, message: "Entrar com Google não está disponível." };
  }
  const callback = new URL("/auth/callback", await resolveAppBaseUrl());
  const from = safeRedirectPath(input.from);
  if (from) callback.searchParams.set("from", from);
  if (input.invite) callback.searchParams.set("invite", input.invite);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    // Sempre pergunta a conta: quem tem varias contas Google escolhe a certa.
    options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) {
    console.error("[auth] Erro ao abrir o Google:", error);
    return { ok: false, message: "Não foi possível abrir o Google. Tente novamente." };
  }
  return { ok: true, url: data.url };
}
