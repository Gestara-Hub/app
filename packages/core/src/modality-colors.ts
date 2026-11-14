import type { ModalityColorKey } from "@gestarahub/contracts";

/** As cores, na ordem da versao 1 (cor pela ordem de criacao). O roxo fica so para Evento. */
export const MODALITY_COLORS: readonly ModalityColorKey[] = ["blue", "emerald", "amber", "rose", "cyan", "orange", "lime", "stone"];

export function isModalityColor(value: unknown): value is ModalityColorKey {
  return typeof value === "string" && (MODALITY_COLORS as readonly string[]).includes(value);
}

/**
 * Cor de cada modalidade (doc product/29 §Calendario, versao 2): a salva na
 * modalidade ou, sem ela (dado antigo), a da ordem de criacao, como na versao
 * 1. A migracao 100 grava essa mesma cor nas modalidades que ja existiam.
 */

interface ColorSource {
  id: string;
  createdAt: string;
  color?: ModalityColorKey;
}

/** Id da modalidade -> cor (todas, inclusive as inativas, para a cor de uma nao mudar quando outra sai). */
export function modalityColorKeys(list: readonly ColorSource[]): Map<string, ModalityColorKey> {
  const ordered = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return new Map(ordered.map((m, index) => [m.id, m.color ?? MODALITY_COLORS[index % MODALITY_COLORS.length]]));
}

/** Cor da modalidade nova: a primeira que nenhuma usa; todas usadas, segue a ordem. */
export function nextModalityColor(list: readonly ColorSource[]): ModalityColorKey {
  const used = new Set(modalityColorKeys(list).values());
  return MODALITY_COLORS.find((c) => !used.has(c)) ?? MODALITY_COLORS[list.length % MODALITY_COLORS.length];
}
