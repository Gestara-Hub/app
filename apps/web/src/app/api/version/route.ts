import { APP_COMMIT, APP_VERSION } from "@/config/release";

/**
 * Versao publicada agora (25/11/2026): o app aberto compara com a que carregou
 * e avisa "Nova versão disponível" (`NewVersionNotice`). Publica, sem cache e
 * sem dado nenhum alem do numero da versao e do commit curto.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { version: APP_VERSION, commit: APP_COMMIT },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
