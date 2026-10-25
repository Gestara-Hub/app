import { RelativeTime } from "@/components/shared/relative-time";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, Database, ShieldCheck, Timer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { ListContainer, ListRow } from "@/components/shared/list";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_ROLE_LABEL, can } from "@/lib/permissions";
import { sql } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/context";
import { auditActionLabel } from "@/lib/audit-labels";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session-token";
import { errorTotals } from "@/lib/server/health";
import { overdueSpaces } from "@/lib/server/plans";
import { requestCounts } from "@/lib/server/privacy";
import { threadCounts } from "@/lib/server/support";

export const metadata: Metadata = { title: "Início" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { admin, startedAtMs } = await requireAdmin();
  const { denied } = await searchParams;
  const [{ spaces }] = await sql()<{ spaces: number }[]>`select count(*)::int as spaces from public.organizations`;
  const recent = can(admin.role, "audit:view")
    ? await sql()<{ id: string; action: string; admin_name: string | null; created_at: Date }[]>`
        select id, action, admin_name, created_at from platform.audit_logs order by created_at desc limit 5`
    : [];
  const endsAt = new Date(startedAtMs + SESSION_MAX_AGE_SECONDS * 1000);

  // O que pede ação hoje, só do que o papel enxerga.
  const attention: { href: string; label: string; value: number; detail: string; tone: "default" | "warning" | "danger" }[] = [];
  if (can(admin.role, "support:view")) {
    const t = await threadCounts();
    attention.push({ href: "/support", label: "Conversas esperando resposta", value: t.attention, detail: t.urgent > 0 ? `${t.urgent} urgente${t.urgent > 1 ? "s" : ""}` : "Meta: até 2 dias úteis", tone: t.urgent > 0 ? "danger" : "warning" });
  }
  if (can(admin.role, "health:view")) {
    const e = await errorTotals();
    attention.push({ href: "/health", label: "Erros hoje", value: e.today, detail: `${e.spacesAffected} espaço${e.spacesAffected === 1 ? "" : "s"} afetado${e.spacesAffected === 1 ? "" : "s"}, ${e.unknown} sem explicação`, tone: "danger" });
  }
  if (can(admin.role, "plans:view")) {
    const o = await overdueSpaces();
    attention.push({ href: "/plans", label: "Renovações atrasadas", value: o.length, detail: "Planos pagos com a data vencida", tone: "warning" });
  }
  if (can(admin.role, "lgpd:manage")) {
    const r = await requestCounts();
    attention.push({ href: "/privacy", label: "Pedidos de dados (LGPD)", value: r.pending, detail: r.overdue > 0 ? `${r.overdue} fora do prazo de 15 dias` : "Prazo de 15 dias", tone: r.overdue > 0 ? "danger" : "warning" });
  }

  return (
    <>
      <PageHeader title={`Olá, ${admin.name.split(" ")[0]}`} description="O que pede atenção hoje e o estado da sua sessão." />

      {denied ? (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Seu papel não tem acesso a essa tela.
        </p>
      ) : null}

      {attention.length > 0 ? (
        <StatGrid>
          {attention.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
              <StatCard label={item.label} value={item.value} sub={item.detail} tone={item.value > 0 ? item.tone : "default"} className="h-full" />
            </Link>
          ))}
        </StatGrid>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ShieldCheck className="size-4" /> Sua sessão
            </CardDescription>
            <CardTitle className="text-base">{ADMIN_ROLE_LABEL[admin.role]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> <span className="min-w-0 break-words">Verificação em duas etapas feita</span>
            </p>
            <p className="flex items-start gap-1.5">
              <Timer className="mt-0.5 size-4 shrink-0" /> <span className="min-w-0 break-words">Vale até {format(endsAt, "HH:mm", { locale: ptBR })} (8 horas)</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Database className="size-4" /> Dados da plataforma
            </CardDescription>
            <CardTitle className="text-base">Conectado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {spaces === 1 ? "1 espaço cadastrado" : `${spaces} espaços cadastrados`}. O painel só lê os dados dos clientes; nada é gravado
            neles por aqui.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="size-4" /> Último acesso
            </CardDescription>
            <CardTitle className="text-base"><RelativeTime date={admin.lastLoginAt} empty="Primeiro acesso" /></CardTitle>
          </CardHeader>
          <CardContent className="break-all text-sm text-muted-foreground">{admin.email}</CardContent>
        </Card>
      </div>

      {recent.length > 0 ? (
        <section className="mt-6 space-y-2">
          <div className="px-1">
            <h2 className="text-base font-semibold">Atividade recente</h2>
            <p className="text-sm text-muted-foreground">As últimas ações registradas no painel.</p>
          </div>
          <ListContainer>
            {recent.map((entry) => (
              <ListRow key={entry.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 break-words">
                    {auditActionLabel(entry.action)}
                    {entry.admin_name ? <span className="text-muted-foreground"> · {entry.admin_name}</span> : null}
                  </span>
                  <Badge variant="secondary" className="font-normal">
                    <RelativeTime date={entry.created_at} />
                  </Badge>
                </div>
              </ListRow>
            ))}
          </ListContainer>
        </section>
      ) : null}
    </>
  );
}
