import { matchScore, stepLabels } from "@/lib/support/guide-match";
import type { GuideStep } from "@/lib/support/help-search";

/**
 * Acha na tela o elemento de um passo do guia pelo texto que a pessoa vê (rótulo
 * do botão, da aba ou do campo), sem `data-` nos componentes: assim cada tela do
 * sistema pode ter guia só escrevendo o artigo. Com janela ou gaveta aberta, a
 * busca começa por ela (o passo é sobre o que está na frente).
 */

const CLICKABLE = 'button, a[href], [role="button"], [role="menuitem"], [role="tab"], [role="option"], [role="radio"], summary, label';
const FIELD_CONTROLS = 'input:not([type="hidden"]), textarea, select, button[role="combobox"], [role="combobox"], [role="switch"], [role="checkbox"]';
const CARD_CONTAINERS = '[data-slot="card"], [data-card], article, [class*="bg-card"]';

const insideGuide = (el: Element) => Boolean(el.closest("[data-guide-ui], [data-product-tour]"));

function visible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

function elementText(el: Element): string {
  return el.getAttribute("aria-label") ?? el.textContent ?? "";
}

function best(candidates: Element[], labels: string[], text: (el: Element) => string = elementText): Element | null {
  let found: Element | null = null;
  let foundScore = 0;
  for (const el of candidates) {
    if (insideGuide(el) || !visible(el)) continue;
    const score = matchScore(text(el), labels);
    if (score > foundScore) {
      found = el;
      foundScore = score;
      if (score === 3) break;
    }
  }
  return found;
}

/** Controle que o rótulo (`label`) nomeia: `for`, o que está dentro dele ou o primeiro controle do bloco. */
function controlOfLabel(label: Element): Element | null {
  const forId = label.getAttribute("for");
  const byId = forId ? document.getElementById(forId) : null;
  if (byId) return byId.matches('input[type="hidden"]') ? null : byId;
  const inside = label.querySelector(FIELD_CONTROLS);
  if (inside) return inside;
  const block = label.closest("div, fieldset, section");
  return block?.querySelector(FIELD_CONTROLS) ?? null;
}

function findField(labels: string[], root: ParentNode): Element | null {
  const labelEl = best([...root.querySelectorAll("label, legend")], labels);
  const viaLabel = labelEl ? controlOfLabel(labelEl) : null;
  if (viaLabel && visible(viaLabel)) return viaLabel;
  const withName = best([...root.querySelectorAll(FIELD_CONTROLS)], labels, (el) => el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? "");
  return withName ?? viaLabel ?? labelEl;
}

/** Fora da barra lateral: "Turmas" como botão da ficha não é o item "Turmas" do menu (esse é o passo `menu`). */
const outsideSidebar = (els: Element[]) => els.filter((el) => !el.closest('[data-sidebar="sidebar"]'));

function findCard(labels: string[], root: ParentNode): Element | null {
  const candidates = [...root.querySelectorAll('[data-slot="card-title"], [data-slot="card-header"], h1, h2, h3, h4, legend, label, th, p, span, div')].filter(
    (el) => matchScore(el.textContent ?? "", labels) > 0 && visible(el) && !insideGuide(el),
  );
  candidates.sort((a, b) => {
    const scoreDiff = matchScore(b.textContent ?? "", labels) - matchScore(a.textContent ?? "", labels);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0);
  });

  for (const textEl of candidates) {
    const card = textEl.closest(CARD_CONTAINERS);
    if (card && visible(card) && !insideGuide(card)) {
      return card;
    }
  }

  const allCards = [...root.querySelectorAll(CARD_CONTAINERS)].filter(
    (el) => visible(el) && !insideGuide(el) && matchScore(el.textContent ?? "", labels) > 0,
  );
  return allCards[0] ?? candidates[0] ?? null;
}

function findIn(step: GuideStep, root: ParentNode): Element | null {
  const labels = stepLabels(step);
  switch (step.kind) {
    case "campo":
      return findField(labels, root);
    case "aba":
      return best(outsideSidebar([...root.querySelectorAll('[role="tab"], [data-slot="tabs-trigger"]')]), labels);
    case "menu":
      return best([...root.querySelectorAll('[data-sidebar="sidebar"] a, [data-sidebar="sidebar"] button, [data-sidebar="menu-button"]')], labels);
    case "item":
      return best(outsideSidebar([...root.querySelectorAll('[role="menuitem"], [role="option"], [role="radio"], [role="row"], li, tr, article')]), labels);
    case "card":
      return findCard(labels, root);
    case "texto": {
      // O menor elemento que carrega o texto: o título, não o bloco todo.
      const all = [...root.querySelectorAll("h1, h2, h3, h4, legend, label, th, p, span, div")].filter((el) => matchScore(el.textContent ?? "", labels) > 0 && visible(el) && !insideGuide(el));
      return all.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0] ?? null;
    }
    default:
      return best(outsideSidebar([...root.querySelectorAll(CLICKABLE)]), labels);
  }
}

/** Camada em primeiro plano (janela ou gaveta aberta), se houver. */
function frontLayer(): Element | null {
  const layers = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter((el) => visible(el) && !insideGuide(el));
  return layers[layers.length - 1] ?? null;
}

export function findGuideElement(step: GuideStep): Element | null {
  const layer = frontLayer();
  if (layer) {
    const inLayer = findIn(step, layer);
    if (inLayer) return inLayer;
  }
  return findIn(step, document);
}
