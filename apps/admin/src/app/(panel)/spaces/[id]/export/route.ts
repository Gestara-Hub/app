import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/context";
import { PrivacyError, exportSpace } from "@/lib/server/privacy";

/**
 * Exporta os dados do espaco em JSON (pedido do titular de acesso/portabilidade).
 * So POST, com motivo, so quem tem `lgpd:manage`; a funcao do banco registra na
 * Auditoria do espaco e na do painel. Nada fica guardado no servidor.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { admin } = await requireAdmin("lgpd:manage");
  const { id } = await params;
  const reason = String((await request.formData()).get("reason") ?? "").trim();
  if (reason.length < 5) return NextResponse.json({ error: "Diga o motivo (pelo menos 5 letras)." }, { status: 400 });
  try {
    const data = await exportSpace({ organizationId: id, reason, admin: { id: admin.id, name: admin.name } });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="espaco-${id.slice(0, 8)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PrivacyError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
