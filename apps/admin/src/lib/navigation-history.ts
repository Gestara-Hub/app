/**
 * Rotas visitadas dentro do app, para o "Voltar" saber se ha para onde voltar
 * sem sair do sistema. Pilha em memoria: abrir a pagina direto ou recarregar
 * comeca vazia (o "Voltar" usa o destino padrao da tela).
 *
 * So o voltar do navegador (popstate) tira o topo da pilha. Ir para a frente
 * para a mesma tela de antes (turma > ficha > a turma pelo link) empilha: o
 * "Voltar" depois volta para a ficha, nao para Turmas.
 */
const stack: string[] = [];
let popPending = false;

/** O navegador voltou ou avancou (popstate): a proxima rota vem do historico. */
export function markHistoryPop(): void {
  popPending = true;
}

export function recordNavigation(path: string): void {
  const popped = popPending;
  popPending = false;
  if (stack.at(-1) === path) return;
  if (popped && stack.at(-2) === path) {
    stack.pop();
    return;
  }
  stack.push(path);
}

/** Ha uma rota do app antes da atual. */
export function hasPreviousRoute(): boolean {
  return stack.length > 1;
}

/** So para testes. */
export function resetNavigationHistory(): void {
  stack.length = 0;
  popPending = false;
}
