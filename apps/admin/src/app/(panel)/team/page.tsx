import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FormDrawer } from "@/components/shared/form-drawer";
import { InitialsAvatar, ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UrlClearFilters, UrlSearch, UrlSelect } from "@/components/shared/url-filters";
import { filterTeam, parseTeamFilters, TEAM_STATUSES, TEAM_STATUS_LABEL } from "@/lib/team-filters";
import { ADMIN_ROLES, ADMIN_ROLE_LABEL, can } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { inviteEnabled } from "@/lib/server/auth-admin";
import { listTeam } from "@/lib/server/team";
import { InviteForm, MemberMenu } from "./team-forms";

export const metadata: Metadata = { title: "Equipe" };

const STATUS_LABEL: Record<string, string> = TEAM_STATUS_LABEL;

/** Quem tem acesso ao painel: convidar, mudar papel, desativar e reiniciar o 2FA (so o proprietario). */
export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { admin } = await requireAdmin("team:view");
  const params = await searchParams;
  const filters = parseTeamFilters(params);
  const all = await listTeam();
  const rows = filterTeam(all, filters);
  const hasFilters = Boolean(filters.q || filters.role || filters.status);
  const manage = can(admin.role, "team:manage");
  return (
    <>
      <PageHeader
        title="Equipe"
        description="Pessoas com acesso ao painel. Elas nunca entram no app dos clientes, e quem é cliente nunca entra aqui."
      >
        {manage ? (
          <FormDrawer
            title="Convidar administrador"
            description="A pessoa recebe um convite por e-mail."
            trigger={
              <Button>
                <Plus className="size-4" /> Convidar
              </Button>
            }
          >
            <InviteForm enabled={inviteEnabled()} />
          </FormDrawer>
        ) : null}
      </PageHeader>
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <UrlSearch placeholder="Buscar por nome ou e-mail" ariaLabel="Buscar na equipe" />
        <div className="flex flex-wrap items-center gap-2">
          <UrlSelect param="role" ariaLabel="Papel" allLabel="Todos os papéis" options={ADMIN_ROLES.map((role) => [role, ADMIN_ROLE_LABEL[role]] as const)} />
          <UrlSelect param="status" ariaLabel="Situação" allLabel="Todas as situações" options={TEAM_STATUSES.map((status) => [status, TEAM_STATUS_LABEL[status]] as const)} />
          <UrlClearFilters params={["q", "role", "status"]} />
        </div>
      </div>
      <div className="space-y-2">
        <ListSummaryBar count={rows.length} singularLabel="pessoa" pluralLabel="pessoas" />
        <ListContainer
          emptyState={
            rows.length === 0 ? (
              hasFilters ? (
                <EmptyState icon={Users} title="Ninguém com esses filtros" description="Tire um filtro ou limpe a busca." />
              ) : (
                <EmptyState icon={Users} title="Ninguém na equipe ainda." />
              )
            ) : undefined
          }
        >
          {rows.map((row) => {
            const isSelf = row.id === admin.id;
            return (
              <ListRow key={row.id} actions={manage && !isSelf ? <MemberMenu id={row.id} name={row.name} role={row.role} status={row.status} /> : undefined}>
                <div className="flex items-start gap-3">
                  <InitialsAvatar name={row.name} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 break-words text-sm font-medium">{row.name}</p>
                      {isSelf ? <span className="text-xs text-muted-foreground">Você</span> : null}
                      <Badge variant="outline" className="font-normal">
                        {ADMIN_ROLE_LABEL[row.role]}
                      </Badge>
                      <Badge variant={row.status === "active" ? "secondary" : "outline"} className="font-normal">
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                    </div>
                    <p className="min-w-0 break-all text-xs text-muted-foreground">{row.email}</p>
                    <p className="text-xs text-muted-foreground">{row.lastLoginAt ? <>Último acesso <RelativeTime date={row.lastLoginAt} /></> : "Nunca entrou"}</p>
                  </div>
                </div>
              </ListRow>
            );
          })}
        </ListContainer>
      </div>
    </>
  );
}
