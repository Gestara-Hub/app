import { delegateAll } from "../world/delegate";
import { connectionService } from "./connectionService";
import { templatesService } from "./templatesService";
import { messagesService } from "./messagesService";

export { connectionService, templatesService, messagesService };

/** Objeto legado: os mesmos metodos de antes, compostos dos sub-servicos. */
export const communicationServiceImpl = {
  ...connectionService,
  ...templatesService,
  ...messagesService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const communicationService = delegateAll("communication", communicationServiceImpl);
