import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { CURRENT_PLATFORM_TERMS_VERSION } from "@gestarahub/contracts";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TenantWorld } from "../src/services/world/types";
import type { TenantContext } from "../src/services/server/tenant";
import { runInWorld } from "../src/services/world/runWorld";
import { store } from "../src/services/world/store";
import { WORLD_COLLECTIONS } from "../src/services/world/tables";
import { defaultMessageTemplates, defaultWhatsAppConnection } from "../src/services/defaults";

/**
 * Espacos de teste no Supabase local para o e2e (doc 15, fatia 5). Cada teste
 * cria o seu espaco (a "Academia X" dos cenarios), entra com um usuario de
 * verdade e mexe nos dados pelo mesmo motor do servidor (`runInWorld`).
 * Os cenarios seguem escrevendo "org-academia-x"/"unit-academia-x"; aqui esses
 * apelidos viram os ids reais do espaco do teste.
 */

export const ACADEMY_ALIAS = "org-academia-x";
export const ACADEMY_UNIT_ALIAS = "unit-academia-x";
export const OWNER_ALIAS = "usr-ac-ana";

export interface E2ETenant {
  organizationId: string;
  unitId: string;
  owner: E2EUser;
  authIds: string[];
}

export interface E2EUser {
  id: string;
  name: string;
  email: string;
  password: string;
  profile: "owner" | "manager" | "attendant" | "professional";
  professionalId?: string;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ausente no .env.local (rode pnpm setup:local).`);
  return value;
}

export function admin(): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const created: E2ETenant[] = [];

/** Espaco de turmas com unidade e dona (Ana Ribeiro), como a academia do seed antigo. */
export async function createAcademy(settings: Record<string, unknown> = {}): Promise<E2ETenant> {
  const db = admin();
  const { data: org, error } = await db
    .from("organizations")
    .insert({
      name: "Academia X",
      segment: "Academia",
      model: "classes",
      settings: { defaultDueDay: 10, onboardingCompleted: true, modalitiesReviewed: true, ...settings },
      subscription: { tier: "free" },
    })
    .select("id")
    .single();
  if (error || !org) throw new Error(`Espaço de teste: ${error?.message}`);
  const { data: unit, error: unitError } = await db
    .from("units")
    .insert({ organization_id: org.id, name: "" })
    .select("id")
    .single();
  if (unitError || !unit) throw new Error(`Unidade de teste: ${unitError?.message}`);
  const tenant: E2ETenant = {
    organizationId: String(org.id),
    unitId: String(unit.id),
    owner: undefined as unknown as E2EUser,
    authIds: [],
  };
  tenant.owner = await addUser(tenant, "owner", "Ana Ribeiro");
  created.push(tenant);
  // Como o espaco do mock nascia: modelos de mensagem e WhatsApp assistido.
  await editTenant(tenant, (t) => {
    t.messageTemplates = defaultMessageTemplates(tenant.organizationId, undefined);
    t.whatsAppConnection = defaultWhatsAppConnection(tenant.organizationId);
  });
  return tenant;
}

export async function addUser(
  tenant: E2ETenant,
  profile: E2EUser["profile"],
  name: string,
  professionalId?: string,
): Promise<E2EUser> {
  const db = admin();
  const email = `e2e-${randomUUID()}@gestarahub.test`;
  const password = randomUUID();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Usuário de teste: ${error?.message}`);
  tenant.authIds.push(data.user.id);
  await db
    .from("users")
    .insert({
      id: data.user.id,
      auth_user_id: data.user.id,
      organization_id: tenant.organizationId,
      name,
      email,
      profile,
      professional_id: professionalId ?? null,
      // Termos ja aceitos: o dialogo de aceite nao cobre as telas dos cenarios.
      terms_accepted_at: new Date().toISOString(),
      terms_version: CURRENT_PLATFORM_TERMS_VERSION,
    })
    .throwOnError();
  await db
    .from("legal_consents")
    .insert({
      organization_id: tenant.organizationId,
      user_id: data.user.id,
      consent_type: "platform_terms",
      terms_version: CURRENT_PLATFORM_TERMS_VERSION,
    })
    .throwOnError();
  return { id: data.user.id, name, email, password, profile, professionalId };
}

/** Apaga os espacos criados neste processo (fim de cada teste). */
export async function removeCreatedTenants(): Promise<void> {
  const db = admin();
  while (created.length > 0) {
    const tenant = created.pop()!;
    await db.from("organizations").delete().eq("id", tenant.organizationId);
    for (const id of tenant.authIds) await db.auth.admin.deleteUser(id);
  }
}

/**
 * Entra no navegador como o usuario: sessao do Supabase (cookies do
 * `@supabase/ssr`) e o cookie de sessao do app com as claims.
 */
export async function signInBrowser(page: Page, tenant: E2ETenant, user: E2EUser, baseUrl: string): Promise<void> {
  const captured: { name: string; value: string }[] = [];
  const client = createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => captured,
      setAll: (cookies) => {
        for (const c of cookies) {
          const at = captured.findIndex((x) => x.name === c.name);
          if (at >= 0) captured.splice(at, 1);
          if (c.value) captured.push({ name: c.name, value: c.value });
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`Login de teste: ${error.message}`);
  const ts = "2026-09-01T12:00:00.000Z";
  const claims = {
    id: user.id,
    organizationId: tenant.organizationId,
    name: user.name,
    email: user.email,
    profile: user.profile,
    professionalId: user.professionalId,
    status: "active",
    createdAt: ts,
    updatedAt: ts,
  };
  await page.context().addCookies([
    ...captured.map((c) => ({ name: c.name, value: c.value, url: baseUrl, sameSite: "Lax" as const })),
    {
      name: "gestarahub_session",
      value: Buffer.from(JSON.stringify(claims), "utf8").toString("base64"),
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

function ownerContext(tenant: E2ETenant): TenantContext {
  return {
    client: admin(),
    organizationId: tenant.organizationId,
    userId: tenant.owner.id,
    profile: "owner",
    require: () => undefined,
  } as unknown as TenantContext;
}

/** Troca os apelidos dos cenarios ("org-academia-x"...) pelos ids reais, em profundidade. */
function resolveAliases(value: unknown, tenant: E2ETenant): unknown {
  if (value === OWNER_ALIAS) return tenant.owner.id;
  // Tambem dentro de ids derivados ("fcat-org-academia-x-tuition").
  if (typeof value === "string" && (value.includes(ACADEMY_ALIAS) || value.includes(ACADEMY_UNIT_ALIAS))) {
    return value.split(ACADEMY_UNIT_ALIAS).join(tenant.unitId).split(ACADEMY_ALIAS).join(tenant.organizationId);
  }
  if (Array.isArray(value)) return value.map((v) => resolveAliases(v, tenant));
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      (value as Record<string, unknown>)[key] = resolveAliases(v, tenant);
    }
  }
  return value;
}

/**
 * Mexe no espaco do teste como o cenario mexia no mundo do mock: `mutate`
 * recebe o espaco (mesmas colecoes) e o motor grava a diferenca no banco.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function editTenant(tenant: E2ETenant, mutate: (t: any) => void | Promise<void>): Promise<void> {
  await runInWorld(ownerContext(tenant), async () => {
    await mutate(store);
    // A auditoria do banco usa uuid; os cenarios usam ids curtos ("log-1").
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const entry of store.auditLog ?? []) {
      if (!uuid.test(entry.id)) entry.id = randomUUID();
    }
    for (const { key } of WORLD_COLLECTIONS) {
      const value = (store as unknown as Record<string, unknown>)[key];
      if (value !== undefined) resolveAliases(value, tenant);
    }
  });
}

/** Copia do espaco do teste (leitura, como o cenario lia o localStorage). */
export async function readTenant(tenant: E2ETenant): Promise<TenantWorld> {
  return runInWorld(ownerContext(tenant), async () => {
    const copy: Record<string, unknown> = {};
    for (const { key } of WORLD_COLLECTIONS) {
      copy[key] = (store as unknown as Record<string, unknown>)[key];
    }
    copy.certificateTemplate = store.certificateTemplate;
    return structuredClone(copy) as unknown as TenantWorld;
  });
}

/** Log de auditoria do espaco (o espaco carregado nao traz o log, que so cresce). */
export async function readAuditLog(
  tenant: E2ETenant,
): Promise<{ action: string; target: { type: string; id?: string; label?: string }; summary: string }[]> {
  const { data, error } = await admin()
    .from("audit_logs")
    .select("action, target, summary")
    .eq("organization_id", tenant.organizationId)
    .order("timestamp", { ascending: true });
  if (error) throw new Error(`Auditoria de teste: ${error.message}`);
  return (data ?? []) as { action: string; target: { type: string }; summary: string }[];
}
