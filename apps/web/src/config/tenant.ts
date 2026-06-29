/**
 * Contexto de tenant da sessao (no MVP, fixo na Corte Nobre). Representa a
 * organizacao/unidade a que a sessao esta vinculada — na fase 3 viria do login.
 * Fonte unica destes ids: consumido pelo seed e pela UI (que monta payloads sem
 * tocar no store).
 */
export const ORG_ID = "org-corte-nobre";
export const UNIT_ID = "unit-matriz";

// "Hoje" do cenario Corte Nobre (2026-06-27, sabado de maior movimento). E em
// torno desta data que o seed da agenda e construido; a Agenda abre nela.
export const REFERENCE_DATE = "2026-06-27";
