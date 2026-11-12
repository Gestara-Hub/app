import { NextResponse, type NextRequest } from "next/server";
import { runServiceMethod } from "@/services/world/serviceRunner";

/**
 * Leituras dos servicos da conta real (11/11/2026). As server actions de uma
 * aba rodam uma por vez: uma tela fazia umas 18 leituras em fila e, no 4G
 * fraco, levava de 4 a 5 s so esperando a fila. Por esta rota as leituras saem
 * em paralelo. Mesma porta da action (`runServiceMethod`): sessao, permissao,
 * recorte. As gravacoes continuam pela action.
 *
 * So aceita chamada do proprio site (cookie de sessao + origem igual): uma
 * pagina de fora nao consegue disparar a leitura com o cookie de quem a abriu.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  let body: { method?: unknown; args?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
  }
  if (typeof body.method !== "string" || !Array.isArray(body.args)) {
    return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
  }
  const result = await runServiceMethod(body.method, body.args);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

function sameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
