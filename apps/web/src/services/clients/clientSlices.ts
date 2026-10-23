import type { MethodSlice } from "../world/slices";

/**
 * Recortes dos metodos de alunos (doc 19, fase 2). A lista de alunos so le o
 * cadastro dos alunos (sem presencas, cobrancas ou mensagens).
 */
const clientsOnly: MethodSlice = async (_args, load) => {
  await load.all("clients");
};

export const clientSlices: Record<string, MethodSlice> = {
  list: clientsOnly,
  listPaginated: clientsOnly,
};
