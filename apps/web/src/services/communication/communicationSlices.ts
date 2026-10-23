import type { Id } from "@gestarahub/contracts";
import type { MethodSlice } from "../world/slices";

/**
 * Recortes da comunicacao (doc 19, fase 2): o historico de mensagens de um
 * aluno (ficha) le so as mensagens dele.
 */
const logs: MethodSlice = async ([filter], load) => {
  const clientId = (filter as { clientId?: Id } | undefined)?.clientId;
  await Promise.all([
    clientId ? load.where("messageLogs", "clientId", [clientId]) : load.all("messageLogs"),
    clientId ? load.where("clients", "id", [clientId]) : load.all("clients"),
    load.all("messageTemplates"),
  ]);
};

export const communicationSlices: Record<string, MethodSlice> = {
  listLogs: logs,
  listLogsPaginated: logs,
};
