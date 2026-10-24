import type { Metadata } from "next";
import Link from "next/link";
import { SUBSCRIPTION_PRICES } from "@gestarahub/core/subscription-prices";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  return (
    <>
      <PageHeader title="Planos" description="Catálogo, quem está em cada plano e as concessões do painel. Para dar cortesia ou mais dias, abra o espaço, aba Assinatura." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catálogo</CardTitle>
            <CardDescription>Preços aprovados (só leitura). O Expansão não está à venda até existir multiunidade.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Mensal</TableHead>
                  <TableHead>Anual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Grátis</TableCell>
                  <TableCell>R$ 0</TableCell>
                  <TableCell>—</TableCell>
                </TableRow>
                {(["pro", "scale"] as const).map((tier) => (
                  <TableRow key={tier}>
                    <TableCell>{TIER_LABEL[tier]}</TableCell>
                    <TableCell>{SUBSCRIPTION_PRICES[tier].monthly.label}</TableCell>
                    <TableCell>{SUBSCRIPTION_PRICES[tier].yearly.label}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Espaços por plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {counts.map((row) => (
                <li key={`${row.tier}-${row.interval}`} className="flex items-center justify-between py-2">
                  <span>
                    {TIER_LABEL[row.tier] ?? row.tier}
                    {row.interval === "yearly" ? " anual" : row.interval === "monthly" ? " mensal" : ""}
                    {row.courtesy > 0 ? <span className="text-muted-foreground"> ({row.courtesy} em cortesia)</span> : null}
                  </span>
                  <Link href={`/spaces?tier=${row.tier}`} className="font-medium tabular-nums hover:underline">
                    {row.count}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="pt-4">
            <CardTitle className="text-base">Cortesias ativas</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {courtesies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma cortesia ativa.</p>
            ) : (
              <ul className="divide-y text-sm">
                {courtesies.map((grant) => (
                  <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/spaces/${grant.organizationId}?tab=assinatura`} className="min-w-0 break-words font-medium hover:underline">
                      {grant.organizationName}
                    </Link>
                    <span className="text-muted-foreground">até {brDay(grant.endsOn)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="pt-4">
            <CardTitle className="text-base">Renovações atrasadas</CardTitle>
            <CardDescription>Plano pago com a data de renovação já passada.</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma renovação atrasada.</p>
            ) : (
              <ul className="divide-y text-sm">
                {overdue.map((space) => (
                  <li key={space.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/spaces/${space.id}?tab=assinatura`} className="min-w-0 break-words font-medium hover:underline">
                      {space.name}
                    </Link>
                    <Badge variant="outline" className="border-warning/40 font-normal text-warning">
                      desde {brDay(space.renewsOn)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Concessões recentes</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Espaço</TableHead>
              <TableHead>O quê</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Quem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhuma concessão ainda.
                </TableCell>
              </TableRow>
            ) : (
              recent.map((grant) => (
                <TableRow key={grant.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(grant.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={`/spaces/${grant.organizationId}?tab=assinatura`} className="hover:underline">
                      {grant.organizationName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {GRANT_LABEL[grant.kind]}
                    {grant.endsOn ? ` até ${brDay(grant.endsOn)}` : ""}
                    {grant.revokedAt ? " (encerrada)" : ""}
                  </TableCell>
                  <TableCell className="max-w-64 break-words text-muted-foreground">{grant.reason}</TableCell>
                  <TableCell className="text-muted-foreground">{grant.grantedByName}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
