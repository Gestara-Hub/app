import { simulateWrite } from "@/mocks/helpers";
import { clearStore, resetStore } from "@/mocks/store";

/**
 * Acoes de sistema do mock (nao mapeiam a API real; existem so para o MVP).
 */
export const systemService = {
  /** Restaura o store ao seed da Corte Nobre e regrava no localStorage. */
  resetData(): Promise<void> {
    return simulateWrite(() => {
      resetStore();
    });
  },

  /** Esvazia o store (mantem org/unidade) — para cadastrar do zero. */
  clearData(): Promise<void> {
    return simulateWrite(() => {
      clearStore();
    });
  },
};
