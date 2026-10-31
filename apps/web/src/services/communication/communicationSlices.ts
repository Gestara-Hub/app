import type { ClassGroup, Id } from "@gestarahub/contracts";
import { addDays, format, subDays } from "date-fns";
import { billingWorld } from "../billing/billingSlices";
import { sessionIdsInRange } from "../classes/classSlices";
import { REMINDER_TRIGGERS } from "./remindersService";
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

/** Faltas seguidas: so as marcacoes das aulas dos ultimos 120 dias (muda so uma sequencia de mais de 4 meses). */
const STREAK_WINDOW_DAYS = 120;

/**
 * Lembretes (doc product/25): o espaco das cobrancas, as presencas recentes,
 * as mensagens dos tipos com lembrete, os modelos e as substituicoes (o
 * professor ve as faltas dos alunos das turmas em que substitui).
 */
const reminderSources: MethodSlice = async (_args, load) => {
  await billingWorld(load);
  const groups = (await load.all("classGroups")) as unknown as ClassGroup[];
  const today = new Date();
  const ids = sessionIdsInRange(
    groups,
    format(subDays(today, STREAK_WINDOW_DAYS), "yyyy-MM-dd"),
    format(addDays(today, 1), "yyyy-MM-dd"),
  );
  await Promise.all([
    load.where("attendances", "sessionId", ids),
    load.where("messageLogs", "trigger", REMINDER_TRIGGERS),
    load.all("messageTemplates"),
    load.all("sessionOverrides"),
  ]);
};

export const communicationSlices: Record<string, MethodSlice> = {
  listLogs: logs,
  listLogsPaginated: logs,
  getReminderSources: reminderSources,
};
