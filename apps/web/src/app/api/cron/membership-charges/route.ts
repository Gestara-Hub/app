import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateMembershipChargesAction } from "@/services/membershipBackend";

/**
 * Geracao diaria das mensalidades de todos os espacos de turmas (doc 15,
 * fatia 1), chamada pelo Supabase Cron (migracao 26) para nao depender de
 * alguem abrir o app. Protegida por CRON_SECRET no cabecalho Authorization.
 * Idempotente: rodar duas vezes no dia nao duplica (indice unico, migracao 25).
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id")
    .eq("model", "classes")
    .eq("status", "active");
  if (error) {
    console.error("[cron:membership-charges] Erro ao listar os espaços:", error);
    return NextResponse.json({ error: "Erro ao listar os espaços." }, { status: 500 });
  }

  let created = 0;
  const failures: string[] = [];
  for (const org of orgs ?? []) {
    try {
      created += await generateMembershipChargesAction(String(org.id));
    } catch (err) {
      // Um espaco com problema nao impede os outros; o proximo dia tenta de novo.
      console.error(`[cron:membership-charges] Falha no espaço ${org.id}:`, err);
      failures.push(String(org.id));
    }
  }

  console.info(
    `[cron:membership-charges] ${orgs?.length ?? 0} espaços, ${created} mensalidades criadas, ${failures.length} falhas.`,
  );
  return NextResponse.json({ organizations: orgs?.length ?? 0, created, failures: failures.length });
}
