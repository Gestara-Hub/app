import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/fact-list";
import { ListContainer, ListRow } from "@/components/shared/list";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl } from "@/lib/format";
import { requireAdmin } from "@/lib/server/context";
import { funnel, movement, subscribers } from "@/lib/server/revenue";
import { TIER_LABEL } from "@/lib/space-plan";

export const metadata: Metadata = { title: "Receita" };

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");
const monthLabel = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`;

/** Receita e ativação: assinantes, receita mensal, movimento, taxa dos pagamentos online, funil e retenção. */
export default async function RevenuePage() {
  await requireAdmin("revenue:view");
  const [subs, months, steps] = await Promise.all([subscribers(), movement(), funnel()]);
  const funnelRows = [
    ["Espaços ativos", steps.spacesTotal],
    ["Cadastraram alunos", steps.withStudents],
    ["Criaram turmas", steps.withClasses],
    ["Geraram cobranças", steps.withCharges],
    ["Receberam pelo app (pago)", steps.withOnlinePaid],
    ["Pagam um plano", steps.paying],
  ] as const;
  return (
    <>
      <PageHeader title="Receita" description="Só totais. A receita mensal considera o preço do plano (anual dividido por 12) e não conta cortesia." />
      <StatGrid>
        <StatCard label="Receita mensal" value={brl(subs.mrrCents)} sub={`${subs.payingTotal} ${subs.payingTotal === 1 ? "espaço pagando" : "espaços pagando"}`} />
        <StatCard label="Em cortesia" value={subs.courtesy} sub="Não entram na receita" />
        <StatCard label="Usaram nos últimos 30 dias" value={pct(steps.active30d, steps.spacesTotal)} sub={`${steps.active30d} de ${steps.spacesTotal} espaços`} />
        <StatCard label="Pagantes que usaram" value={pct(steps.payingActive30d, steps.paying)} sub={`${steps.payingActive30d} de ${steps.paying}`} />
      </StatGrid>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading title="Assinantes por plano" />
          {subs.rows.length === 0 ? (
            <ListContainer emptyState={<EmptyState icon={Wallet} title="Nenhum espaço pagando ainda" />} />
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Espaços</TableHead>
                    <TableHead className="text-right">Receita mensal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.rows.map((r) => (
                    <TableRow key={`${r.tier}-${r.interval}`}>
                      <TableCell>
                        {TIER_LABEL[r.tier]} {r.interval === "yearly" ? "anual" : "mensal"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(r.mrrCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>

        <section>
          <SectionHeading title="Da criação ao plano pago" description="Quantos espaços ativos chegaram a cada passo." />
          <ListContainer>
            {funnelRows.map(([label, n]) => (
              <ListRow key={label}>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words">{label}</span>
                    <span className="tabular-nums">
                      {n} <span className="text-muted-foreground">({pct(n, steps.spacesTotal)})</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-primary/70" style={{ width: steps.spacesTotal > 0 ? `${Math.round((n / steps.spacesTotal) * 100)}%` : "0%" }} />
                  </div>
                </div>
              </ListRow>
            ))}
          </ListContainer>
        </section>
      </div>

      <section>
        <SectionHeading title="Movimento dos últimos 6 meses" description="A taxa é o que o GestaraHub recebe dos pagamentos online dos espaços." />
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Novos espaços</TableHead>
                <TableHead className="text-right">Assinaram</TableHead>
                <TableHead className="text-right">Subiram</TableHead>
                <TableHead className="text-right">Reduziram</TableHead>
                <TableHead className="text-right">Cancelaram</TableHead>
                <TableHead className="text-right">Voltaram ao Grátis</TableHead>
                <TableHead className="text-right">Pagamentos online</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium">{monthLabel(m.month)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.created}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.activated}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.upgraded}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.downgraded}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.canceled}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.revertedToFree}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.onlineCount} · {brl(m.onlineVolumeCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(m.feeCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </>
  );
}
