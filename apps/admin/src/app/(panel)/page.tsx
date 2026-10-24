import type { Metadata } from "next";
import { CheckCircle2, Database, ShieldCheck, Timer } from "lucide-react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_ROLE_LABEL, can } from "@/lib/permissions";
import { sql } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/context";
import { auditActionLabel } from "@/lib/audit-labels";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session-token";

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

  return (
    <>
      <PageHeader title={`Olá, ${admin.name.split(" ")[0]}`} description="Alicerce do painel: acesso seguro e conexão com os dados. As telas de operação chegam nas próximas fases." />

      {denied ? (
        <p role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Seu papel não tem acesso a essa tela.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ShieldCheck className="size-4" /> Sua sessão
            </CardDescription>
            <CardTitle className="text-base">{ADMIN_ROLE_LABEL[admin.role]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-success" /> Verificação em duas etapas feita
            </p>
            <p className="flex items-center gap-1.5">
              <Timer className="size-4" /> Vale até {format(endsAt, "HH:mm", { locale: ptBR })} (8 horas)
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
            <CardDescription>Último acesso</CardDescription>
            <CardTitle className="text-base">
              {admin.lastLoginAt ? formatDistanceToNowStrict(admin.lastLoginAt, { locale: ptBR, addSuffix: true }) : "Primeiro acesso"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{admin.email}</CardContent>
        </Card>
      </div>

      {recent.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Atividade recente</CardTitle>
            <CardDescription>As últimas ações registradas no painel.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {recent.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 break-words">
                    {auditActionLabel(entry.action)}
                    {entry.admin_name ? <span className="text-muted-foreground"> · {entry.admin_name}</span> : null}
                  </span>
                  <Badge variant="secondary" className="font-normal">
                    {format(entry.created_at, "dd/MM HH:mm", { locale: ptBR })}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
