import type { Metadata } from "next";
import Link from "next/link";
import { Gift, Hourglass } from "lucide-react";
import { SUBSCRIPTION_PRICES } from "@gestarahub/core/subscription-prices";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/fact-list";
import { InitialsAvatar, ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brDay, dateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/server/context";
import { listGrants, overdueSpaces, tierCounts } from "@/lib/server/plans";
import { TIER_LABEL } from "@/lib/space-plan";

export const metadata: Metadata = { title: "Planos" };

const GRANT_LABEL = { courtesy: "Cortesia", grace: "Mais dias para pagar", forced_free: "Voltou ao Grátis" } as const;

/** Visão dos planos: catálogo (só leitura), espaços por plano, cortesias, atrasos e concessões recentes. */
export default async function PlansPage() {
  await requireAdmin("plans:view");
  const [counts, courtesies, overdue, recent] = await Promise.all([tierCounts(), listGrants({ activeOnly: true, limit: 50 }), overdueSpaces(), listGrants({ limit: 15 })]);
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
              <ListRow key={`${row.tier}-${row.interval}`}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-medium">
                    {TIER_LABEL[row.tier] ?? row.tier}
                    {row.interval === "yearly" ? " anual" : row.interval === "monthly" ? " mensal" : ""}
                    {row.courtesy > 0 ? <span className="font-normal text-muted-foreground"> ({row.courtesy} em cortesia)</span> : null}
                  </span>
                  <Link href={`/spaces?tier=${row.tier}`} className="font-semibold tabular-nums hover:underline" aria-label={`Ver ${row.count} espaços de ${TIER_LABEL[row.tier] ?? row.tier}`}>
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
              <ListRow key={grant.id}>
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={grant.organizationName} />
                  <Link href={`/spaces/${grant.organizationId}?tab=assinatura`} className="min-w-0 flex-1 break-words font-medium hover:underline">
                    {grant.organizationName}
                  </Link>
                  <Badge variant="outline" className="border-info/40 bg-info/10 font-normal text-info">
                    até {brDay(grant.endsOn)}
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
              <ListRow key={space.id}>
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={space.name} />
                  <Link href={`/spaces/${space.id}?tab=assinatura`} className="min-w-0 flex-1 break-words font-medium hover:underline">
                    {space.name}
                  </Link>
                  <Badge variant="outline" className="border-warning/40 bg-warning/10 font-normal text-warning">
                    desde {brDay(space.renewsOn)}
                  </Badge>
                </div>
              </ListRow>
            ))}
          </ListContainer>
        </section>
      </div>

      <section>
        <SectionHeading title="Concessões recentes" />
        <ListSummaryBar count={recent.length} singularLabel="concessão" pluralLabel="concessões" />
        <ListContainer emptyState={recent.length === 0 ? <EmptyState icon={Gift} title="Nenhuma concessão ainda" /> : undefined} className="mt-2">
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
                      {grant.endsOn ? ` até ${brDay(grant.endsOn)}` : ""}
                      {grant.revokedAt ? " (encerrada)" : ""}
                    </span>
                  </p>
                  <p className="min-w-0 break-words text-sm text-muted-foreground">{grant.reason}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {grant.grantedByName} · {dateTime(grant.createdAt)}
                </span>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </section>
    </>
  );
}
