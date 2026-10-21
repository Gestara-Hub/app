import { delegateAll } from "../world/delegate";
import { clientBaseService } from "./clientBaseService";
import { clientLifecycleService } from "./clientLifecycleService";
import { clientProgressionService } from "./clientProgressionService";
import { clientRecordsService } from "./clientRecordsService";

export { clientBaseService, clientLifecycleService, clientProgressionService, clientRecordsService };

/** Os sub-servicos de alunos numa unica API (a regra, sem delegar). */
export const clientsServiceImpl = {
  ...clientBaseService,
  ...clientLifecycleService,
  ...clientProgressionService,
  ...clientRecordsService,
};

/**
 * Objeto legado. Conta real no navegador: cada metodo roda no servidor sobre
 * o banco (`world/serviceActions`, doc 15, fatia 2.2).
 */
export const clientsService = delegateAll("clients", clientsServiceImpl);
