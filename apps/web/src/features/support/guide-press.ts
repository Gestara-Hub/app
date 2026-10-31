/**
 * "Fazer por mim" do guia na tela: clica no destaque como a pessoa clicaria,
 * para o guia nunca seguir sem a tela ter reagido (janela aberta, menu aberto,
 * aba trocada). Menus e listas (Radix) abrem ao apertar (`pointerdown`), abas
 * ao pressionar (`mousedown`) e botoes e links no clique: a sequencia inteira
 * cobre os tres sem abrir duas vezes.
 */
export const PRESS_SEQUENCE = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const;

/** Botao desligado: apertar nao faria nada, e o guia seguiria sem a tela mudar. */
export function isGuideTargetDisabled(el: Element): boolean {
  return el.matches(":disabled, [aria-disabled='true'], [data-disabled]");
}

export function pressGuideTarget(el: HTMLElement): void {
  el.scrollIntoView({ block: "center", inline: "nearest" });
  const rect = el.getBoundingClientRect();
  const position = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
  for (const type of PRESS_SEQUENCE) {
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
      buttons: type.endsWith("down") ? 1 : 0,
      ...position,
    };
    el.dispatchEvent(
      type.startsWith("pointer")
        ? new PointerEvent(type, { ...init, pointerId: 1, pointerType: "mouse", isPrimary: true })
        : new MouseEvent(type, init),
    );
  }
}
