/**
 * O "hoje" do servidor no fuso do Brasil: servidor em UTC desenhava a tela com
 * o dia (ou o mes) seguinte depois das 21h, e a hidratacao quebrava contra o
 * navegador. O produto atende o Brasil; com fuso por organizacao no backend,
 * isto sai.
 */
export async function register(): Promise<void> {
  if (!process.env.TZ) process.env.TZ = "America/Sao_Paulo";
  // Servidor dos testes do navegador: mesma data fixa do navegador.
  if (process.env.E2E_NOW && process.env.NEXT_RUNTIME === "nodejs") {
    const { installFixedClock } = await import("./lib/e2e-clock");
    installFixedClock(process.env.E2E_NOW);
  }
}
