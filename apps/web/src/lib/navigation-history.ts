/**
 * Rotas visitadas dentro do app, para o "Voltar" saber se ha para onde voltar
 * sem sair do sistema. Pilha em memoria: abrir a pagina direto ou recarregar
 * comeca vazia (o "Voltar" usa o destino padrao da tela).
 *
 * Voltar no navegador chega na penultima rota da pilha: ela sai do topo.
 */
const stack: string[] = [];

export function recordNavigation(path: string): void {
  if (stack.at(-1) === path) return;
  if (stack.at(-2) === path) {
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
}
