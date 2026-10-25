import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { InitialsAvatar, ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { SegmentedLinks } from "@/components/shared/segmented-links";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { UrlClearFilters, UrlSearch, UrlSelect } from "@/components/shared/url-filters";
import { KindBadge, SlaBadge, StatusBadge, UrgentBadge } from "@/components/support/badges";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { agoOrNow } from "@/lib/relative-time";
import { requireAdmin } from "@/lib/server/context";
import { listThreads, threadCounts } from "@/lib/server/support";
import { FILTERS, KIND_FILTERS, isThreadFilter, isThreadKind } from "@/lib/support-types";

export const metadata: Metadata = { title: "Suporte" };

const KIND_OPTIONS = KIND_FILTERS.filter((item) => item.value !== "all").map((item) => [item.value, item.label] as const);

/** Caixa de entrada do "Fale com a gente": quem espera resposta nossa vem primeiro (urgentes e mais antigos). */
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ filter?: string; kind?: string; q?: string; page?: string }> }) {
  const { admin } = await requireAdmin("support:view");
  const params = await searchParams;
  const filter = isThreadFilter(params.filter) ? params.filter : "attention";
  const kind = isThreadKind(params.kind) ? params.kind : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const q = params.q?.trim() ?? "";
  const [{ rows, hasNext }, counts] = await Promise.all([listThreads({ filter, kind, q, page }), threadCounts()]);
  const now = new Date();
  const link = (nextFilter: string, nextPage = 1) =>
    `/support?filter=${nextFilter}${kind ? `&kind=${kind}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}${nextPage > 1 ? `&page=${nextPage}` : ""}`;

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <UrlSearch placeholder="Buscar espaço, pessoa ou assunto" ariaLabel="Buscar conversas" />
          <UrlSelect param="kind" options={KIND_OPTIONS} allLabel="Todos os tipos" ariaLabel="Filtrar por tipo" />
          <UrlClearFilters params={["q", "kind"]} />
        </div>
      </div>

      <div className="space-y-2">
        <ListSummaryBar count={rows.length} singularLabel="conversa nesta página" pluralLabel="conversas nesta página" />
        <ListContainer
          emptyState={rows.length === 0 ? <EmptyState icon={MessageSquare} title="Nenhuma conversa aqui" description="Mude o filtro ou a busca para ver outras." /> : undefined}
        >
          {rows.map((row) => (
            <ListRow key={row.id} className="relative">
              <div className="flex min-w-0 items-start gap-3">
                <InitialsAvatar name={row.organizationName} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link href={`/support/${row.id}`} className="block min-w-0 break-words font-medium after:absolute after:inset-0 hover:underline">
                    {row.subject}
                  </Link>
                  <p className="min-w-0 break-words text-xs text-muted-foreground">
                    {row.organizationName} · {row.userName}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <KindBadge kind={row.kind} />
                    <StatusBadge status={row.status} />
                    {row.urgent ? <UrgentBadge /> : null}
                    <SlaBadge status={row.status} since={row.lastCustomerMessageAt ?? row.createdAt} now={now} />
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground" title={format(row.lastMessageAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}>
                  {agoOrNow(row.lastMessageAt, now)}
                </span>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </div>
      <Pager page={page} hasNext={hasNext} href={(next) => link(filter, next)} />
    </>
  );
}
