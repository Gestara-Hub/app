import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const stat = (label: string, value: string, sub?: string) => (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {sub ? <CardContent className="text-xs text-muted-foreground">{sub}</CardContent> : null}
    </Card>
  );
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat("Receita mensal", brl(subs.mrrCents), `${subs.payingTotal} ${subs.payingTotal === 1 ? "espaço pagando" : "espaços pagando"}`)}
        {stat("Em cortesia", String(subs.courtesy), "Não entram na receita")}
        {stat("Usaram nos últimos 30 dias", pct(steps.active30d, steps.spacesTotal), `${steps.active30d} de ${steps.spacesTotal} espaços`)}
        {stat("Pagantes que usaram", pct(steps.payingActive30d, steps.paying), `${steps.payingActive30d} de ${steps.paying}`)}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="pt-4">
            <CardTitle className="text-base">Assinantes por plano</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {subs.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum espaço pagando ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano</TableHead>
                    <TableHead>Espaços</TableHead>
                    <TableHead>Receita mensal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.rows.map((r) => (
                    <TableRow key={`${r.tier}-${r.interval}`}>
                      <TableCell>
                        {TIER_LABEL[r.tier]} {r.interval === "yearly" ? "anual" : "mensal"}
                      </TableCell>
                      <TableCell className="tabular-nums">{r.count}</TableCell>
                      <TableCell className="tabular-nums">{brl(r.mrrCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardHeader className="pt-4">
            <CardTitle className="text-base">Da criação ao plano pago</CardTitle>
            <CardDescription>Quantos espaços ativos chegaram a cada passo.</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <ul className="divide-y text-sm">
              {funnelRows.map(([label, n]) => (
                <li key={label} className="flex items-center justify-between py-1.5">
                  <span>{label}</span>
                  <span className="tabular-nums">
                    {n} <span className="text-muted-foreground">({pct(n, steps.spacesTotal)})</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Movimento dos últimos 6 meses</CardTitle>
          <CardDescription>A taxa é o que o GestaraHub recebe dos pagamentos online dos espaços.</CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Novos espaços</TableHead>
                <TableHead>Assinaram</TableHead>
                <TableHead>Subiram</TableHead>
                <TableHead>Reduziram</TableHead>
                <TableHead>Cancelaram</TableHead>
                <TableHead>Voltaram ao Grátis</TableHead>
                <TableHead>Pagamentos online</TableHead>
                <TableHead>Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{monthLabel(m.month)}</TableCell>
                  <TableCell className="tabular-nums">{m.created}</TableCell>
                  <TableCell className="tabular-nums">{m.activated}</TableCell>
                  <TableCell className="tabular-nums">{m.upgraded}</TableCell>
                  <TableCell className="tabular-nums">{m.downgraded}</TableCell>
                  <TableCell className="tabular-nums">{m.canceled}</TableCell>
                  <TableCell className="tabular-nums">{m.revertedToFree}</TableCell>
                  <TableCell className="tabular-nums">
                    {m.onlineCount} · {brl(m.onlineVolumeCents)}
                  </TableCell>
                  <TableCell className="tabular-nums">{brl(m.feeCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
