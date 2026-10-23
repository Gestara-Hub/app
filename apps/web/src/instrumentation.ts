/**
 * O "hoje" do servidor no fuso do Brasil: servidor em UTC desenhava a tela com
 * o dia (ou o mes) seguinte depois das 21h, e a hidratacao quebrava contra o
 * navegador. O produto atende o Brasil; com fuso por organizacao no backend,
 * isto sai.
 */
export async function register(): Promise<void> {
  if (!process.env.TZ) process.env.TZ = "America/Sao_Paulo";
  // Erros do servidor vao para a tabela error_logs (doc technical/21).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ setErrorScopeRunner, setErrorSink }, { recordErrorToDb, runWithErrorScope }] = await Promise.all([
      import("./lib/log"),
      import("./lib/log/server-sink"),
    ]);
    setErrorSink(recordErrorToDb);
    setErrorScopeRunner(runWithErrorScope);
  }
  // Servidor dos testes do navegador: mesma data fixa do navegador.
  if (process.env.E2E_NOW && process.env.NEXT_RUNTIME === "nodejs") {
    const { installFixedClock } = await import("./lib/e2e-clock");
    installFixedClock(process.env.E2E_NOW);
  }
}

/**
 * Erro que escapou de uma rota, pagina ou acao (o Next chama aqui): vai para
 * o mesmo registro, com a rota.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("./lib/log");
  await reportError(`next.${context.routeType}`, error, {
    context: { path: request.path, method: request.method, route: context.routePath, router: context.routerKind },
  });
}
