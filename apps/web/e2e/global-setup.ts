import { admin } from "./db";
import { selectAllRows } from "../src/lib/supabase/select-all";

/**
 * Antes da rodada: apaga os espacos de teste que sobraram de rodadas
 * interrompidas (usuarios `e2e-…@gestarahub.test`). Com ids fixos nos
 * cenarios ("c-a", "pr-1"), sobra de um teste contaminava o seguinte (doc 20).
 * Nunca toca em espacos de gente de verdade.
 */
export default async function globalSetup(): Promise<void> {
  const db = admin();
  const { data: users, error } = await selectAllRows(() =>
    db.from("users").select("id, organization_id").like("email", "e2e-%@gestarahub.test"),
  );
  if (error) throw new Error(`Limpeza dos e2e: ${error.message}`);
  const orgs = [...new Set(users.map((u) => String(u.organization_id)))];
  // Uma exclusao so: sobras ligadas entre si saem juntas.
  for (let i = 0; i < orgs.length; i += 200) {
    const { error: deleteError } = await db.from("organizations").delete().in("id", orgs.slice(i, i + 200));
    if (deleteError) throw new Error(`Limpeza dos e2e: ${deleteError.message}`);
  }
  // Contas de login dos testes.
  for (let page = 1; ; page++) {
    const { data, error: listError } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError) throw new Error(`Limpeza dos e2e: ${listError.message}`);
    const leftovers = data.users.filter((u) => /^e2e-.*@gestarahub\.test$/.test(u.email ?? ""));
    for (const u of leftovers) await db.auth.admin.deleteUser(u.id);
    if (data.users.length < 1000) break;
  }
  if (orgs.length > 0) console.log(`[e2e] ${orgs.length} espaço(s) de teste antigos apagados.`);
}
