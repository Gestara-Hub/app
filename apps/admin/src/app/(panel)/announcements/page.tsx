import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Info, Megaphone, Siren } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListContainer, ListRow } from "@/components/shared/list";
import { SegmentedLinks } from "@/components/shared/segmented-links";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Pager } from "@/components/shared/pager";
import { UrlClearFilters, UrlSearch, UrlSelect } from "@/components/shared/url-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeSearch, pickOption } from "@/lib/filter-input";
import { pageInfo, parsePage, rangeLabel } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { AUDIENCES, SEVERITIES, STATES, announcementTotals, listAnnouncementsPage, type AnnouncementRow } from "@/lib/server/announcements";
import { requireAdmin } from "@/lib/server/context";
import { cn } from "@/lib/utils";
import { AnnouncementRowActions } from "./announcement-row-actions";
import { AREA_LABEL } from "./announcement-form";

export const metadata: Metadata = { title: "Comunicados" };

const STATE_LABEL = { active: "No ar", scheduled: "Agendado", ended: "Encerrado", archived: "Arquivado" } as const;
const SEVERITY_LABEL = { info: "Aviso", warning: "Atenção", urgent: "Urgente" } as const;
const SEVERITY_ICON = { info: Info, warning: AlertTriangle, urgent: Siren } as const;
const SEVERITY_STYLE = { info: "bg-muted text-muted-foreground", warning: "bg-warning/15 text-warning", urgent: "bg-destructive/10 text-destructive" } as const;
const TIER_LABEL: Record<string, string> = { free: "Grátis", pro: "Profissional", scale: "Expansão" };
const STATE_FILTERS = [
  ["all", "Todos"],
  ["active", "No ar"],
  ["scheduled", "Agendados"],
  ["ended", "Encerrados"],
  ["archived", "Arquivados"],
] as const;

function audienceText(row: AnnouncementRow): string {
  if (row.audience === "all") return "Todos os espaços";
  if (row.audience === "tier") return (row.filter.tiers ?? []).map((t) => TIER_LABEL[t] ?? t).join(", ");
  if (row.audience === "area") return (row.filter.areas ?? []).map((a) => AREA_LABEL[a] ?? a).join(", ");
  const n = row.filter.spaces?.length ?? 0;
  return n === 1 ? "1 espaço" : `${n} espaços`;
}

const SEVERITY_OPTIONS = SEVERITIES.map((value) => [value, SEVERITY_LABEL[value]] as const);
const AUDIENCE_OPTIONS = [
  ["all", "Todos os espaços"],
  ["tier", "Por plano"],
  ["area", "Por área"],
  ["spaces", "Espaços escolhidos"],
] as const;

/** Comunicados aos espaços (manutenção, novidade, termo novo, incidente). */
/** "começa" para o comunicado agendado, "começou" para o que já está no ar. */
const startWord = (date: Date) => (date.getTime() > Date.now() ? "começa" : "começou");

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ state?: string; q?: string; severity?: string; audience?: string; page?: string }> }) {
  const { admin } = await requireAdmin("announcements:manage");
  const params = await searchParams;
  const manage = can(admin.role, "announcements:manage");
  const state = pickOption(params.state, STATES);
  const severity = pickOption(params.severity, SEVERITIES);
  const audience = pickOption(params.audience, AUDIENCES);
  const q = normalizeSearch(params.q);
  const [{ rows, total, page, counts }, totals] = await Promise.all([
    listAnnouncementsPage({ state, q, severity, audience, page: parsePage(params.page) }),
    announcementTotals(),
  ]);
  const info = pageInfo(page, total);
  const hasFilter = Boolean(q || severity || audience);
  const empty = totals.active + totals.scheduled + totals.ended + totals.archived === 0;
  const count = (value: string) => counts[value as keyof typeof counts];
  const link = (nextState: string | undefined, nextPage = 1) => {
    const query = new URLSearchParams();
    if (nextState && nextState !== "all") query.set("state", nextState);
    if (severity) query.set("severity", severity);
    if (audience) query.set("audience", audience);
    if (q) query.set("q", q);
    if (nextPage > 1) query.set("page", String(nextPage));
    const text = query.toString();
    return text ? `/announcements?${text}` : "/announcements";
  };

  return (
    <>
      <PageHeader title="Comunicados" description="Mensagens que aparecem no topo do app dos clientes. Quem dispensa deixa de ver; o urgente fica até acabar.">
        {manage ? (
          <Button asChild>
            <Link href="/announcements/new">+ Novo comunicado</Link>
          </Button>
        ) : null}
      </PageHeader>

      <StatGrid>
        <StatCard label="No ar" value={totals.active} tone={totals.active > 0 ? "success" : "default"} />
        <StatCard label="Agendados" value={totals.scheduled} />
        <StatCard label="Encerrados" value={totals.ended} />
        <StatCard label="Dispensas" value={totals.dismissed} sub="Pessoas que fecharam um aviso" />
      </StatGrid>

      <div className="mb-3 space-y-3">
        <SegmentedLinks
          label="Filtrar por situação"
          active={state ?? "all"}
          href={(value) => link(value)}
          items={STATE_FILTERS.map(([value, label]) => ({ value, label, count: value === "all" ? undefined : count(value) }))}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <UrlSearch placeholder="Buscar pelo título" ariaLabel="Buscar comunicados" />
          <UrlSelect param="severity" options={SEVERITY_OPTIONS} allLabel="Toda importância" ariaLabel="Filtrar por importância" />
          <UrlSelect param="audience" options={AUDIENCE_OPTIONS} allLabel="Todos os públicos" ariaLabel="Filtrar por público" className="sm:w-52" />
          <UrlClearFilters params={["q", "severity", "audience"]} />
        </div>
      </div>

      <div className="space-y-2">
        {total > 0 ? <p className="px-1 text-xs text-muted-foreground">{rangeLabel(info, "comunicado", "comunicados")}</p> : null}
        <ListContainer
          emptyState={
            rows.length === 0 ? (
              <EmptyState icon={Megaphone} title={empty ? "Nenhum comunicado ainda" : hasFilter ? "Nenhum comunicado para este filtro" : "Nenhum comunicado aqui"} description={empty ? "Avise os espaços sobre manutenção, novidades e incidentes." : hasFilter ? "Mude a busca, a importância ou o público, ou limpe os filtros." : "Mude a situação para ver outros comunicados."}>
                {empty && manage ? (
                  <Button asChild>
                    <Link href="/announcements/new">+ Novo comunicado</Link>
                  </Button>
                ) : null}
              </EmptyState>
            ) : undefined
          }
        >
          {rows.map((row) => {
            const Icon = SEVERITY_ICON[row.severity];
            return (
              <ListRow key={row.id} className="relative" actions={manage ? <AnnouncementRowActions id={row.id} title={row.title} archived={Boolean(row.archivedAt)} /> : undefined}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", SEVERITY_STYLE[row.severity])}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Link href={`/announcements/${row.id}`} className="block min-w-0 break-words font-medium after:absolute after:inset-0 hover:underline">
                      {row.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={row.state === "active" ? "default" : "secondary"} className="font-normal">
                        {STATE_LABEL[row.state]}
                      </Badge>
                      <Badge variant="outline" className="font-normal">
                        {SEVERITY_LABEL[row.severity]}
                      </Badge>
                    </div>
                    <p className="min-w-0 break-words text-xs text-muted-foreground">
                      {audienceText(row)} · {startWord(row.startsAt)} <RelativeTime date={row.startsAt} /> · {row.endsAt ? <>termina <RelativeTime date={row.endsAt} /></> : "fica até arquivar"} · {row.dismissed} {row.dismissed === 1 ? "dispensa" : "dispensas"}
                    </p>
                  </div>
                </div>
              </ListRow>
            );
          })}
        </ListContainer>
      </div>
      <Pager page={page} hasNext={info.hasNext} totalPages={info.totalPages} href={(next) => link(state, next)} />
    </>
  );
}
