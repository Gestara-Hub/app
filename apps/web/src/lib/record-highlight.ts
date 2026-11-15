/**
 * Destaque do item recem-criado ou editado (10/11/2026, doc 07). Depois de
 * "Adicionar" ou "Salvar", a linha ou o card com `data-record-id` igual ganha
 * um fundo suave que some em 1,6 s, e a lista rola ate ele se estiver fora da
 * tela. Espera o dialogo fechar e a lista recarregar (ate 6 s); se o item nao
 * estiver na tela (outra pagina, filtro), nao faz nada.
 *
 * Ligado no `mutationCache` (lib/providers): o hook marca a mutacao com
 * `meta: { highlight: true }` (usa `data.id` ou o `id` enviado) ou com uma
 * funcao que devolve o id (ex.: o aluno da cobranca).
 */

const FLASH_MS = 1600;
const WAIT_MS = 6000;
const POLL_MS = 150;
const activeFlashes = new WeakMap<HTMLElement, Animation>();

export type HighlightMeta = boolean | ((data: unknown, variables: unknown) => string | null | undefined);

/** Id do registro salvo: o devolvido pelo servico ou o da edicao. */
export function highlightIdOf(meta: HighlightMeta | undefined, data: unknown, variables: unknown): string | null {
  if (!meta) return null;
  if (typeof meta === "function") return meta(data, variables) ?? null;
  const fromData = (data as { id?: unknown } | null)?.id;
  if (typeof fromData === "string") return fromData;
  const fromVars = (variables as { id?: unknown } | null)?.id;
  return typeof fromVars === "string" ? fromVars : null;
}

function visibleTarget(id: string): HTMLElement | null {
  const selector = `[data-record-id="${CSS.escape(id)}"]`;
  // Lista e grade podem estar as duas no HTML; vale a que aparece.
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((el) => el.getClientRects().length > 0) ?? null;
}

const dialogOpen = () => Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));

function resolveFlashColor(): string {
  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.color = "color-mix(in oklab, var(--success) 16%, transparent)";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || "rgba(34, 197, 94, 0.16)";
}

function flash(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  if (rect.top < 64 || rect.bottom > window.innerHeight) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }

  // Usa Web Animations API para nao sobrescrever nem reativar o `animate-in` CSS da linha.
  if (typeof el.animate !== "function") return;
  activeFlashes.get(el)?.cancel();
  const color = resolveFlashColor();
  const anim = el.animate(
    [
      { boxShadow: `inset 0 0 0 9999px ${color}`, offset: 0 },
      { boxShadow: `inset 0 0 0 9999px ${color}`, offset: 0.35 },
      { boxShadow: "inset 0 0 0 9999px transparent", offset: 1 },
    ],
    { duration: FLASH_MS, easing: "ease-out" },
  );
  activeFlashes.set(el, anim);
  anim.addEventListener(
    "finish",
    () => {
      if (activeFlashes.get(el) === anim) activeFlashes.delete(el);
    },
    { once: true },
  );
}

export function highlightRecord(id: string | null | undefined): void {
  if (!id || typeof window === "undefined") return;
  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (Date.now() - startedAt > WAIT_MS) {
      window.clearInterval(timer);
      return;
    }
    if (dialogOpen()) return;
    const el = visibleTarget(id);
    if (!el) return;
    window.clearInterval(timer);
    flash(el);
  }, POLL_MS);
}
