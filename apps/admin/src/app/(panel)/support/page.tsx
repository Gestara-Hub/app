import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { InitialsAvatar, ListContainer, ListRow } from "@/components/shared/list";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { SegmentedLinks } from "@/components/shared/segmented-links";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { UrlClearFilters, UrlSearch, UrlSelect } from "@/components/shared/url-filters";
import { BugStatusBadge, KindBadge, ProtocolTag, RegressionBadge, SlaBadge, StatusBadge, UrgentBadge } from "@/components/support/badges";
import { Button } from "@/components/ui/button";
import { normalizeSearch, pickOption } from "@/lib/filter-input";
import { pageInfo, parsePage, rangeLabel } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { THREAD_PERIODS, listThreads, threadCounts, type ThreadOrder, type ThreadPeriod } from "@/lib/server/support";
import { FILTERS, KIND_FILTERS, isThreadFilter, isThreadKind } from "@/lib/support-types";

export const metadata: Metadata = { title: "Suporte" };

const KIND_OPTIONS = KIND_FILTERS.filter((item) => item.value !== "all").map((item) => [item.value, item.label] as const);

/** Caixa de entrada do "Fale com a gente": quem espera resposta nossa vem primeiro (urgentes e mais antigos). */
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ filter?: string; kind?: string; q?: string; page?: string; urgent?: string; period?: string; order?: string }> }) {
  const { admin } = await requireAdmin("support:view");
  const params = await searchParams;
  const filter = isThreadFilter(params.filter) ? params.filter : "attention";
  const kind = isThreadKind(params.kind) ? params.kind : undefined;
  const q = normalizeSearch(params.q);
  const urgent = params.urgent === "1";
  const period = pickOption(params.period, Object.keys(THREAD_PERIODS) as ThreadPeriod[]);
  const order = pickOption(params.order, ["oldest", "newest"] as const satisfies readonly ThreadOrder[]);
  const [list, counts] = await Promise.all([listThreads({ filter, kind, q, urgent, period, order, page: parsePage(params.page) }), threadCounts()]);
  const { rows, hasNext, page } = list;
  const info = pageInfo(page, list.total);
  const hasFilters = Boolean(q || kind || urgent || period || order);
  const now = new Date();
  const link = (nextFilter: string, nextPage = 1) => {
    const usp = new URLSearchParams({ filter: nextFilter });
    if (kind) usp.set("kind", kind);
    if (q) usp.set("q", q);
    if (urgent) usp.set("urgent", "1");
    if (period) usp.set("period", period);
    if (order) usp.set("order", order);
    if (nextPage > 1) usp.set("page", String(nextPage));
    return `/support?${usp.toString()}`;
  };

  return (
    <>
      <PageHeader title="Suporte" description="Conversas do Fale com a gente. A meta é responder em até 2 dias úteis.">
        <Button asChild variant="outline">
          <Link href="/support/help">Uso da ajuda</Link>
        </Button>
        {can(admin.role, "support:reply") ? (
          <Button asChild variant="outline">
            <Link href="/support/macros">Respostas prontas</Link>
          </Button>
        ) : null}
      </PageHeader>

      <StatGrid>
        <StatCard label="Precisam de resposta" value={counts.attention} tone={counts.attention > 0 ? "warning" : "default"} sub="Meta: até 2 dias úteis" />
        <StatCard label="Urgentes" value={counts.urgent} tone={counts.urgent > 0 ? "danger" : "default"} />
        <StatCard label="Aguardando o cliente" value={counts.waitingCustomer} />
      </StatGrid>

      <div className="mb-3 space-y-3">
        <SegmentedLinks
          label="Filtrar conversas"
          active={filter}
          href={(value) => link(value)}
          items={FILTERS.map((item) => ({ value: item.value, label: item.label, count: item.value === "attention" ? counts.attention : undefined }))}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <UrlSearch placeholder="Buscar protocolo, espaço, pessoa ou assunto" ariaLabel="Buscar conversas" />
          <UrlSelect param="kind" options={KIND_OPTIONS} allLabel="Todos os tipos" ariaLabel="Filtrar por tipo" />
          <UrlSelect param="urgent" options={[["1", "Só urgentes"]]} allLabel="Urgentes e normais" ariaLabel="Filtrar por urgência" />
          <UrlSelect param="period" options={Object.entries(THREAD_PERIODS)} allLabel="Qualquer data" ariaLabel="Período da última mensagem" />
          <UrlSelect
            param="order"
            options={[
              ["oldest", "Mais antigas primeiro"],
              ["newest", "Mais recentes primeiro"],
            ]}
            allLabel="Ordem da fila"
            ariaLabel="Ordem das conversas"
            className="sm:w-52"
          />
          <UrlClearFilters params={["q", "kind", "urgent", "period", "order"]} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-xs text-muted-foreground">{rangeLabel(info, "conversa", "conversas")}</p>
        <ListContainer
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={hasFilters ? "Nenhuma conversa com esses filtros" : "Nenhuma conversa aqui"}
                description={hasFilters ? "Mude os filtros ou a busca para ver outras." : "Mude a situação para ver outras conversas."}
              >
                <UrlClearFilters params={["q", "kind", "urgent", "period", "order"]} />
              </EmptyState>
            ) : undefined
          }
        >
          {rows.map((row) => (
            <ListRow key={row.id} className="relative">
              <div className="flex min-w-0 items-start gap-3">
                <InitialsAvatar name={row.organizationName} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link href={`/support/${row.id}`} className="block min-w-0 break-words font-medium after:absolute after:inset-0 hover:underline">
                    <ProtocolTag number={row.number} className="mr-2 align-middle" />
                    {row.subject}
                  </Link>
                  <p className="min-w-0 break-words text-xs text-muted-foreground">
                    {row.organizationName} · {row.userName}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <KindBadge kind={row.kind} />
                    <BugStatusBadge status={row.bugStatus} />
                    <RegressionBadge regressed={row.regressed} />
                    <StatusBadge status={row.status} />
                    {row.urgent ? <UrgentBadge /> : null}
                    <SlaBadge status={row.status} since={row.lastCustomerMessageAt ?? row.createdAt} now={now} />
                  </div>
                </div>
                <RelativeTime date={row.lastMessageAt} className="shrink-0 text-xs text-muted-foreground" />
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </div>
      <Pager page={page} hasNext={hasNext} totalPages={info.totalPages} href={(next) => link(filter, next)} />
    </>
  );
}
