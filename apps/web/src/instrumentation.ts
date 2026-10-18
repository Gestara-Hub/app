/**
 * O "hoje" do servidor no fuso do Brasil: servidor em UTC desenhava a tela com
 * o dia (ou o mes) seguinte depois das 21h, e a hidratacao quebrava contra o
 * navegador. O produto atende o Brasil; com fuso por organizacao no backend,
 * isto sai.
 */
export function register(): void {
  if (!process.env.TZ) process.env.TZ = "America/Sao_Paulo";
}
