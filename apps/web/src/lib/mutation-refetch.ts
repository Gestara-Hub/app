import { QueryClient, type InvalidateOptions, type InvalidateQueryFilters } from "@tanstack/react-query";

/**
 * Gravacao so termina com a tela atualizada (27/11/2026, doc 07 §2.11). Antes o
 * hook invalidava as consultas e a gravacao ja dava por concluida: o toast
 * aparecia e o botao saia de "Salvando..." com a lista ainda velha (ex.: aluno
 * que continuava na turma por alguns segundos depois de "Matrícula cancelada.").
 *
 * O `QueryClient` do app guarda as releituras pedidas enquanto uma gravacao
 * termina (do `onSuccess` do cache ao `onSettled` do cache, que o TanStack
 * espera antes de dar a gravacao por concluida) e o cache espera por elas. So
 * as consultas na tela releem (`refetchType: "active"`, o padrao); as demais
 * ficam marcadas e releem ao abrir. Com teto: uma leitura lenta nao prende o
 * botao para sempre.
 */
export const MUTATION_REFETCH_CAP_MS = 10_000;

export class AppQueryClient extends QueryClient {
  #collectors = new Map<object, Promise<unknown>[]>();

  override invalidateQueries(filters?: InvalidateQueryFilters, options?: InvalidateOptions): Promise<void> {
    const refetch = super.invalidateQueries(filters, options);
    for (const pending of this.#collectors.values()) pending.push(refetch);
    return refetch;
  }

  /** Comeca a guardar as releituras desta gravacao. */
  startCollecting(mutation: object): void {
    this.#collectors.set(mutation, []);
  }

  /** Espera as releituras guardadas (no maximo `capMs`) e para de guardar. */
  async waitCollected(mutation: object, capMs = MUTATION_REFETCH_CAP_MS): Promise<void> {
    const pending = this.#collectors.get(mutation);
    this.#collectors.delete(mutation);
    if (!pending || pending.length === 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cap = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, capMs);
    });
    try {
      await Promise.race([Promise.allSettled(pending), cap]);
    } finally {
      clearTimeout(timer);
    }
  }
}
