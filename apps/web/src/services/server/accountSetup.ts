import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Category,
  ClassBillingMode,
  ClassesBusinessSegment,
  CustomSegmentProgression,
  ModalityProgressionTrack,
  OperationalModel,
  Organization,
  Unit,
  User,
  UserProfile,
  UserView,
} from "@gestarahub/contracts";

/**
 * Criacao e carga da conta no banco, comuns ao cadastro por e-mail e ao
 * "Continuar com Google". Modulo so do servidor (sem "use server"): recebe o
 * cliente administrativo de quem ja conferiu a identidade da pessoa.
 */

type Row = Record<string, unknown>;

export interface SessionPayload {
  user: UserView;
  organization: Organization;
  unit: Unit;
  categories: Category[];
}

export type CreateOwnerResult =
  | ({ ok: true } & SessionPayload)
  | { ok: false; message: string };

/** Espaco novo (organizacao, unidade e o dono), ainda sem a configuracao inicial. */
export async function createOwnerAccount(
  admin: SupabaseClient,
  input: { authUserId: string; email: string; name: string },
): Promise<CreateOwnerResult> {
  const nowIso = new Date().toISOString();
  const orgId = randomUUID();
  const unitId = randomUUID();

  const organization: Organization = {
    id: orgId,
    name: "Academia X",
    segment: "Academia",
    model: "classes",
    settings: {
      defaultDueDay: 10,
      onboardingCompleted: false,
    },
    subscription: { tier: "free" },
    status: "active",
  };

  const unit: Unit = {
    id: unitId,
    organizationId: orgId,
    name: "",
    status: "active",
    businessHours: [],
  };

  const userRecord: User = {
    id: input.authUserId,
    organizationId: orgId,
    name: input.name,
    email: input.email,
    profile: "owner",
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const { error: orgErr } = await admin.from("organizations").insert({
    id: orgId,
    name: organization.name,
    segment: organization.segment,
    model: organization.model,
    settings: organization.settings,
    subscription: organization.subscription,
    status: organization.status,
  });
  if (orgErr) {
    console.error("[signup] Erro ao criar organizacao:", orgErr);
    return { ok: false, message: "Não foi possível preparar o espaço da sua conta. Tente novamente." };
  }

  const { error: unitErr } = await admin.from("units").insert({
    id: unitId,
    organization_id: orgId,
    name: "",
    status: "active",
    business_hours: [],
  });
  if (unitErr) {
    console.error("[signup] Erro ao criar unidade:", unitErr);
  }

  const { error: userInsertErr } = await admin.from("users").upsert({
    id: input.authUserId,
    auth_user_id: input.authUserId,
    organization_id: orgId,
    name: input.name,
    email: input.email,
    profile: "owner",
    status: "active",
  });
  if (userInsertErr) {
    console.error("[signup] Erro ao criar public.users:", userInsertErr);
    return { ok: false, message: "Não foi possível salvar os dados do usuário. Tente novamente." };
  }

  return { ok: true, user: userRecord, organization, unit, categories: [] };
}

/** Organizacao, primeira unidade, modalidades e o usuario na forma da sessao. */
export async function loadSessionPayload(admin: SupabaseClient, dbUser: Row): Promise<SessionPayload> {
  const orgId = dbUser.organization_id as string;

  const [{ data: dbOrg }, { data: dbUnits }, { data: dbCategories }] = await Promise.all([
    admin.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    admin
      .from("units")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true })
      .limit(1),
    admin
      .from("categories")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
  ]);

  const organization: Organization = {
    id: orgId,
    name: (dbOrg?.name as string) ?? "Meu espaço",
    segment: (dbOrg?.segment as string) ?? "Academia",
    model: (dbOrg?.model as OperationalModel) ?? "classes",
    classSegment: (dbOrg?.class_segment as ClassesBusinessSegment | undefined) ?? undefined,
    customSegmentName: (dbOrg?.custom_segment_name as string | undefined) ?? undefined,
    customSegmentProgression:
      (dbOrg?.custom_segment_progression as CustomSegmentProgression | undefined) ?? undefined,
    customSegmentBilling: (dbOrg?.custom_segment_billing as ClassBillingMode | undefined) ?? undefined,
    settings: (dbOrg?.settings as Organization["settings"]) ?? {
      defaultDueDay: 10,
    },
    subscription: (dbOrg?.subscription as Organization["subscription"]) ?? {
      tier: "free",
    },
    status: (dbOrg?.status as Organization["status"]) ?? "active",
  };

  const firstUnit = dbUnits?.[0];
  const unit: Unit = {
    id: (firstUnit?.id as string) ?? `unit-${orgId}`,
    organizationId: orgId,
    name: (firstUnit?.name as string) ?? "",
    address: (firstUnit?.address as Unit["address"]) ?? undefined,
    phone: (firstUnit?.phone as string | undefined) ?? undefined,
    status: (firstUnit?.status as Unit["status"]) ?? "active",
    businessHours: (firstUnit?.business_hours as Unit["businessHours"]) ?? [],
  };

  const categories: Category[] = (dbCategories ?? []).map((cat, idx) => ({
    id: cat.id as string,
    organizationId: orgId,
    name: cat.name as string,
    position: idx,
    progressionTrack: (cat.progression_track as ModalityProgressionTrack | undefined) ?? undefined,
    status: (cat.status as Category["status"]) ?? "active",
    createdAt: cat.created_at as string,
    updatedAt: cat.updated_at as string,
  }));

  const user: UserView = {
    id: dbUser.id as string,
    organizationId: orgId,
    name: dbUser.name as string,
    email: dbUser.email as string,
    profile: dbUser.profile as UserProfile,
    status: dbUser.status as User["status"],
    professionalId: (dbUser.professional_id as string | undefined) ?? undefined,
    termsAcceptedAt: (dbUser.terms_accepted_at as string | undefined) ?? undefined,
    termsVersion: (dbUser.terms_version as string | undefined) ?? undefined,
    createdAt: dbUser.created_at as string,
    updatedAt: dbUser.updated_at as string,
  };

  return { user, organization, unit, categories };
}

/** Pessoa que voltou do Google: id e e-mail confirmados pelo Supabase Auth. */
export interface GoogleIdentity {
  authUserId: string;
  email: string;
  name: string;
}

export type GoogleAccountResult =
  | { ok: true; dbUser: Row; created: boolean }
  | {
      ok: false;
      code: "invite_invalid" | "invite_email_mismatch" | "email_in_use" | "inactive" | "error";
    };

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Convite pendente vira acesso: liga a conta do Google ao usuario convidado. */
async function acceptInvitation(admin: SupabaseClient, invitation: Row, authUserId: string): Promise<Row | null> {
  const nowIso = new Date().toISOString();
  const { data: linked, error } = await admin
    .from("users")
    .update({ auth_user_id: authUserId, status: "active" })
    .eq("id", invitation.user_id as string)
    .select("*")
    .maybeSingle();
  if (error || !linked) return null;
  await admin
    .from("organization_invitations")
    .update({ status: "accepted", accepted_at: nowIso })
    .eq("id", invitation.id as string);
  return linked as Row;
}

/**
 * Qual conta a pessoa do Google usa (doc 16, "Entrar com Google"):
 * 1. Veio de um convite: o e-mail do Google tem de ser o do convite.
 * 2. Ja ligada (mesmo usuario do Auth): entra.
 * 3. Convidada pelo e-mail e ainda sem acesso: aceita o convite pendente.
 * 4. E-mail ja usado por outra conta do Auth: recusa (nunca liga por e-mail).
 * 5. Ninguem com o e-mail: espaco novo, como no cadastro por e-mail.
 */
export async function resolveGoogleAccount(
  admin: SupabaseClient,
  identity: GoogleIdentity,
  inviteToken?: string,
): Promise<GoogleAccountResult> {
  const email = identity.email.trim().toLowerCase();

  if (inviteToken) {
    const { data: invitation } = await admin
      .from("organization_invitations")
      .select("*")
      .eq("token_hash", hashToken(inviteToken.trim()))
      .eq("status", "pending")
      .maybeSingle();
    if (!invitation || new Date(invitation.expires_at as string) <= new Date()) {
      return { ok: false, code: "invite_invalid" };
    }
    if ((invitation.email as string).trim().toLowerCase() !== email) {
      return { ok: false, code: "invite_email_mismatch" };
    }
    const linked = await acceptInvitation(admin, invitation, identity.authUserId);
    return linked ? { ok: true, dbUser: linked, created: false } : { ok: false, code: "error" };
  }

  const { data: byAuth } = await admin
    .from("users")
    .select("*")
    .eq("auth_user_id", identity.authUserId)
    .maybeSingle();
  if (byAuth) {
    return byAuth.status === "inactive" ? { ok: false, code: "inactive" } : { ok: true, dbUser: byAuth, created: false };
  }

  const { data: byEmail } = await admin.from("users").select("*").ilike("email", email);
  const sameEmail = (byEmail ?? []) as Row[];
  if (sameEmail.some((u) => u.auth_user_id && u.auth_user_id !== identity.authUserId)) {
    return { ok: false, code: "email_in_use" };
  }
  for (const invited of sameEmail) {
    const { data: invitation } = await admin
      .from("organization_invitations")
      .select("*")
      .eq("user_id", invited.id as string)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (invitation) {
      const linked = await acceptInvitation(admin, invitation, identity.authUserId);
      return linked ? { ok: true, dbUser: linked, created: false } : { ok: false, code: "error" };
    }
  }
  if (sameEmail.length > 0) return { ok: false, code: "email_in_use" };

  const created = await createOwnerAccount(admin, { authUserId: identity.authUserId, email, name: identity.name });
  if (!created.ok) return { ok: false, code: "error" };
  // Link de cadastro por e-mail que ficou pendente deixa de valer.
  await admin
    .from("signup_tokens")
    .update({ status: "revoked", consumed_at: new Date().toISOString() })
    .ilike("email", email)
    .eq("status", "pending");
  const { data: dbUser } = await admin.from("users").select("*").eq("id", identity.authUserId).maybeSingle();
  return dbUser ? { ok: true, dbUser, created: true } : { ok: false, code: "error" };
}
