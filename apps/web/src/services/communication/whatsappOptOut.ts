import type { SupabaseClient } from "@supabase/supabase-js";
import { whatsappNumber } from "@/lib/whatsapp";
import { recordSystemAudit } from "@/services/server/systemAudit";

/**
 * Opt-out pelo WhatsApp (12/11/2026, doc product/27 M2): quem responde "SAIR",
 * "PARAR" ou "CANCELAR" deixa de receber o envio oficial do espaco que mandou a
 * mensagem. A autorizacao do aluno vira "pediu para parar" e a Auditoria
 * registra, com o autor "Sistema". Responsavel que responde vale para os
 * alunos de quem e responsavel. Modulo so do servidor (chave de servico).
 */

const OPT_OUT_WORDS = new Set(["sair", "parar", "pare", "cancelar", "stop", "descadastrar"]);

/** A mensagem e um pedido para parar? So a palavra, sem diferenciar maiuscula, acento ou pontuacao. */
export function isOptOutText(text: string | undefined): boolean {
  if (!text) return false;
  const word = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return OPT_OUT_WORDS.has(word);
}

/**
 * Mesmo numero, com ou sem o 9 do celular: a Meta as vezes manda o numero
 * brasileiro sem o 9 (55 + DDD + 8 digitos).
 */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = whatsappNumber(a);
  const y = whatsappNumber(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = (n: string) => (n.startsWith("55") && n.length === 13 && n[4] === "9" ? n.slice(0, 4) + n.slice(5) : n);
  return short(x) === short(y);
}

interface ClientRow {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  guardians: { phone?: string | null }[] | null;
  whatsapp_consent_status: string | null;
}

/** Espacos que falam com essa pessoa por este numero do WhatsApp. */
async function spacesFor(
  admin: SupabaseClient,
  from: string,
  businessNumber: string | undefined,
  organizationId?: string | null,
): Promise<string[]> {
  // Numero do proprio espaco (doc technical/07 §1.1): o aviso ja diz de quem e.
  if (organizationId) return [organizationId];
  if (businessNumber) {
    const { data } = await admin.from("whatsapp_connections").select("organization_id, phone_number");
    const owners = (data ?? [])
      .filter((row) => samePhone(String(row.phone_number ?? ""), businessNumber))
      .map((row) => String(row.organization_id));
    if (owners.length > 0) return owners;
  }
  // Numero da plataforma (sem conexao por espaco): quem mandou mensagem a essa
  // pessoa nos ultimos 90 dias.
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data } = await admin
    .from("message_logs")
    .select("organization_id, recipient_phone")
    .gte("sent_at", since)
    .limit(5000);
  return [
    ...new Set(
      (data ?? []).filter((row) => samePhone(String(row.recipient_phone ?? ""), from)).map((row) => String(row.organization_id)),
    ),
  ];
}

/**
 * Marca "pediu para parar" nos alunos desse numero (o aluno ou o responsavel)
 * nos espacos que falam com ele. Devolve quantos alunos mudaram.
 */
export async function applyWhatsAppOptOut(
  admin: SupabaseClient,
  input: { from: string; organizationId?: string | null; businessNumber?: string; now?: Date },
): Promise<number> {
  const organizations = await spacesFor(admin, input.from, input.businessNumber, input.organizationId);
  if (organizations.length === 0) return 0;
  const { data, error } = await admin
    .from("clients")
    .select("id, organization_id, name, phone, guardians, whatsapp_consent_status")
    .in("organization_id", organizations);
  if (error) throw error;
  const matches = ((data ?? []) as ClientRow[]).filter(
    (row) =>
      row.whatsapp_consent_status !== "revoked" &&
      (samePhone(row.phone, input.from) || (row.guardians ?? []).some((g) => samePhone(g?.phone, input.from))),
  );
  const at = (input.now ?? new Date()).toISOString();
  for (const row of matches) {
    const { error: updateError } = await admin
      .from("clients")
      .update({ whatsapp_consent_status: "revoked", whatsapp_consent_at: at, whatsapp_consent_by: 'Pedido pelo WhatsApp ("SAIR")' })
      .eq("id", row.id)
      .eq("organization_id", row.organization_id);
    if (updateError) throw updateError;
    await recordSystemAudit(admin, "system", {
      organizationId: row.organization_id,
      action: "updated",
      target: { type: "client", id: row.id, label: row.name },
      predicate: `parou as mensagens pelo WhatsApp para ${row.name} (respondeu "SAIR")`,
      changes: [{ field: "whatsappConsentStatus", label: "Aceita mensagens pelo WhatsApp", before: "Sim", after: "Não" }],
    });
  }
  return matches.length;
}
