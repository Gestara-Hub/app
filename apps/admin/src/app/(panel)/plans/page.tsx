import { RelativeDay, RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { Gift, Hourglass } from "lucide-react";
import { SUBSCRIPTION_PRICES } from "@gestarahub/core/subscription-prices";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/fact-list";
import { InitialsAvatar, ListContainer, ListRow } from "@/components/shared/list";
import { Pager } from "@/components/shared/pager";
import { UrlClearFilters, UrlSearch, UrlSelect } from "@/components/shared/url-filters";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/server/context";
import { normalizeSearch, pickOption } from "@/lib/filter-input";
import { pageInfo, parsePage, rangeLabel } from "@/lib/pagination";
import { GRANT_KINDS, listGrants, listGrantsPage, overdueSpaces, tierCounts } from "@/lib/server/plans";
import { TIER_LABEL } from "@/lib/space-plan";

export const metadata: Metadata = { title: "Planos" };

const GRANT_LABEL = { courtesy: "Cortesia", grace: "Mais dias para pagar", forced_free: "Voltou ao Grátis" } as const;

/**
 * Visão dos planos: catálogo (só leitura), espaços por plano, cortesias, atrasos e concessões.
 * As concessões usam parâmetros próprios para não misturar com o resto da página:
 * `?grants_kind=` (tipo), `?grants_q=` (nome do espaço) e `?grants_page=` (página).
 */
export default async function PlansPage({ searchParams }: { searchParams: Promise<{ grants_kind?: string; grants_q?: string; grants_page?: string }> }) {
  await requireAdmin("plans:view");
  const params = await searchParams;
  const kind = pickOption(params.grants_kind, GRANT_KINDS);
  const q = normalizeSearch(params.grants_q);
  const [counts, courtesies, overdue, grants] = await Promise.all([
    tierCounts(),
    listGrants({ activeOnly: true, limit: 50 }),
    overdueSpaces(),
    listGrantsPage({ kind, q, page: parsePage(params.grants_page) }),
  ]);
  const recent = grants.rows;
  const info = pageInfo(grants.page, grants.total);
  const hasFilters = Boolean(kind || q);
  const clear = ["grants_kind", "grants_q"];
  const grantsHref = (page: number) => {
    const usp = new URLSearchParams();
    if (kind) usp.set("grants_kind", kind);
    if (q) usp.set("grants_q", q);
    if (page > 1) usp.set("grants_page", String(page));
    const text = usp.toString();
    return `/plans${text ? `?${text}` : ""}#concessoes`;
  };
  const byTier = (tier: string) => counts.filter((row) => row.tier === tier).reduce((sum, row) => sum + row.count, 0);
  const courtesyTotal = counts.reduce((sum, row) => sum + row.courtesy, 0);
  return (
    <>
      <PageHeader title="Planos" description="Catálogo, quem está em cada plano e as concessões do painel. Para dar cortesia ou mais dias, abra o espaço, aba Assinatura." />

      <StatGrid>
        <StatCard label="Grátis" value={byTier("free")} sub="espaços" />
        <StatCard label="Profissional" value={byTier("pro")} sub="espaços" />
        <StatCard label="Expansão" value={byTier("scale")} sub="espaços" />
        <StatCard label="Em cortesia" value={courtesyTotal} sub="entram nos planos acima" />
      </StatGrid>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading title="Catálogo" description="Preços aprovados (só leitura). O Expansão não está à venda até existir multiunidade." />
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Mensal</TableHead>
                  <TableHead className="text-right">Anual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Grátis</TableCell>
                  <TableCell className="text-right tabular-nums">R$ 0</TableCell>
                  <TableCell className="text-right">—</TableCell>
                </TableRow>
                {(["pro", "scale"] as const).map((tier) => (
                  <TableRow key={tier}>
                    <TableCell>{TIER_LABEL[tier]}</TableCell>
                    <TableCell className="text-right tabular-nums">{SUBSCRIPTION_PRICES[tier].monthly.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{SUBSCRIPTION_PRICES[tier].yearly.label}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>

        <section>
          <SectionHeading title="Espaços por plano" description="Toque para ver os espaços do plano." />
          <ListContainer>
            {counts.map((row) => (
              <ListRow key={`${row.tier}-${row.interval}`} className="relative">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-medium">
                    {TIER_LABEL[row.tier] ?? row.tier}
                    {row.interval === "yearly" ? " anual" : row.interval === "monthly" ? " mensal" : ""}
                    {row.courtesy > 0 ? <span className="font-normal text-muted-foreground"> ({row.courtesy} em cortesia)</span> : null}
                  </span>
                  <Link href={`/spaces?tier=${row.tier}`} className="font-semibold tabular-nums after:absolute after:inset-0 hover:underline" aria-label={`Ver ${row.count} espaços de ${TIER_LABEL[row.tier] ?? row.tier}`}>
                    {row.count}
                  </Link>
                </div>
              </ListRow>
            ))}
          </ListContainer>
        </section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading title="Cortesias ativas" />
          <ListContainer emptyState={courtesies.length === 0 ? <EmptyState icon={Gift} title="Nenhuma cortesia ativa" /> : undefined}>
            {courtesies.map((grant) => (
              <ListRow key={grant.id} className="relative">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={grant.organizationName} />
                  <Link href={`/spaces/${grant.organizationId}?tab=assinatura`} className="min-w-0 flex-1 break-words font-medium after:absolute after:inset-0 hover:underline">
                    {grant.organizationName}
                  </Link>
                  <Badge variant="outline" className="border-info/40 bg-info/10 font-normal text-info">
                    termina <RelativeDay day={grant.endsOn} />
                  </Badge>
                </div>
              </ListRow>
            ))}
          </ListContainer>
        </section>

        <section>
          <SectionHeading title="Renovações atrasadas" description="Plano pago com a data de renovação já passada." />
          <ListContainer emptyState={overdue.length === 0 ? <EmptyState icon={Hourglass} title="Nenhuma renovação atrasada" /> : undefined}>
            {overdue.map((space) => (
              <ListRow key={space.id} className="relative">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={space.name} />
                  <Link href={`/spaces/${space.id}?tab=assinatura`} className="min-w-0 flex-1 break-words font-medium after:absolute after:inset-0 hover:underline">
                    {space.name}
                  </Link>
                  <Badge variant="outline" className="border-warning/40 bg-warning/10 font-normal text-warning">
                    venceu <RelativeDay day={space.renewsOn} />
                  </Badge>
                </div>
              </ListRow>
            ))}
          </ListContainer>
        </section>
      </div>

      <section id="concessoes" className="scroll-mt-4 space-y-2">
        <SectionHeading title="Concessões" />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <UrlSearch param="grants_q" placeholder="Buscar pelo nome do espaço" ariaLabel="Buscar concessões por espaço" />
          <UrlSelect param="grants_kind" ariaLabel="Tipo de concessão" allLabel="Todos os tipos" options={GRANT_KINDS.map((value) => [value, GRANT_LABEL[value]] as const)} className="sm:w-56" />
          <UrlClearFilters params={clear} />
        </div>
        <p className="px-1 text-xs text-muted-foreground">{rangeLabel(info, "concessão", "concessões")}</p>
        <ListContainer
          emptyState={
            recent.length === 0 ? (
              <EmptyState
                icon={Gift}
                title={hasFilters ? "Nenhuma concessão com esses filtros" : "Nenhuma concessão ainda"}
                description={hasFilters ? "Tente outro tipo ou limpe a busca." : undefined}
              >
                <UrlClearFilters params={clear} />
              </EmptyState>
            ) : undefined
          }
        >
          {recent.map((grant) => (
            <ListRow key={grant.id}>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="min-w-0 break-words font-medium">
                    <Link href={`/spaces/${grant.organizationId}?tab=assinatura`} className="hover:underline">
                      {grant.organizationName}
                    </Link>
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {GRANT_LABEL[grant.kind]}
                      {grant.endsOn ? <> · termina <RelativeDay day={grant.endsOn} /></> : null}
                      {grant.revokedAt ? " (encerrada)" : ""}
                    </span>
                  </p>
                  <p className="min-w-0 break-words text-sm text-muted-foreground">{grant.reason}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {grant.grantedByName} · <RelativeTime date={grant.createdAt} />
                </span>
              </div>
            </ListRow>
          ))}
        </ListContainer>
        <Pager page={grants.page} hasNext={grants.hasNext} totalPages={info.totalPages} href={grantsHref} />
      </section>
    </>
  );
}
