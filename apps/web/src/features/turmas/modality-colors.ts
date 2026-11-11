import type { Category } from "@gestarahub/contracts";

/**
 * Cor de cada modalidade no Calendario (10/11/2026, primeira versao, sem campo
 * no banco). A cor sai da ordem de criacao das modalidades do espaco: a
 * primeira e azul, a segunda verde e assim por diante. Usa todas, inclusive
 * as inativas, para a cor de uma nao mudar quando outra sai. Com mais de 8
 * modalidades a paleta repete. O roxo fica so para Evento.
 * Proximo passo: campo `color` na modalidade com seletor no formulario.
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
}

// Classes literais para o Tailwind encontrar.
const PALETTE: readonly ModalityColor[] = [
  { card: "border-l-blue-500 bg-blue-500/[0.06] hover:bg-blue-500/10", tint: "bg-blue-500/[0.06]", dot: "bg-blue-500", ring: "ring-blue-500/70" },
  { card: "border-l-emerald-500 bg-emerald-500/[0.06] hover:bg-emerald-500/10", tint: "bg-emerald-500/[0.06]", dot: "bg-emerald-500", ring: "ring-emerald-500/70" },
  { card: "border-l-amber-500 bg-amber-500/[0.07] hover:bg-amber-500/12", tint: "bg-amber-500/[0.07]", dot: "bg-amber-500", ring: "ring-amber-500/70" },
  { card: "border-l-rose-500 bg-rose-500/[0.06] hover:bg-rose-500/10", tint: "bg-rose-500/[0.06]", dot: "bg-rose-500", ring: "ring-rose-500/70" },
  { card: "border-l-cyan-500 bg-cyan-500/[0.06] hover:bg-cyan-500/10", tint: "bg-cyan-500/[0.06]", dot: "bg-cyan-500", ring: "ring-cyan-500/70" },
  { card: "border-l-orange-500 bg-orange-500/[0.06] hover:bg-orange-500/10", tint: "bg-orange-500/[0.06]", dot: "bg-orange-500", ring: "ring-orange-500/70" },
  { card: "border-l-lime-500 bg-lime-500/[0.07] hover:bg-lime-500/12", tint: "bg-lime-500/[0.07]", dot: "bg-lime-500", ring: "ring-lime-500/70" },
  { card: "border-l-stone-500 bg-stone-500/[0.06] hover:bg-stone-500/10", tint: "bg-stone-500/[0.06]", dot: "bg-stone-500", ring: "ring-stone-500/70" },
];

/** Sem modalidade: card neutro, como antes. */
export const NEUTRAL_MODALITY_COLOR: ModalityColor = {
  card: "border-l-border bg-background hover:bg-accent",
  tint: "",
  dot: "bg-muted-foreground/40",
  ring: "ring-foreground/40",
};

export const EVENT_COLOR: ModalityColor = {
  card: "border-l-violet-500 bg-violet-500/10 hover:bg-violet-500/15",
  tint: "bg-violet-500/10",
  dot: "bg-violet-500",
  ring: "ring-violet-500/70",
};

/** Nome da modalidade -> cor (as entradas do calendario trazem so o nome). */
export function modalityColorMap(modalities: readonly Category[] | undefined): Map<string, ModalityColor> {
  const ordered = [...(modalities ?? [])].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const map = new Map<string, ModalityColor>();
  ordered.forEach((m, index) => {
    if (!map.has(m.name)) map.set(m.name, PALETTE[index % PALETTE.length]);
  });
  return map;
}
