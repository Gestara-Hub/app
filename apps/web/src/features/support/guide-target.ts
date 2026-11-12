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

/** Elementos visíveis que carregam o texto, do menor para o maior (fora da barra lateral). */
function textCandidates(labels: string[], root: ParentNode): Element[] {
  const all = outsideSidebar([...root.querySelectorAll("h1, h2, h3, h4, legend, label, th, p, span, div")]).filter(
    (el) => matchScore(el.textContent ?? "", labels) > 0 && visible(el) && !insideGuide(el),
  );
  return all.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));
}

function smallestWithText(labels: string[], root: ParentNode): Element | null {
  return textCandidates(labels, root)[0] ?? null;
}

const SECTION_STOP = '[role="dialog"], [role="alertdialog"], main, body, [data-slot="sidebar-inset"]';
const SECTION_CONTENT = `${FIELD_CONTROLS}, ${CLICKABLE}, [data-guide-list], [data-record-id], table, ul, ol, img`;

/**
 * Sobe do texto até o menor bloco que tem conteúdo embaixo dele (campo, opções,
 * lista). Botão na mesma linha do título não conta, e o bloco não passa de 80%
 * da altura da tela. Sem bloco assim, fica o próprio texto.
 */
function sectionOf(textEl: Element): Element {
  const textBottom = textEl.getBoundingClientRect().bottom;
  const maxHeight = window.innerHeight * 0.8;
  let node = textEl.parentElement;
  while (node && !node.matches(SECTION_STOP)) {
    if (node.getBoundingClientRect().height > maxHeight) break;
    const hasContentBelow = [...node.querySelectorAll(SECTION_CONTENT)].some(
      (el) => !el.contains(textEl) && !textEl.contains(el) && visible(el) && el.getBoundingClientRect().top >= textBottom - 2,
    );
    if (hasContentBelow) return node;
    node = node.parentElement;
  }
  return textEl;
}

/** A lista mais perto do texto: marcada com `data-guide-list` ou, sem ela, o bloco das linhas (`data-record-id`). */
function listNear(textEl: Element): Element | null {
  let node = textEl.parentElement;
  while (node) {
    const marked = [...node.querySelectorAll("[data-guide-list]")].find((el) => visible(el) && !insideGuide(el));
    const list = marked ?? [...node.querySelectorAll("[data-record-id]")].find(visible)?.parentElement ?? null;
    if (list && visible(list)) return list;
    if (node.matches(SECTION_STOP)) break;
    node = node.parentElement;
  }
  return null;
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
      // O bloco do texto (11/11/2026): o título junto com o que vem embaixo dele
      // (campo, opções, lista), não só a palavra.
      const textEl = smallestWithText(labels, root);
      return textEl ? sectionOf(textEl) : null;
    }
    case "lista": {
      // A lista perto do texto (contador "N alunos", título da tela): a pessoa escolhe um item nela.
      for (const textEl of textCandidates(labels, root)) {
        const list = listNear(textEl);
        if (list) return list;
      }
      return null;
    }
    default:
      return best(outsideSidebar([...root.querySelectorAll(CLICKABLE)]), labels);
  }
}

/** Janelas e gavetas abertas (Radix), sem as que estão fechando. */
export function openLayers(): Element[] {
  return [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(
    (el) => visible(el) && !insideGuide(el) && el.getAttribute("data-state") !== "closed",
  );
}

/**
 * Acha o elemento do passo. Com janela ou gaveta aberta, procura SÓ nela
 * (11/11/2026): antes caía na tela de trás e destacava o "Nome" da lista
 * enquanto o cadastro ainda nem tinha aberto. O menu lateral é a exceção.
 */
export function findGuideElement(step: GuideStep): Element | null {
  const layers = openLayers();
  const layer = layers[layers.length - 1];
  if (layer && step.kind !== "menu") return findIn(step, layer);
  return findIn(step, document);
}
