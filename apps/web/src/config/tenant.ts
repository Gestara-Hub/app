/**
 * Contexto de tenant da sessao (no MVP, fixo na Corte Nobre). Representa a
 * organizacao/unidade a que a sessao esta vinculada — na fase 3 viria do login.
 * Fonte unica destes ids: consumido pelo seed e pela UI (que monta payloads sem
 * tocar no store).
 */
export const ORG_ID = "org-corte-nobre";
export const UNIT_ID = "unit-matriz";
