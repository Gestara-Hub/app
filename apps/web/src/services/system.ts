import { simulateWrite } from "@/mocks/helpers";
import { resetStore } from "@/mocks/store";

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
};
