import { it } from "vitest";
import { DEMO_ORGANIZATION_ID, DEMO_USERS } from "@/lib/demo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TenantContext } from "@/services/server/tenant";
import { runInWorld } from "@/services/world/runWorld";
import { buildDemo } from "./demoScenario";

/**
 * Recria o espaco de demonstracao no banco (doc 15, fatia 4):
 *
 *   pnpm --filter @gestarahub/web demo:seed
 *
 * Apaga a demonstracao anterior (e so ela), cria espaco, unidade e um usuario
 * por perfil e roda o cenario pelos servicos. A senha dos usuarios vem de
 * DEMO_PASSWORD (.env.local; `pnpm setup:local` cria). Nunca imprime a senha.
 */

const OPEN = (weekday: number) => ({
  weekday,
  closed: false,
  start: "06:00",
  end: "22:00",
  shifts: [{ start: "06:00", end: "22:00" }],
});

it("semeia o espaço de demonstração", { timeout: 300_000 }, async () => {
  const password = process.env.DEMO_PASSWORD;
  if (!password) throw new Error("DEMO_PASSWORD ausente no .env.local (rode pnpm setup:local).");
  const admin = createSupabaseAdminClient();

  // 1. Remove a demonstracao anterior (espaco e usuarios do dominio de demo).
  await admin.from("organizations").delete().eq("id", DEMO_ORGANIZATION_ID).throwOnError();
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of authUsers?.users ?? []) {
    if (u.email?.endsWith("@demo.gestarahub.test")) await admin.auth.admin.deleteUser(u.id);
  }

  // 2. Espaco, unidade e usuarios.
  await admin
    .from("organizations")
    .insert({
      id: DEMO_ORGANIZATION_ID,
      name: "Academia X",
      segment: "Academia",
      model: "classes",
      class_segment: "martial_arts",
      settings: {
        defaultDueDay: 10,
        billingTiming: "prepaid",
        midMonthStrategy: "prorated",
        onboardingCompleted: true,
        modalitiesReviewed: true,
      },
      subscription: { tier: "free" },
    })
    .throwOnError();
  const { data: unit } = await admin
    .from("units")
    .insert({
      organization_id: DEMO_ORGANIZATION_ID,
      name: "Unidade Centro",
      phone: "11933334444",
      address: { street: "Rua das Palmeiras", number: "120", neighborhood: "Centro", city: "São Paulo", state: "SP" },
      business_hours: [{ weekday: 0, closed: true, shifts: [] }, ...[1, 2, 3, 4, 5, 6].map(OPEN)],
    })
    .select("id")
    .single()
    .throwOnError();
  void unit;

  const ids: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`Usuário de demonstração: ${error?.message}`);
    ids[u.profile] = data.user.id;
    await admin
      .from("users")
      .insert({
        id: data.user.id,
        auth_user_id: data.user.id,
        organization_id: DEMO_ORGANIZATION_ID,
        name: u.name,
        email: u.email,
        profile: u.profile,
      })
      .throwOnError();
  }

  // 3. Cenario pelos servicos, no espaco carregado do banco, como o dono.
  const ctx = {
    client: admin,
    organizationId: DEMO_ORGANIZATION_ID,
    userId: ids.owner,
    profile: "owner",
    require: () => undefined,
  } as unknown as TenantContext;
  const { teacherIds } = await runInWorld(ctx, () => buildDemo(new Date()));

  // 4. O usuario professor e o primeiro professor da equipe.
  await admin.from("users").update({ professional_id: teacherIds[0] }).eq("id", ids.professional).throwOnError();
  console.log(`Demonstração pronta: ${DEMO_USERS.map((u) => u.email).join(", ")} (senha em DEMO_PASSWORD).`);
});
