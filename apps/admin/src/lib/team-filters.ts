import { ADMIN_ROLES, type AdminRole } from "./permissions";
import { normalizeSearch, pickOne } from "./list-filters";

export const TEAM_STATUSES = ["active", "invited", "disabled"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];
export const TEAM_STATUS_LABEL: Record<TeamStatus, string> = { active: "Ativo", invited: "Convidado", disabled: "Desativado" };

export interface TeamFilters {
  q?: string;
  role?: AdminRole;
  status?: TeamStatus;
}

export function parseTeamFilters(params: Record<string, string | undefined>): TeamFilters {
  return { q: normalizeSearch(params.q), role: pickOne(params.role, ADMIN_ROLES), status: pickOne(params.status, TEAM_STATUSES) };
}

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A equipe é pequena: filtra em memória, por nome ou e-mail, papel e situação. */
export function filterTeam<T extends { name: string; email: string; role: string; status: string }>(rows: T[], filters: TeamFilters): T[] {
  const needle = filters.q ? fold(filters.q) : "";
  return rows.filter(
    (row) =>
      (!needle || fold(row.name).includes(needle) || fold(row.email).includes(needle)) &&
      (!filters.role || row.role === filters.role) &&
      (!filters.status || row.status === filters.status),
  );
}
