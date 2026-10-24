import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, dateOnly, dateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/server/context";
import { SupportAccessError, loadSnapshot } from "@/lib/server/support-access";
import { AREA_LABEL, MODEL_LABEL, planName } from "@/lib/space-plan";
import { endAccessAction } from "../actions";

export const metadata: Metadata = { title: "Visão de suporte" };

const PROFILE = { owner: "Proprietário", manager: "Gerente", attendant: "Atendente", professional: "Profissional" } as Record<string, string>;
const STATUS = { active: "ativos", inactive: "inativos", suspended: "suspensos", pending: "pendentes", canceled: "cancelados", cancelled: "cancelados", paused: "pausados", trial: "em experiência" } as Record<string, string>;
// Cobrancas e recebimentos online (femininos).
const CHARGE_STATUS = { paid: "pagas", pending: "a receber", overdue: "em atraso", canceled: "canceladas", cancelled: "canceladas", awaiting: "aguardando o aluno", expired: "vencidas", failed: "com falha" } as Record<string, string>;
const GATEWAY = { approved: "aprovado", pending: "em análise no parceiro", rejected: "recusado", not_configured: "não configurado" } as Record<string, string>;

function Counts({ data, empty = "Nenhum.", labels = STATUS }: { data: Record<string, number>; empty?: string; labels?: Record<string, string> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y text-sm">
      {entries.map(([key, n]) => (
        <li key={key} className="flex justify-between py-1.5">
          <span>{labels[key] ?? key}</span>
          <span className="tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/** Visão de suporte: somente leitura, só configuração e totais (sem dados pessoais de aluno). */
export default async function SupportViewPage({ params }: { params: Promise<{ session: string }> }) {
  const { admin } = await requireAdmin("support:access");
  const { session } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(session)) return <Ended />;
  let data;
  try {
    data = await loadSnapshot(session, admin.id);
  } catch (error) {
    if (error instanceof SupportAccessError) return <Ended message={error.message} />;
    throw error;
  }
  const people = Object.entries(data.people).map(([key, n]) => {
    const [profile, status] = key.split(":");
    return { label: `${PROFILE[profile] ?? profile} (${STATUS[status] ?? status})`, n };
  });
  return (
    <>
      <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <span>
          Visão de suporte, <strong>somente leitura</strong>. Termina às {dateTime(new Date(data.expiresAt)).slice(11)}.
        </span>
        <form action={endAccessAction}>
          <input type="hidden" name="sessionId" value={session} />
          <input type="hidden" name="spaceId" value={data.organizationId} />
          <Button type="submit" size="sm" variant="outline">
            Encerrar visão
          </Button>
        </form>
      </div>
      <PageHeader title={data.space.name} description={`${data.space.customArea || AREA_LABEL[data.space.area ?? ""] || "Sem área"} · ${MODEL_LABEL[data.space.model] ?? data.space.model} · criado em ${dateOnly(new Date(data.space.createdAt))}`}>
        {data.space.status === "inactive" ? <Badge variant="destructive">Inativo</Badge> : null}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Plano: {planName(data.space.subscription as never)}</p>
            <p>Unidades ativas: {data.units}</p>
            <p>Fuso: {data.space.timeZone ?? "padrão"}</p>
            <p>Pagamento online: {GATEWAY[data.space.onlinePayments] ?? data.space.onlinePayments}</p>
            <p>
              Termos aceitos pelo proprietário: {data.owner?.termsVersion ? `versão ${data.owner.termsVersion}` : "sem registro"}
              {data.owner?.termsAcceptedAt ? ` em ${dateOnly(new Date(data.owner.termsAcceptedAt))}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pessoas do espaço</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {people.length === 0 ? <li className="py-1.5 text-muted-foreground">Nenhuma.</li> : null}
              {people.map((p) => (
                <li key={p.label} className="flex justify-between py-1.5">
                  <span>{p.label}</span>
                  <span className="tabular-nums">{p.n}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alunos</CardTitle>
          </CardHeader>
          <CardContent>
            <Counts data={data.students} />
            <p className="mt-3 text-xs text-muted-foreground">Matrículas</p>
            <Counts data={data.enrollments} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="pt-4">
            <CardTitle className="text-base">Turmas</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {data.classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma turma.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turma</TableHead>
                    <TableHead>Matriculados</TableHead>
                    <TableHead>Horários</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.classes.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="break-words">
                        {c.name} {c.status !== "active" ? <span className="text-muted-foreground">({c.status})</span> : null}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {c.enrolled}
                        {c.capacity ? ` de ${c.capacity}` : ""}
                      </TableCell>
                      <TableCell className="tabular-nums">{c.slots}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardHeader className="pt-4">
            <CardTitle className="text-base">Planos de mensalidade</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {data.plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum plano.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.plans.map((p) => (
                  <li key={p.name} className="flex justify-between gap-2 py-1.5">
                    <span className="break-words">{p.name}</span>
                    <span className="tabular-nums">{brl(p.priceCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Cobranças dos últimos 6 meses (totais)</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {data.charges.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cobrança no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.charges.map((c) => (
                  <TableRow key={`${c.competence}-${c.status}`}>
                    <TableCell>{c.competence}</TableCell>
                    <TableCell>{CHARGE_STATUS[c.status] ?? c.status}</TableCell>
                    <TableCell className="tabular-nums">{c.count}</TableCell>
                    <TableCell className="tabular-nums">{brl(c.totalCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Recebimentos online</p>
          <Counts data={data.onlinePaymentsByStatus} empty="Nenhum recebimento online." labels={CHARGE_STATUS} />
        </CardContent>
      </Card>
    </>
  );
}

function Ended({ message }: { message?: string }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6 text-sm">
        <p>{message ?? "Esta visão de suporte não existe ou terminou."}</p>
        <Button asChild variant="outline">
          <Link href="/spaces">Voltar aos espaços</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
