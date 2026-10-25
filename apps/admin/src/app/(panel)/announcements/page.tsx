import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Info, Megaphone, Siren } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { SegmentedLinks } from "@/components/shared/segmented-links";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { UrlSearch } from "@/components/shared/url-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { listAnnouncements, type AnnouncementRow } from "@/lib/server/announcements";
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

/** Comunicados aos espaços (manutenção, novidade, termo novo, incidente). */
export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ state?: string; q?: string }> }) {
  const { admin } = await requireAdmin("announcements:manage");
  const params = await searchParams;
  const all = await listAnnouncements();
  const manage = can(admin.role, "announcements:manage");
  const state = STATE_FILTERS.some(([value]) => value === params.state) ? (params.state as string) : "all";
  const q = params.q?.trim().toLowerCase() ?? "";
  const count = (value: string) => all.filter((row) => row.state === value).length;
  const rows = all.filter((row) => (state === "all" || row.state === state) && (!q || row.title.toLowerCase().includes(q)));
  const dismissedTotal = all.reduce((sum, row) => sum + row.dismissed, 0);
  const href = (value: string) => `/announcements?${new URLSearchParams({ ...(value !== "all" ? { state: value } : {}), ...(q ? { q: params.q!.trim() } : {}) }).toString()}`;

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
        <StatCard label="No ar" value={count("active")} tone={count("active") > 0 ? "success" : "default"} />
        <StatCard label="Agendados" value={count("scheduled")} />
        <StatCard label="Encerrados" value={count("ended")} />
        <StatCard label="Dispensas" value={dismissedTotal} sub="Pessoas que fecharam um aviso" />
      </StatGrid>

      <div className="mb-3 space-y-3">
        <SegmentedLinks
          label="Filtrar por situação"
          active={state}
          href={href}
          items={STATE_FILTERS.map(([value, label]) => ({ value, label, count: value === "all" ? undefined : count(value) }))}
        />
        <div className="flex">
          <UrlSearch placeholder="Buscar pelo título" ariaLabel="Buscar comunicados" />
        </div>
      </div>

      <div className="space-y-2">
        <ListSummaryBar count={rows.length} singularLabel="comunicado" pluralLabel="comunicados" />
        <ListContainer
          emptyState={
            rows.length === 0 ? (
              <EmptyState icon={Megaphone} title={all.length === 0 ? "Nenhum comunicado ainda" : "Nenhum comunicado aqui"} description={all.length === 0 ? "Avise os espaços sobre manutenção, novidades e incidentes." : "Mude o filtro ou a busca."}>
                {all.length === 0 && manage ? (
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
                      {audienceText(row)} · {dateTime(row.startsAt)} até {row.endsAt ? dateTime(row.endsAt) : "arquivar"} · {row.dismissed} {row.dismissed === 1 ? "dispensa" : "dispensas"}
                    </p>
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
