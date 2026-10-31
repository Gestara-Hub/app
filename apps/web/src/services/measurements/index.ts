import { delegateAll } from "../world/delegate";
import { measurementsService as measurementsServiceImpl } from "./measurementsService";

export { measurementsServiceImpl };

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const measurementsService = delegateAll("measurements", measurementsServiceImpl);
