import { NextRequest, NextResponse } from "next/server";
import { getMyPreferencesAction, saveMyPreferencesAction } from "@/services/preferences/preferencesBackend";
import { DEFAULT_USER_PREFERENCES } from "@gestarahub/contracts";
import { logError } from "@/lib/log";
import { isApiError } from "@gestarahub/contracts";

export async function GET() {
  try {
    // O usuario vem da sessao do Supabase, nao do cookie do app (auditoria de 30/10/2026).
    const preferences = await getMyPreferencesAction();
    return NextResponse.json({ preferences: preferences ?? DEFAULT_USER_PREFERENCES });
  } catch (error) {
    logError("[GET /api/preferences] Erro:", error);
    return NextResponse.json({ preferences: DEFAULT_USER_PREFERENCES });
  }
}

export async function POST(req: NextRequest) {
  try {
    let payload: Record<string, unknown> = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        payload = {};
      }
    }

    const updated = await saveMyPreferencesAction(payload);
    if (!updated) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
    return NextResponse.json({ success: true, preferences: updated });
  } catch (error) {
    // Sem sessao do banco (demonstracao): as preferencias ficam so no navegador.
    if (isApiError(error) && error.code === "FORBIDDEN") {
      return NextResponse.json({ message: "Sem sessão." }, { status: 401 });
    }
    logError("[POST /api/preferences] Erro ao salvar preferências:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao salvar preferências." },
      { status: 500 },
    );
  }
}
