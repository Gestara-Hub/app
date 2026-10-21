import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "@gestarahub/contracts";

/**
 * Espacos de teste no Supabase local (doc 15, fatia 5). Cada teste cria um
 * espaco com unidade e um usuario autenticado; as server actions usam o
 * cliente desse usuario (com RLS), como numa requisicao real.
 */

let currentClient: SupabaseClient | null = null;

/** Cliente da "sessao" atual, devolvido pelo mock de `@/lib/supabase/server`. */
export function sessionClient(): SupabaseClient {
  if (!currentClient) throw new Error("Nenhuma sessão de teste: chame signInAs antes.");
  return currentClient;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ausente no .env.local (rode pnpm setup:local).`);
  return value;
}

export function adminClient(): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TestTenant {
  organizationId: string;
  unitId: string;
  /** Usuario do espaco, para trocar de perfil no meio do teste. */
  addUser(profile: UserProfile): Promise<TestUser>;
  owner: TestUser;
  remove(): Promise<void>;
}

export interface TestUser {
  id: string;
  profile: UserProfile;
  email: string;
  password: string;
}

/** Cria espaco de turmas + unidade + dono, e entra como o dono. */
export async function createTestTenant(
  organization: Record<string, unknown> = {},
): Promise<TestTenant> {
  const admin = adminClient();
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: "Espaço de teste", model: "classes", class_segment: "martial_arts", ...organization })
    .select("id")
    .single();
  if (orgError || !org) throw new Error(`Espaço de teste: ${orgError?.message}`);
  const organizationId = String(org.id);
  const { data: unit, error: unitError } = await admin
    .from("units")
    .insert({ organization_id: organizationId, name: "Unidade de teste" })
    .select("id")
    .single();
  if (unitError || !unit) throw new Error(`Unidade de teste: ${unitError?.message}`);

  const authIds: string[] = [];
  async function addUser(profile: UserProfile): Promise<TestUser> {
    const email = `teste-${randomUUID()}@gestarahub.test`;
    const password = randomUUID();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`Usuário de teste: ${error?.message}`);
    authIds.push(data.user.id);
    const { data: row, error: rowError } = await admin
      .from("users")
      .insert({
        auth_user_id: data.user.id,
        organization_id: organizationId,
        name: `Teste ${profile}`,
        email,
        profile,
      })
      .select("id")
      .single();
    if (rowError || !row) throw new Error(`Perfil de teste: ${rowError?.message}`);
    return { id: String(row.id), profile, email, password };
  }

  const owner = await addUser("owner");
  await signInAs(owner);
  return {
    organizationId,
    unitId: String(unit.id),
    addUser,
    owner,
    async remove() {
      currentClient = null;
      await admin.from("organizations").delete().eq("id", organizationId);
      for (const id of authIds) await admin.auth.admin.deleteUser(id);
    },
  };
}

/** Passa a "sessao" para o usuario informado. */
export async function signInAs(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`Login de teste: ${error.message}`);
  currentClient = client;
  return client;
}

/** Sem sessao (visitante). */
export function signOut(): void {
  currentClient = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
