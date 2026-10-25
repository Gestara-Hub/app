import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { InitialsAvatar, ListContainer, ListRow } from "@/components/shared/list";
import { Pager } from "@/components/shared/pager";
import { SegmentedLinks } from "@/components/shared/segmented-links";
import { UrlClearFilters, UrlSearch, UrlSelect } from "@/components/shared/url-filters";
import { UrlDateRange } from "@/components/shared/url-date-range";
import { AUDIT_PERIODS, AUDIT_PERIOD_LABEL, parseAuditFilters } from "@/lib/audit-filters";
import { AUDIT_GROUPS, auditActionLabel } from "@/lib/audit-labels";
import { pageInfo, parsePage, rangeLabel } from "@/lib/pagination";
import { requireAdmin } from "@/lib/server/context";
import { listAudit, listAuditAdmins, spaceNameById } from "@/lib/server/audit-log";

export const metadata: Metadata = { title: "Auditoria" };

/** Origem em texto de gente: o endereço da própria máquina vira "Este computador". */
function originLabel(ip: string | null): string | null {
  if (!ip) return null;
  if (ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1") return "Este computador";
  return ip;
}

const CLEARABLE = ["q", "admin", "space", "period", "from", "to"];

/** Tudo o que foi feito no painel: so leitura, ninguem edita nem apaga. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("audit:view");
  const params = await searchParams;
  const { filters, range } = parseAuditFilters(params, parsePage(params.page));
  const { group } = filters;
  const [{ rows: shown, total, page }, admins, spaceName] = await Promise.all([
    listAudit({ group, q: filters.q, admin: filters.admin, space: filters.space, from: range.from, to: range.to, page: filters.page }),
    listAuditAdmins(),
    filters.space ? spaceNameById(filters.space) : Promise.resolve(null),
  ]);
  const info = pageInfo(page, total);
  const hasFilters = CLEARABLE.some((key) => params[key]) || group !== "all";
  const link = (nextGroup: string, nextPage: number, without?: string) => {
    const usp = new URLSearchParams();
    for (const key of CLEARABLE) {
      if (key !== without && params[key]) usp.set(key, params[key]);
    }
    if (nextGroup !== "all") usp.set("group", nextGroup);
    if (nextPage > 1) usp.set("page", String(nextPage));
    const query = usp.toString();
    return query ? `/audit?${query}` : "/audit";
  };

  return (
    <>
      <PageHeader title="Auditoria" description="Registro do que foi feito no painel. Só leitura." />
      <div className="mb-3 space-y-3">
        <SegmentedLinks label="Filtrar por tipo" items={[...AUDIT_GROUPS]} active={group} href={(value) => link(value, 1)} />
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <UrlSearch placeholder="Buscar ação, pessoa, espaço ou motivo" ariaLabel="Buscar na auditoria" />
          <div className="flex flex-wrap items-center gap-2">
            <UrlSelect param="admin" ariaLabel="Pessoa" allLabel="Todas as pessoas" className="sm:w-48" options={admins.map((item) => [item.id, item.name] as const)} />
            <UrlSelect param="period" ariaLabel="Período" allLabel="Qualquer data" options={AUDIT_PERIODS.map((item) => [item, AUDIT_PERIOD_LABEL[item]] as const)} />
            <UrlDateRange />
            <UrlClearFilters params={CLEARABLE} />
          </div>
        </div>
        {filters.space ? (
          <p className="text-xs text-muted-foreground">
            Só o espaço {spaceName ?? filters.space.slice(0, 8)}.{" "}
            <Link href={link(group, 1, "space")} className="underline underline-offset-2">
              Ver todos
            </Link>
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        {total > 0 ? <p className="px-1 text-xs text-muted-foreground">{rangeLabel(info, "registro", "registros")}</p> : null}
        <ListContainer
          emptyState={
            shown.length === 0 ? (
              hasFilters ? (
                <EmptyState icon={ScrollText} title="Nenhum registro com esses filtros" description="Tire um filtro ou limpe a busca." />
              ) : (
                <EmptyState icon={ScrollText} title="Nada registrado ainda." description="As ações feitas no painel aparecem aqui." />
              )
            ) : undefined
          }
        >
          {shown.map((row) => {
            const origin = originLabel(row.ip);
            return (
              <ListRow key={row.id}>
                <div className="flex items-start gap-3">
                  <InitialsAvatar name={row.admin_name ?? "Sistema"} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="min-w-0 break-words text-sm font-medium">{auditActionLabel(row.action)}</p>
                    <p className="min-w-0 break-words text-xs text-muted-foreground">
                      {row.admin_name ?? "Sistema"} · <RelativeTime date={row.created_at} />
                      {origin ? ` · ${origin}` : ""}
                    </p>
                    {row.organization_id ? (
                      <p className="min-w-0 break-words text-xs">
                        <span className="text-muted-foreground">Espaço: </span>
                        <Link href={`/spaces/${row.organization_id}`} className="underline underline-offset-2">
                          {row.organization_name ?? "Ver espaço"}
                        </Link>
                        <span className="ml-1 break-all font-mono text-[10px] text-muted-foreground/70">{row.organization_id.slice(0, 8)}</span>
                      </p>
                    ) : null}
                    {row.reason ? <p className="min-w-0 break-words text-xs text-muted-foreground">Motivo: {row.reason}</p> : null}
                  </div>
                </div>
              </ListRow>
            );
          })}
        </ListContainer>
      </div>
      <Pager page={page} hasNext={info.hasNext} totalPages={info.totalPages} href={(p) => link(group, p)} />
    </>
  );
}
