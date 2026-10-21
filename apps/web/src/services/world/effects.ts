/**
 * Efeitos fora do banco (Asaas, WhatsApp) pedidos por um servico rodando no
 * espaco da requisicao: so acontecem depois que a gravacao no banco der certo
 * (doc 15, fatia 2). Fora do servidor, `afterWorldCommit` devolve false e quem
 * chamou segue o caminho antigo. Sem imports do Node: os servicos usam no
 * navegador tambem.
 */

export type WorldEffect = () => Promise<void>;

let queueOf: (() => WorldEffect[] | undefined) | null = null;

export function setEffectsResolver(resolver: () => WorldEffect[] | undefined): void {
  queueOf = resolver;
}

/** Agenda o efeito para depois da gravacao. False = nao esta no servidor. */
export function afterWorldCommit(effect: WorldEffect): boolean {
  const queue = queueOf?.();
  if (!queue) return false;
  queue.push(effect);
  return true;
}
