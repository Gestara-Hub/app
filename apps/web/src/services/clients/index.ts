import { clientBaseService } from "./clientBaseService";
import { clientLifecycleService } from "./clientLifecycleService";
import { clientProgressionService } from "./clientProgressionService";
import { clientRecordsService } from "./clientRecordsService";

export { clientBaseService, clientLifecycleService, clientProgressionService, clientRecordsService };

/** Objeto legado: compoe os sub-servicos de alunos numa unica API. */
export const clientsService = {
  ...clientBaseService,
  ...clientLifecycleService,
  ...clientProgressionService,
  ...clientRecordsService,
};
