import { RelativeTime } from "@/components/shared/relative-time";
import { relativeTime } from "@/lib/relative-time";
import type { Metadata } from "next";
import { Eye, EyeOff, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import { ConfirmSubmit } from "@/components/shared/confirm-submit";
import { EmptyState } from "@/components/shared/empty-state";
import { Fact, FactCard, SectionHeading } from "@/components/shared/fact-list";
import { ListContainer, ListRow } from "@/components/shared/list";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl } from "@/lib/format";
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
    <dl>
      {entries.map(([key, n]) => (
        <Fact key={key} label={labels[key] ?? key} value={<span className="tabular-nums">{n}</span>} />
      ))}
    </dl>
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
      <BackLink href={`/spaces/${data.organizationId}?tab=suporte`} label="Voltar ao espaço" />
      <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <Eye className="size-4 shrink-0 text-warning" aria-hidden />
          <span>
            Visão de suporte, <strong>somente leitura</strong>. Termina <RelativeTime date={new Date(data.expiresAt)} />.
          </span>
        </span>
        <form action={endAccessAction}>
          <input type="hidden" name="sessionId" value={session} />
          <input type="hidden" name="spaceId" value={data.organizationId} />
          <ConfirmSubmit title="Encerrar a visão de suporte" description="A visão fecha agora e você volta para o espaço. Para ver de novo, é preciso abrir outra com um novo motivo." confirmLabel="Encerrar visão">
            Encerrar visão
          </ConfirmSubmit>
        </form>
      </div>
      <PageHeader title={data.space.name} description={`${data.space.customArea || AREA_LABEL[data.space.area ?? ""] || "Sem área"} · ${MODEL_LABEL[data.space.model] ?? data.space.model} · criado ${relativeTime(new Date(data.space.createdAt))}`}>
        {data.space.status === "inactive" ? <Badge variant="destructive">Inativo</Badge> : null}
      </PageHeader>

      <StatGrid>
        <StatCard label="Plano" value={planName(data.space.subscription as never)} />
        <StatCard label="Unidades ativas" value={data.units} />
        <StatCard label="Pagamento online" value={GATEWAY[data.space.onlinePayments] ?? data.space.onlinePayments} />
        <StatCard label="Fuso" value={data.space.timeZone ?? "Padrão"} />
      </StatGrid>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <FactCard title="Termos de uso">
          <Fact label="Versão aceita pelo proprietário" value={data.owner?.termsVersion ? `v${data.owner.termsVersion.replace(/^v/, "")}` : "Sem registro"} />
          {data.owner?.termsAcceptedAt ? <Fact label="Aceita em" value={<RelativeTime date={new Date(data.owner.termsAcceptedAt)} />} /> : null}
        </FactCard>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pessoas do espaço</CardTitle>
          </CardHeader>
          <CardContent>
            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma.</p>
            ) : (
              <dl>
                {people.map((p) => (
                  <Fact key={p.label} label={p.label} value={<span className="tabular-nums">{p.n}</span>} />
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alunos</CardTitle>
          </CardHeader>
          <CardContent>
            <Counts data={data.students} />
            <p className="mt-3 text-xs font-medium text-muted-foreground">Matrículas</p>
            <Counts data={data.enrollments} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading title="Turmas" />
          {data.classes.length === 0 ? (
            <ListContainer emptyState={<EmptyState icon={Users} title="Nenhuma turma" />} />
          ) : (
            <ListContainer>
              {data.classes.map((c) => (
                <ListRow key={c.name}>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <p className="min-w-0 break-words font-medium">
                      {c.name} {c.status !== "active" ? <span className="font-normal text-muted-foreground">({c.status})</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {c.enrolled}
                      {c.capacity ? ` de ${c.capacity}` : ""} matriculados · {c.slots} {c.slots === 1 ? "horário" : "horários"}
                    </p>
                  </div>
                </ListRow>
              ))}
            </ListContainer>
          )}
        </section>
        <section>
          <SectionHeading title="Planos de mensalidade" />
          {data.plans.length === 0 ? (
            <ListContainer emptyState={<EmptyState icon={Wallet} title="Nenhum plano" />} />
          ) : (
            <ListContainer>
              {data.plans.map((p) => (
                <ListRow key={p.name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words font-medium">{p.name}</span>
                    <span className="tabular-nums">{brl(p.priceCents)}</span>
                  </div>
                </ListRow>
              ))}
            </ListContainer>
          )}
        </section>
      </div>

      <section>
        <SectionHeading title="Cobranças dos últimos 6 meses" description="Só totais." />
        {data.charges.length === 0 ? (
          <ListContainer emptyState={<EmptyState icon={Wallet} title="Nenhuma cobrança no período" />} />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.charges.map((c) => (
                  <TableRow key={`${c.competence}-${c.status}`}>
                    <TableCell>{c.competence}</TableCell>
                    <TableCell>{CHARGE_STATUS[c.status] ?? c.status}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(c.totalCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Recebimentos online</CardTitle>
          </CardHeader>
          <CardContent>
            <Counts data={data.onlinePaymentsByStatus} empty="Nenhum recebimento online." labels={CHARGE_STATUS} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function Ended({ message }: { message?: string }) {
  return (
    <>
      <BackLink href="/spaces" label="Voltar aos espaços" />
      <Card>
        <EmptyState icon={EyeOff} title={message ?? "Esta visão de suporte não existe ou terminou."} description="Abra uma nova pela aba Suporte e notas do espaço." />
      </Card>
    </>
  );
}
