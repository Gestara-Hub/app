"use server";

import { requireTenant } from "@/services/server/tenant";
import { isPlatformAdminUser } from "@/lib/security/platform-admin";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PASSWORD_TOO_SHORT_MESSAGE, isPasswordLongEnough } from "@/lib/password-rules";
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
import { sendSignupLinkEmail } from "@/lib/email/ses";
import { checkRateLimit, getClientIp, resetRateLimit } from "@/lib/security/rate-limit";
import { SESSION_COOKIE, safeRedirectPath } from "@/lib/session";
import { encodeSession, sessionCookieOptions } from "@/lib/session-cookie";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { createOwnerAccount } from "@/services/server/accountSetup";
import { finishSignIn, needsSecondFactor } from "./sign-in-session";
import { logError, withErrorScope } from "@/lib/log";
import { likeExact } from "@/lib/supabase/like";

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
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3200";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const ACCOUNT_EXISTS_MESSAGE = 'Este e-mail já tem conta. Entre com ele ou use "Esqueci minha senha".';

/** O login ja tem usuario no app (pelo `id` ou pelo `auth_user_id`)? */
async function hasAppUser(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("users")
    .select("id")
    .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
    .limit(1);
  return (data ?? []).length > 0;
}

/**
 * Conta de verdade com este e-mail no Auth, mesmo quando o e-mail do app
 * ficou diferente do login: devolve o id do login. Sem isso o cadastro pelo
 * link entrava em ciclo (recusa, "link expirado", novo link, recusa).
 */
async function linkedAuthUserIdByEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<string | null> {
  const authUser = await findAuthUserByEmail(admin, email);
  return authUser && (await hasAppUser(admin, authUser.id)) ? authUser.id : null;
}

/** Login do Auth pelo e-mail, em todas as paginas (a listagem vem paginada). */
async function findAuthUserByEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<{ id: string } | null> {
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return { id: found.id };
    if (data.users.length < perPage) return null;
  }
}

async function setSessionCookie(user: UserView): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions());
}

export type RequestSignupLinkResult =
  | { status: "sent"; email: string }
  | {
      status: "pending_link_exists";
      email: string;
      name: string;
      expiresAt: string;
    }
  /** `googleOnly`: a conta entra so pelo Google (nao tem senha). */
  | { status: "account_exists"; email: string; googleOnly: boolean }
  | { status: "error"; message: string };

/**
 * Solicita o envio do link de cadastro (validade de 24h) pela Landing Page ou
 * pela tela de login quando o link anterior expirou.
 *
 * - Se ja existe usuario ativo com senha criada -> `account_exists`
 * - Se ja existe link `pending` nao expirado e `!forceResend` -> `pending_link_exists` (abre a modal)
 * - Se `forceResend === true` ou nao ha link ativo -> revoga links anteriores na hora,
 *   cria novo token de 24h e envia por e-mail via Amazon SES.
 */
export async function requestSignupLink(input: {
  name: string;
  email: string;
  forceResend?: boolean;
}): Promise<RequestSignupLinkResult> {
  return withErrorScope(async () => {
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
        .select("id, email, auth_user_id")
        .ilike("email", likeExact(normalizedEmail))
        .limit(1);

      if (userErr) {
        logError("[signup] Erro ao consultar users:", userErr);
        return {
          status: "error",
          message: "Não foi possível verificar o e-mail. Tente novamente.",
        };
      }

      const existingAuthUserId =
        existingUsers && existingUsers.length > 0
          ? existingUsers[0].auth_user_id
          : await linkedAuthUserIdByEmail(admin, normalizedEmail);
      if ((existingUsers && existingUsers.length > 0) || existingAuthUserId) {
        // Conta criada pelo Google nao tem senha: a tela orienta a entrar pelo Google.
        const googleOnly = await isGoogleOnlyAuthUser(admin, existingAuthUserId);
        return { status: "account_exists", email: normalizedEmail, googleOnly };
      }

      // 2. Busca tokens pendentes para este e-mail
      const { data: pendingTokens, error: tokenQueryErr } = await admin
        .from("signup_tokens")
        .select("id, name, email, status, expires_at")
        .ilike("email", likeExact(normalizedEmail))
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (tokenQueryErr) {
        logError("[signup] Erro ao consultar signup_tokens:", tokenQueryErr);
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
          // A tabela so aceita pending, consumed e revoked: vencido vira revoked.
          .update({ status: "revoked" })
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
        logError("[signup] Erro ao criar signup_token:", insertErr);
        return {
          status: "error",
          message: "Não foi possível gerar o link de acesso. Tente novamente.",
        };
      }

      // 6. Envia o e-mail via Amazon SES com o Template 1 + icone inline
      const baseUrl = await resolveAppBaseUrl();
      const signupUrl = `${baseUrl}/login?signup_token=${rawToken}`;

      const emailResult = await sendSignupLinkEmail({
        toEmail: normalizedEmail,
        toName: trimmedName,
        signupUrl,
      });

      if (!emailResult.ok) {
        // O e-mail nao saiu: o link novo nao vale (senao a proxima tentativa diria
        // "link ja enviado") e o anterior, se houver, continua valendo.
        await admin.from("signup_tokens").update({ status: "revoked", consumed_at: now.toISOString() }).eq("token_hash", tokenHash);
        return {
          status: "error",
          message: emailResult.error,
        };
      }

      // 7. Enviado: so agora revoga os links anteriores deste e-mail.
      const previousIds = (pendingTokens ?? []).map((row) => row.id).filter((id) => !expiredIds.includes(id));
      if (previousIds.length > 0) {
        await admin
          .from("signup_tokens")
          .update({ status: "revoked", consumed_at: now.toISOString() })
          .in("id", previousIds);
      }

      return { status: "sent", email: normalizedEmail };
    } catch (err) {
      logError("[signup] Erro inesperado em requestSignupLink:", err);
      return {
        status: "error",
        message: "Não foi possível enviar o link de cadastro. Tente novamente.",
      };
    }
  });
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
  return withErrorScope(async () => {
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
        .ilike("email", likeExact(row.email))
        .maybeSingle();

      if (existingUser || row.status === "consumed") {
        return { status: "consumed", email: row.email };
      }
      if (await linkedAuthUserIdByEmail(admin, String(row.email).trim().toLowerCase())) {
        return { status: "consumed", email: row.email };
      }

      const isPastExpiry = new Date(row.expires_at) <= new Date();
      if (row.status === "revoked" || row.status === "expired" || isPastExpiry) {
        if (row.status === "pending" && isPastExpiry) {
          await admin
            .from("signup_tokens")
            .update({ status: "revoked" })
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
      logError("[signup] Erro ao validar token:", err);
      return { status: "invalid" };
    }
  });
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
  return withErrorScope(async () => {
    if (!isPasswordLongEnough(input.password)) {
      return {
        ok: false,
        code: "error",
        message: PASSWORD_TOO_SHORT_MESSAGE,
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
    if (validation.status === "consumed") {
      return {
        ok: false,
        code: "invalid",
        message: ACCOUNT_EXISTS_MESSAGE,
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
        const existingAuthUser = await findAuthUserByEmail(admin, normalizedEmail);
        if (!existingAuthUser) {
          logError("[signup] Erro ao criar usuario no Auth:", createAuthErr);
          return {
            ok: false,
            code: "error",
            message: "Não foi possível criar sua conta. Tente novamente.",
          };
        }
        // So e tentativa interrompida se o login ainda nao tem usuario no app.
        // Com usuario (ex.: e-mail diferente em public.users), reaproveitar
        // trocaria a senha e tiraria a pessoa do proprio espaco.
        if (await hasAppUser(admin, existingAuthUser.id)) {
          await admin
            .from("signup_tokens")
            .update({ status: "revoked", consumed_at: new Date().toISOString() })
            .eq("token_hash", hashToken(input.token.trim()));
          return {
            ok: false,
            code: "error",
            message: ACCOUNT_EXISTS_MESSAGE,
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
        .ilike("email", likeExact(normalizedEmail))
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
      logError("[signup] Erro inesperado em completeSignupWithPassword:", err);
      return {
        ok: false,
        code: "error",
        message: "Não foi possível concluir o cadastro. Tente novamente.",
      };
    }
  });
}

export type SignInWithPasswordResult =
  | ({ ok: true; redirectTo: string } & HydratedTenantPayload)
  /** `twoFactorRequired`: senha certa, falta o codigo do app (tela /two-factor). */
  | { ok: false; message: string; twoFactorRequired?: boolean };

/**
 * Entrar na demonstracao (doc 15, fatia 4): login de verdade no espaco de
 * demonstracao do banco, como o dono. Sem DEMO_PASSWORD no ambiente, a
 * demonstracao nao existe ali.
 */
export async function signInDemoAction(from?: string): Promise<SignInWithPasswordResult> {
  return withErrorScope(async () => {
    return signInAsDemo("owner", from);
  });
}

/**
 * Troca de perfil na demonstracao (barra do topo): so dentro do espaco de
 * demonstracao, entra como o usuario daquele perfil.
 */
export async function switchDemoProfileAction(profile: UserProfile): Promise<SignInWithPasswordResult> {
  return withErrorScope(async () => {
    const current = await getCurrentUser();
    if (!current || !isDemoOrganization(current.organizationId)) {
      return { ok: false, message: "A troca de perfil só vale na demonstração." };
    }
    return signInAsDemo(profile);
  });
}

async function signInAsDemo(profile: UserProfile, from?: string): Promise<SignInWithPasswordResult> {
  const password = process.env.DEMO_PASSWORD;
  const demoUser = DEMO_USERS.find((u) => u.profile === profile);
  if (!password || !demoUser) return { ok: false, message: "A demonstração não está disponível neste ambiente." };
  return signInWithPasswordAction({ email: demoUser.email, password, from });
}

/** Conta do Supabase Auth so com Google (sem senha). */
async function isGoogleOnlyAuthUser(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: unknown,
): Promise<boolean> {
  if (!authUserId) return false;
  const { data } = await admin.auth.admin.getUserById(String(authUserId));
  const providers = (data?.user?.identities ?? []).map((identity) => identity.provider);
  return providers.includes("google") && !providers.includes("email");
}

/**
 * Login com e-mail e senha reais no Supabase Auth.
 */
export async function signInWithPasswordAction(input: {
  email: string;
  password: string;
  from?: string;
}): Promise<SignInWithPasswordResult> {
  return withErrorScope(async () => {
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
    // Limite tambem por conta, de qualquer endereco: trocar de IP (ou forjar o
    // x-forwarded-for fora da Vercel) nao libera tentativas sem fim na mesma
    // senha (revisao geral de 31/10/2026, achado S11).
    const accountAllowed = await checkRateLimit({ key: `login-account:${normalizedEmail}`, maxRequests: 20, windowSeconds: 900 });
    if (!accountAllowed) {
      return {
        ok: false,
        message: "Muitas tentativas nesta conta. Aguarde 15 minutos ou redefina a senha.",
      };
    }

    try {
      const supabase = await createSupabaseServerClient();
      const { data: authData, error: authErr } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: input.password,
        });

      const admin = createSupabaseAdminClient();
      if (authErr || !authData.user) {
        // Conta so do Google nao tem senha: em vez de "senha incorreta", orienta.
        const { data: googleUser } = await admin
          .from("users")
          .select("auth_user_id")
          .ilike("email", likeExact(normalizedEmail))
          .limit(1)
          .maybeSingle();
        if (await isGoogleOnlyAuthUser(admin, googleUser?.auth_user_id)) {
          return {
            ok: false,
            message: "Esta conta entra pelo Google. Use \"Continuar com Google\".",
          };
        }
        return {
          ok: false,
          message: "E-mail ou senha incorretos.",
        };
      }

      // Conta de administrador da plataforma nao entra no app dos clientes: sai na
      // hora, com a mesma mensagem de senha errada (nao revela que a conta existe).
      if (isPlatformAdminUser(authData.user)) {
        await supabase.auth.signOut({ scope: "local" });
        return { ok: false, message: "E-mail ou senha incorretos." };
      }

      // Verificacao em duas etapas ligada (doc 17): a sessao do app so nasce
      // depois do codigo, na tela /two-factor.
      if (await needsSecondFactor(supabase)) {
        await resetRateLimit(rateLimitKey);
        return { ok: false, message: "", twoFactorRequired: true };
      }

      const result = await finishSignIn(admin, authData.user.id, input.from);
      if (result.ok) await resetRateLimit(rateLimitKey);
      return result;
    } catch (err) {
      logError("[auth] Erro em signInWithPasswordAction:", err);
      return {
        ok: false,
        message: "Não foi possível entrar agora. Tente novamente.",
      };
    }
  });
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
  return withErrorScope(async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser || !UUID_RE.test(currentUser.organizationId)) {
      return;
    }
    // O espaco e o perfil vem da sessao do Supabase, nao do cookie; so o dono faz
    // a configuracao inicial (antes, qualquer membro, ate professor, trocava nome,
    // modelo e regras do espaco; auditoria de 30/10/2026).
    let ctx: Awaited<ReturnType<typeof requireTenant>>;
    try {
      ctx = await requireTenant();
    } catch {
      return;
    }
    if (ctx.profile !== "owner") return;

    try {
      const admin = createSupabaseAdminClient();
      const orgId = ctx.organizationId;

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

      // So o nome: o assistente nao edita telefone nem endereco, e regravar o que
      // veio do navegador (sem conferir) ja deixou um telefone de 16 digitos salvo
      // (revisao de Configuracoes, 31/10/2026). Os dois mudam pela aba Geral.
      await admin
        .from("units")
        .update({ name: input.unit.name })
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
      logError("[setup] Erro ao persistir setup no Supabase:", err);
    }
  });
}

/** "Continuar com Google" ligado no ambiente (app OAuth configurado, doc 16). */
export async function googleSignInEnabled(): Promise<boolean> {
  return withErrorScope(async () => {
    return process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";
  });
}

/**
 * Abre o Google: devolve o endereco do consentimento para o navegador. A volta
 * cai em `/auth/callback` (rota em app/auth/callback), que escolhe a conta. Com
 * `invite`, a pessoa aceita o convite com a conta do Google do e-mail convidado.
 */
export async function startGoogleSignInAction(
  input: { from?: string; invite?: string } = {},
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  return withErrorScope(async () => {
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
      logError("[auth] Erro ao abrir o Google:", error);
      return { ok: false, message: "Não foi possível abrir o Google. Tente novamente." };
    }
    return { ok: true, url: data.url };
  });
}
