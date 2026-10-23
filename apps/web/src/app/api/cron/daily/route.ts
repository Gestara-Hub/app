import { NextResponse } from "next/server";
import { selectAllRows } from "@/lib/supabase/select-all";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { materializeRecurrencesAction } from "@/services/finance/financeBackend";
import { generateMembershipChargesAction } from "@/services/billing/membershipBackend";

/**
 * Tarefas diarias de todos os espacos de turmas (doc 15, fatia 1), chamadas
 * pelo Supabase Cron (migracoes 26 e 27) para nao depender de alguem abrir o
 * app: mensalidades automaticas e lancamentos das recorrencias do Financeiro.
 * Protegida por CRON_SECRET no cabecalho Authorization. Idempotente: rodar
 * duas vezes no dia nao duplica (indices unicos das migracoes 25 e 27).
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
  const { data: orgs, error } = await selectAllRows(() =>
    admin.from("organizations").select("id").eq("model", "classes").eq("status", "active"),
  );
  if (error) {
    console.error("[cron:daily] Erro ao listar os espaços:", error);
    return NextResponse.json({ error: "Erro ao listar os espaços." }, { status: 500 });
  }

  const result = { organizations: orgs?.length ?? 0, membershipCharges: 0, recurrenceEntries: 0, failures: 0 };
  for (const org of orgs ?? []) {
    const id = String(org.id);
    // Uma tarefa ou um espaco com problema nao impede os outros; o dia seguinte tenta de novo.
    try {
      result.membershipCharges += await generateMembershipChargesAction(id);
    } catch (err) {
      console.error(`[cron:daily] Mensalidades falharam no espaço ${id}:`, err);
      result.failures += 1;
    }
    try {
      result.recurrenceEntries += await materializeRecurrencesAction(id);
    } catch (err) {
      console.error(`[cron:daily] Recorrências falharam no espaço ${id}:`, err);
      result.failures += 1;
    }
  }

  console.info("[cron:daily]", JSON.stringify(result));
  return NextResponse.json(result);
}
