import type { Category, ModalityColorKey } from "@gestarahub/contracts";
import { modalityColorKeys } from "@gestarahub/core/modality-colors";

/**
 * Cor de cada modalidade no Calendario e na lista de Modalidades. Versao 2
 * (13/11/2026): a cor e guardada na modalidade e escolhida no formulario
 * ("Cor no calendário"); sem cor salva (dado antigo do mock), vale a da ordem
 * de criacao, como na versao 1 (`@gestarahub/core/modality-colors`). O roxo
 * fica so para Evento.
 */
export interface ModalityColor {
  /** Faixa a esquerda e fundo leve do card da grade. */
  card: string;
  /** So o fundo leve (card da lista, cuja faixa vem de `dot`). */
  tint: string;
  /** Cor cheia: bolinha do filtro e faixa do card da lista. */
  dot: string;
  /** Anel da aula que esta acontecendo agora. */
  ring: string;
  /** Avatar de iniciais da modalidade (lista de Modalidades), na mesma cor do Calendario. */
  avatar: string;
}

// Classes literais para o Tailwind encontrar.
export const MODALITY_COLOR_STYLES: Record<ModalityColorKey, ModalityColor> = {
  blue: { card: "border-l-blue-500 bg-blue-500/[0.06] hover:bg-blue-500/10", tint: "bg-blue-500/[0.06]", dot: "bg-blue-500", ring: "ring-blue-500/70", avatar: "border-blue-500/25 bg-blue-500/15 text-blue-800 dark:text-blue-200" },
  emerald: { card: "border-l-emerald-500 bg-emerald-500/[0.06] hover:bg-emerald-500/10", tint: "bg-emerald-500/[0.06]", dot: "bg-emerald-500", ring: "ring-emerald-500/70", avatar: "border-emerald-500/25 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" },
  amber: { card: "border-l-amber-500 bg-amber-500/[0.07] hover:bg-amber-500/12", tint: "bg-amber-500/[0.07]", dot: "bg-amber-500", ring: "ring-amber-500/70", avatar: "border-amber-500/25 bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  rose: { card: "border-l-rose-500 bg-rose-500/[0.06] hover:bg-rose-500/10", tint: "bg-rose-500/[0.06]", dot: "bg-rose-500", ring: "ring-rose-500/70", avatar: "border-rose-500/25 bg-rose-500/15 text-rose-800 dark:text-rose-200" },
  cyan: { card: "border-l-cyan-500 bg-cyan-500/[0.06] hover:bg-cyan-500/10", tint: "bg-cyan-500/[0.06]", dot: "bg-cyan-500", ring: "ring-cyan-500/70", avatar: "border-cyan-500/25 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200" },
  orange: { card: "border-l-orange-500 bg-orange-500/[0.06] hover:bg-orange-500/10", tint: "bg-orange-500/[0.06]", dot: "bg-orange-500", ring: "ring-orange-500/70", avatar: "border-orange-500/25 bg-orange-500/15 text-orange-800 dark:text-orange-200" },
  lime: { card: "border-l-lime-500 bg-lime-500/[0.07] hover:bg-lime-500/12", tint: "bg-lime-500/[0.07]", dot: "bg-lime-500", ring: "ring-lime-500/70", avatar: "border-lime-500/25 bg-lime-500/15 text-lime-800 dark:text-lime-200" },
  stone: { card: "border-l-stone-500 bg-stone-500/[0.06] hover:bg-stone-500/10", tint: "bg-stone-500/[0.06]", dot: "bg-stone-500", ring: "ring-stone-500/70", avatar: "border-stone-500/25 bg-stone-500/15 text-stone-800 dark:text-stone-200" },
  indigo: { card: "border-l-indigo-500 bg-indigo-500/[0.06] hover:bg-indigo-500/10", tint: "bg-indigo-500/[0.06]", dot: "bg-indigo-500", ring: "ring-indigo-500/70", avatar: "border-indigo-500/25 bg-indigo-500/15 text-indigo-800 dark:text-indigo-200" },
  teal: { card: "border-l-teal-500 bg-teal-500/[0.06] hover:bg-teal-500/10", tint: "bg-teal-500/[0.06]", dot: "bg-teal-500", ring: "ring-teal-500/70", avatar: "border-teal-500/25 bg-teal-500/15 text-teal-800 dark:text-teal-200" },
  pink: { card: "border-l-pink-500 bg-pink-500/[0.06] hover:bg-pink-500/10", tint: "bg-pink-500/[0.06]", dot: "bg-pink-500", ring: "ring-pink-500/70", avatar: "border-pink-500/25 bg-pink-500/15 text-pink-800 dark:text-pink-200" },
  red: { card: "border-l-red-500 bg-red-500/[0.06] hover:bg-red-500/10", tint: "bg-red-500/[0.06]", dot: "bg-red-500", ring: "ring-red-500/70", avatar: "border-red-500/25 bg-red-500/15 text-red-800 dark:text-red-200" },
  sky: { card: "border-l-sky-500 bg-sky-500/[0.06] hover:bg-sky-500/10", tint: "bg-sky-500/[0.06]", dot: "bg-sky-500", ring: "ring-sky-500/70", avatar: "border-sky-500/25 bg-sky-500/15 text-sky-800 dark:text-sky-200" },
  yellow: { card: "border-l-yellow-500 bg-yellow-500/[0.07] hover:bg-yellow-500/12", tint: "bg-yellow-500/[0.07]", dot: "bg-yellow-500", ring: "ring-yellow-500/70", avatar: "border-yellow-500/25 bg-yellow-500/15 text-yellow-800 dark:text-yellow-200" },
};

/** Nome de cada cor no seletor (leitor de tela e dica). */
export const MODALITY_COLOR_LABELS: Record<ModalityColorKey, string> = {
  blue: "Azul",
  emerald: "Verde",
  amber: "Amarelo",
  rose: "Rosa",
  cyan: "Azul-claro",
  orange: "Laranja",
  lime: "Verde-limão",
  stone: "Cinza",
  indigo: "Índigo",
  teal: "Verde-água",
  pink: "Pink",
  red: "Vermelho",
  sky: "Azul-céu",
  yellow: "Ouro",
};

/** Sem modalidade: card neutro, como antes. */
export const NEUTRAL_MODALITY_COLOR: ModalityColor = {
  card: "border-l-border bg-background hover:bg-accent",
  tint: "",
  dot: "bg-muted-foreground/40",
  ring: "ring-foreground/40",
  avatar: "border-border/50 bg-muted/60 text-foreground/80",
};

export const EVENT_COLOR: ModalityColor = {
  card: "border-l-violet-500 bg-violet-500/10 hover:bg-violet-500/15",
  tint: "bg-violet-500/10",
  dot: "bg-violet-500",
  ring: "ring-violet-500/70",
  avatar: "border-violet-500/25 bg-violet-500/15 text-violet-800 dark:text-violet-200",
};

/** Nome da modalidade -> cor (as entradas do calendario trazem so o nome). */
export function modalityColorMap(modalities: readonly Category[] | undefined): Map<string, ModalityColor> {
  const keys = modalityColorKeys(modalities ?? []);
  const ordered = [...(modalities ?? [])].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const map = new Map<string, ModalityColor>();
  for (const m of ordered) {
    const key = keys.get(m.id);
    if (key && !map.has(m.name)) map.set(m.name, MODALITY_COLOR_STYLES[key]);
  }
  return map;
}
