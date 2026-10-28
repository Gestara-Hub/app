import type { MessageLog, MessageLogFilter, PaginatedResult } from "@gestarahub/contracts";
import { delegateAll, realAccountInBrowser } from "../world/delegate";
import { listMessageLogPage } from "./messagesBackend";
import { connectionService } from "./connectionService";
import { templatesService } from "./templatesService";
import { messagesService } from "./messagesService";
import { remindersService } from "./remindersService";

export { connectionService, templatesService, messagesService };
export { whatsappClient } from "./whatsappClient";
export { processWhatsAppStatusUpdate, handleWhatsAppWebhookPayload } from "./whatsappWebhook";
export { messageKindMatches } from "./messagesService";

/** Objeto legado: os mesmos metodos de antes, compostos dos sub-servicos. */
export const communicationServiceImpl = {
  ...connectionService,
  ...templatesService,
  ...messagesService,
  ...remindersService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const communicationService = delegateAll("communication", communicationServiceImpl);

/**
 * Uma pagina do historico de mensagens. Conta real: filtros e paginacao no
 * banco (sem carregar o historico inteiro); espaco local: o mesmo filtro em memoria.
 */
export function messageLogsPage(filter?: MessageLogFilter): Promise<PaginatedResult<MessageLog>> {
  if (realAccountInBrowser()) return listMessageLogPage(filter);
  return communicationService.listLogsPaginated(filter);
}
