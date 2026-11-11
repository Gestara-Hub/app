"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

/**
 * Barra fina no topo enquanto o servidor responde a troca de rota. As paginas
 * de (app) sao dinamicas (sessao e permissao no server): sem este arquivo o
 * Next so troca de tela quando a pagina inteira chega, e no 3G o clique fica
 * parado. Com ele, a troca e imediata. Uma barra so para todas as telas (lista,
 * painel, detalhe, calendario), sem prometer um formato: o skeleton de cada
 * tela entra quando a pagina chega. Mesma barra da lista ao atualizar
 * (`list-refresh-bar` em globals.css): aparece depois de 250 ms, entao troca
 * rapida nao mostra nada, e fica parada para quem prefere menos movimento.
 *
 * Vai para o body por portal: o template de (app) anima a entrada com
 * `transform`, e ancestral com transform prende o `fixed` nele (a barra
 * aparecia no topo do conteudo e depois pulava para o topo da janela).
 */
export default function AppLoading() {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Carregando</span>
      {isClient
        ? createPortal(
            <div
              aria-hidden
              className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
            >
              <div className="list-refresh-bar h-full w-1/4 rounded-full bg-primary" />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
