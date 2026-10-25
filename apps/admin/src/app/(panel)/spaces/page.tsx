import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { InitialsAvatar, ListContainer, ListRow } from "@/components/shared/list";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { UrlClearFilters, UrlSearch, UrlSelect } from "@/components/shared/url-filters";
import { SpaceRowMenu } from "./space-row-menu";
import { PlanBadge } from "@/components/shared/plan-badge";
import { Pager } from "@/components/shared/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeSearch, pickOne } from "@/lib/list-filters";
import { pageInfo, parsePage, rangeLabel } from "@/lib/pagination";
import { brasiliaDay } from "@/lib/sla";
import { requireAdmin } from "@/lib/server/context";
import { SPACE_SITUATIONS, SPACE_SORTS, listSpaces, spaceTotals, type SpaceFilters, type SpaceSituation, type SpaceSort } from "@/lib/server/spaces";
import { AREA_LABEL, planName } from "@/lib/space-plan";

export const metadata: Metadata = { title: "Espaços" };

const SITUATION_LABEL: Record<SpaceSituation, string> = {
  all: "Todas as situações",
  paid: "Plano pago",
  grace: "Pagamento atrasado",
  reverted: "Voltou ao Grátis",
  scheduled: "Troca de plano marcada",
  courtesy: "Cortesia",
  inactive: "Inativos",
  no_access_30d: "Sem acesso há 30 dias",
  no_online: "Sem recebimento online",
  errors_24h: "Com erro nas últimas 24 h",
};
const SORT_LABEL: Record<SpaceSort, string> = { recent: "Mais novos", name: "Nome", activity: "Último acesso" };

const pick = pickOne;

export default async function SpacesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("spaces:view");
  const params = await searchParams;
  const filters: SpaceFilters = {
    q: normalizeSearch(params.q),
    tier: pick(params.tier, ["free", "pro", "scale"] as const),
    situation: pick(params.situation, SPACE_SITUATIONS),
    area: params.area && params.area in AREA_LABEL ? params.area : undefined,
    createdWithin: params.created === "7" ? 7 : params.created === "30" ? 30 : undefined,
    sort: pick(params.sort, SPACE_SORTS),
    page: parsePage(params.page),
  };
  const [{ rows, hasNext, total, page }, totals] = await Promise.all([listSpaces(filters), spaceTotals()]);
  const today = brasiliaDay(new Date());

  const query = (override: Record<string, string | undefined> = {}) => {
    const merged = { ...params, ...override };
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) usp.set(key, value);
    return usp.toString();
  };
  const exportHref = `/spaces/export?${query({ page: undefined })}`;

  const clearable = ["q", "tier", "situation", "area", "created", "sort"];
  const hasFilters = clearable.some((key) => params[key]);
  const info = pageInfo(page, total);

  return (
    <>
      <PageHeader title="Espaços" description="Todos os espaços e a situação de cada um. Só números: nenhum dado de aluno.">
        <Button asChild variant="outline">
          <Link href={exportHref} prefetch={false}>
            Exportar CSV
          </Link>
        </Button>
      </PageHeader>

      <StatGrid>
        <StatCard label="Espaços" value={totals.total} />
        <StatCard label="Com plano pago" value={totals.paid} />
        <StatCard label="Sem acesso há 30 dias" value={totals.noAccess30d} tone={totals.noAccess30d > 0 ? "warning" : "default"} />
        <StatCard label="Inativos" value={totals.inactive} />
      </StatGrid>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <UrlSearch placeholder="Buscar por nome, dono, e-mail ou código" ariaLabel="Buscar espaços" />
        <div className="flex flex-wrap items-center gap-2">
          <UrlSelect param="tier" ariaLabel="Plano" allLabel="Todos os planos" options={[["free", "Grátis"], ["pro", "Profissional"], ["scale", "Expansão"]]} />
          <UrlSelect param="situation" ariaLabel="Situação" allLabel="Todas as situações" className="sm:w-52" options={SPACE_SITUATIONS.filter((s) => s !== "all").map((s) => [s, SITUATION_LABEL[s]] as const)} />
          <UrlSelect param="area" ariaLabel="Área" allLabel="Todas as áreas" options={Object.entries(AREA_LABEL)} />
          <UrlSelect param="created" ariaLabel="Criado" allLabel="Qualquer data" options={[["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"]]} />
          <UrlSelect param="sort" ariaLabel="Ordem" allLabel="Mais novos" options={SPACE_SORTS.filter((s) => s !== "recent").map((s) => [s, SORT_LABEL[s]] as const)} />
          <UrlClearFilters params={clearable} />
        </div>
      </div>

      <div className="space-y-2">
        {total > 0 ? <p className="px-1 text-xs text-muted-foreground">{rangeLabel(info, "espaço", "espaços")}</p> : null}
        <ListContainer
          emptyState={
            rows.length === 0 ? (
              hasFilters ? (
                <EmptyState icon={Building2} title="Nenhum espaço com esses filtros" description="Tire um filtro ou limpe a busca." />
              ) : (
                <EmptyState icon={Building2} title="Nenhum espaço cadastrado" description="Os espaços aparecem aqui quando alguém se cadastra." />
              )
            ) : undefined
          }
        >
          {rows.map((row) => (
            <ListRow key={row.id} className="relative" actions={<SpaceRowMenu id={row.id} name={row.name} hasErrors={row.errors24h > 0} />}>
              <div className="flex min-w-0 items-start gap-3">
                <InitialsAvatar name={row.name} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link href={`/spaces/${row.id}`} className="min-w-0 break-words font-medium after:absolute after:inset-0 hover:underline">
                      {row.name}
                    </Link>
                    <PlanBadge subscription={row.subscription} today={today} />
                    {row.subscription?.tier && row.subscription.tier !== "free" ? <span className="text-xs text-muted-foreground">{planName(row.subscription)}</span> : null}
                    {row.status === "inactive" ? (
                      <Badge variant="destructive" className="font-normal">
                        Inativo
                      </Badge>
                    ) : null}
                    {row.errors24h > 0 ? (
                      <Link href={`/spaces/${row.id}?tab=saude`} title="Ver os erros deste espaço">
                        <Badge variant="outline" className="border-destructive/40 font-normal text-destructive hover:bg-destructive/10">
                          {row.errors24h} {row.errors24h > 1 ? "erros" : "erro"} em 24 h
                        </Badge>
                      </Link>
                    ) : null}
                  </div>
                  <p className="min-w-0 break-words text-xs text-muted-foreground">
                    {row.ownerName ?? "Sem dono ativo"} · {row.customAreaName || AREA_LABEL[row.area ?? ""] || "Sem área"}
                  </p>
                  <p className="min-w-0 break-words text-xs text-muted-foreground tabular-nums">
                    {row.studentsActive} {row.studentsActive === 1 ? "aluno" : "alunos"} · {row.classesActive} {row.classesActive === 1 ? "turma" : "turmas"} · acesso <RelativeTime date={row.lastSignInAt} empty="nunca" /> · criado <RelativeTime date={row.createdAt} />
                  </p>
                </div>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </div>
      <Pager page={page} hasNext={hasNext} totalPages={info.totalPages} href={(page) => `/spaces?${query({ page: page > 1 ? String(page) : undefined })}`} />
    </>
  );
}
