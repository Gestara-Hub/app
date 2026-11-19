import { after } from "next/server";
import { logError } from "@/lib/log";

/**
 * Roda a tarefa depois da resposta (Next `after`): a tela nao espera e-mail,
 * Asaas ou Meta que nao mudam o que ela mostra. Fora de uma requisicao
 * (testes, scripts), roda na hora. Falha so vai para o registro de erros.
 */
export async function afterResponse(label: string, task: () => Promise<unknown>): Promise<void> {
  const run = async () => {
    try {
      await task();
    } catch (err) {
      logError(`[afterResponse] ${label} falhou:`, err);
    }
  };
  try {
    after(run);
  } catch {
    await run();
  }
}
