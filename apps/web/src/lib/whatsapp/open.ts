/**
 * Abrir o WhatsApp do aparelho (envio assistido).
 *
 * Com o app instalado (PWA, `display-mode: standalone`), `window.open(..., "_blank")`
 * abre uma janela nova do proprio app: o WhatsApp abre por cima e, na volta,
 * a pessoa cai nessa janela em branco, sem caminho de volta para a tela em que
 * estava (17/11/2026). No app instalado, a navegacao vai na mesma janela: o
 * sistema entrega o endereco do WhatsApp ao aplicativo (ou a uma folha do
 * navegador por cima) e o app fica intacto por baixo. No navegador comum segue
 * a aba nova.
 */

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function openWhatsApp(url: string): void {
  if (isStandaloneApp()) {
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
