import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUDIT_GROUPS, auditActionLabel } from "@/lib/audit-labels";
import { requireAdmin } from "@/lib/server/context";
import { sql } from "@/lib/server/db";

export const metadata: Metadata = { title: "Auditoria" };

const PAGE_SIZE = 25;

/** Tudo o que foi feito no painel: so leitura, ninguem edita nem apaga. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ group?: string; page?: string }> }) {
  await requireAdmin("audit:view");
  const params = await searchParams;
  const group = AUDIT_GROUPS.some((g) => g.value === params.group) ? (params.group as string) : "all";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const prefix = group === "all" ? null : `${group}.%`;

  const rows = await sql()<
    { id: string; action: string; admin_name: string | null; organization_id: string | null; reason: string | null; ip: string | null; created_at: Date }[]
  >`
    select id, action, admin_name, organization_id, reason, ip, created_at
    from platform.audit_logs
    where (${prefix}::text is null or action like ${prefix})
    order by created_at desc
    limit ${PAGE_SIZE + 1} offset ${(page - 1) * PAGE_SIZE}`;
  const hasNext = rows.length > PAGE_SIZE;
  const shown = rows.slice(0, PAGE_SIZE);
  const link = (nextGroup: string, nextPage: number) => `/audit?group=${nextGroup}&page=${nextPage}`;

  return (
    <>
      <PageHeader title="Auditoria" description="Registro do que foi feito no painel. Só leitura." />
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
        {AUDIT_GROUPS.map((item) => (
          <Button key={item.value} asChild size="sm" variant={item.value === group ? "default" : "outline"}>
            <Link href={link(item.value, 1)}>{item.label}</Link>
          </Button>
        ))}
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Quem</TableHead>
              <TableHead>O que</TableHead>
              <TableHead>Espaço</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nada registrado ainda.
                </TableCell>
              </TableRow>
            ) : (
              shown.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(row.created_at, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="break-words">{row.admin_name ?? "—"}</TableCell>
                  <TableCell className="break-words">{auditActionLabel(row.action)}</TableCell>
                  <TableCell className="break-all text-muted-foreground">{row.organization_id ?? "—"}</TableCell>
                  <TableCell className="break-words text-muted-foreground">{row.reason ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.ip ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>Página {page}</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link href={link(group, page - 1)}>Anterior</Link>
            </Button>
          ) : null}
          {hasNext ? (
            <Button asChild variant="outline">
              <Link href={link(group, page + 1)}>Próxima</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
