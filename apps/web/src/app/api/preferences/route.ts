import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "@/lib/session";
import { getUserPreferencesFromDb, saveUserPreferencesInDb } from "@/services/preferences/preferencesBackend";
import { DEFAULT_USER_PREFERENCES } from "@gestarahub/contracts";
import { logError } from "@/lib/log";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const rawSession = cookieStore.get(SESSION_COOKIE)?.value;
    const session = decodeSession(rawSession);

    if (!session?.id) {
      return NextResponse.json({ preferences: DEFAULT_USER_PREFERENCES });
    }

    const preferences = await getUserPreferencesFromDb(session.id);
    return NextResponse.json({ preferences: preferences ?? DEFAULT_USER_PREFERENCES });
  } catch (error) {
    logError("[GET /api/preferences] Erro:", error);
    return NextResponse.json({ preferences: DEFAULT_USER_PREFERENCES });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const rawSession = cookieStore.get(SESSION_COOKIE)?.value;
    const session = decodeSession(rawSession);

    if (!session?.id) {
      return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
    }

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

    const updated = await saveUserPreferencesInDb(session.id, payload);
    return NextResponse.json({ success: true, preferences: updated });
  } catch (error) {
    logError("[POST /api/preferences] Erro ao salvar preferências:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao salvar preferências." },
      { status: 500 },
    );
  }
}
