import type { Id } from "@gestarahub/contracts";
import type { MethodSlice } from "../world/slices";

/**
 * Recortes da comunicacao (doc 19, fases 2 e 3): o historico de um aluno (ficha)
 * le so as mensagens dele; o de um gatilho (painel: parabens, faltas, pacote
 * acabando), so as daquele gatilho. A leitura nao grava mais (os parabens
 * sairam para a rotina), entao nao precisa dos alunos nem dos modelos.
 */
const logs: MethodSlice = async ([filter], load) => {
  const { clientId, trigger } = (filter as { clientId?: Id; trigger?: string } | undefined) ?? {};
  if (clientId) await load.where("messageLogs", "clientId", [clientId]);
  else if (trigger && trigger !== "all") await load.where("messageLogs", "trigger", [trigger]);
  else await load.all("messageLogs");
};

export const communicationSlices: Record<string, MethodSlice> = {
  listLogs: logs,
  listLogsPaginated: logs,
};
