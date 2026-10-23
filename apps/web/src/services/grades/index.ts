import { delegateAll } from "../world/delegate";
import { assessmentsService } from "./assessmentsService";
import { reportCardService } from "./reportCardService";

export { assessmentsService, reportCardService };

/** Objeto legado: os mesmos metodos de antes, compostos dos sub-servicos. */
export const gradesServiceImpl = {
  ...assessmentsService,
  ...reportCardService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const gradesService = delegateAll("grades", gradesServiceImpl);
