import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import { SearchX, ThumbsUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/shared/back-link";
import { EmptyState } from "@/components/shared/empty-state";
import { ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { Pager } from "@/components/shared/pager";
import { UrlClearFilters, UrlSearch, UrlSelect } from "@/components/shared/url-filters";
import { normalizeSearch } from "@/lib/filter-input";
import { pageInfo, parsePage, rangeLabel } from "@/lib/pagination";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/server/context";
import { HELP_DAYS, helpMissTotals, listHelpFeedback, listHelpMissesPage } from "@/lib/server/support";

export const metadata: Metadata = { title: "Uso da ajuda" };

const DEFAULT_DAYS = 30;

/** Pelo que o app mostra: o que as pessoas buscam e não acham, e quais artigos não ajudam. */
export default async function HelpUsagePage({ searchParams }: { searchParams: Promise<{ days?: string; q?: string; page?: string }> }) {
  await requireAdmin("support:view");
  const params = await searchParams;
  const days = HELP_DAYS.find((value) => String(value) === params.days) ?? DEFAULT_DAYS;
  const q = normalizeSearch(params.q);
  const [list, totals, feedback] = await Promise.all([listHelpMissesPage({ days, q, page: parsePage(params.page) }), helpMissTotals(days), listHelpFeedback(days)]);
  const misses = list.rows;
  const info = pageInfo(list.page, list.total);
  const query = (page: number) => {
    const usp = new URLSearchParams();
    if (params.days) usp.set("days", String(days));
    if (q) usp.set("q", q);
    if (page > 1) usp.set("page", String(page));
    const text = usp.toString();
    return text ? `/support/help?${text}` : "/support/help";
  };
  const missSearches = totals.searches;
  const helpful = feedback.reduce((sum, row) => sum + row.helpful, 0);
  const notHelpful = feedback.reduce((sum, row) => sum + row.notHelpful, 0);
  return (
    <>
      <BackLink href="/support" />
      <PageHeader title="Uso da ajuda" description={`Últimos ${days} dias. Mostra o que falta escrever e o que precisa melhorar nos artigos.`} />

      <StatGrid>
        <StatCard label="Buscas sem resultado" value={missSearches} tone={missSearches > 0 ? "warning" : "default"} sub={`${totals.terms} ${totals.terms === 1 ? "termo diferente" : "termos diferentes"}`} />
        <StatCard label="Avaliações" value={helpful + notHelpful} sub={`${feedback.length} ${feedback.length === 1 ? "trecho avaliado" : "trechos avaliados"}`} />
        <StatCard label="Ajudou" value={helpful} tone={helpful > 0 ? "success" : "default"} />
        <StatCard label="Não ajudou" value={notHelpful} tone={notHelpful > 0 ? "danger" : "default"} />
      </StatGrid>

      <section className="mb-8 space-y-2">
        <h2 className="px-1 text-base font-semibold">Buscas sem resultado</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <UrlSearch param="q" placeholder="Buscar um termo" ariaLabel="Buscar termos sem resultado" />
          <UrlSelect param="days" ariaLabel="Período" allLabel="Últimos 30 dias" options={HELP_DAYS.filter((value) => value !== DEFAULT_DAYS).map((value) => [String(value), `Últimos ${value} dias`] as const)} />
          <UrlClearFilters params={["q", "days"]} />
        </div>
        <p className="px-1 text-xs text-muted-foreground">{rangeLabel(info, "termo", "termos")}</p>
        <ListContainer
          emptyState={
            misses.length === 0 ? (
              <EmptyState icon={SearchX} title={q ? "Nenhum termo com essa busca" : "Nenhuma busca sem resultado no período"} description={q ? "Tente outro termo ou limpe a busca." : undefined}>
                <UrlClearFilters params={["q"]} />
              </EmptyState>
            ) : undefined
          }
        >
          {misses.map((miss) => (
            <ListRow key={miss.term}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="min-w-0 break-words font-medium">{miss.term}</p>
                  <p className="text-xs text-muted-foreground">Última vez <RelativeTime date={miss.lastAt} /></p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    {miss.searches} {miss.searches === 1 ? "busca" : "buscas"}
                  </Badge>
                  <Badge variant="outline" className="font-normal tabular-nums">
                    {miss.spaces} {miss.spaces === 1 ? "espaço" : "espaços"}
                  </Badge>
                </div>
              </div>
            </ListRow>
          ))}
        </ListContainer>
        <Pager page={list.page} hasNext={list.hasNext} totalPages={info.totalPages} href={query} />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-base font-semibold">Isso ajudou?</h2>
        <ListSummaryBar count={feedback.length} singularLabel="trecho avaliado" pluralLabel="trechos avaliados" />
        <ListContainer emptyState={feedback.length === 0 ? <EmptyState icon={ThumbsUp} title="Ninguém avaliou um trecho no período" /> : undefined}>
          {feedback.map((row) => (
            <ListRow key={row.chunkId}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 break-all font-mono text-[11px] text-muted-foreground">{row.chunkId}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="border-success/40 bg-success/10 font-normal tabular-nums text-success">
                    {row.helpful} ajudou
                  </Badge>
                  <Badge variant="outline" className="border-destructive/40 bg-destructive/10 font-normal tabular-nums text-destructive">
                    {row.notHelpful} não ajudou
                  </Badge>
                </div>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </section>
    </>
  );
}
