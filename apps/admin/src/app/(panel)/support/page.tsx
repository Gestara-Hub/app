import type { Metadata } from "next";
import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { SlaBadge, StatusBadge, UrgentBadge } from "@/components/support/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { PAGE_SIZE, listThreads, threadCounts } from "@/lib/server/support";
import { FILTERS, isThreadFilter } from "@/lib/support-types";

export const metadata: Metadata = { title: "Suporte" };

/** Caixa de entrada do "Fale com a gente": quem espera resposta nossa vem primeiro (urgentes e mais antigos). */
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; page?: string }> }) {
  const { admin } = await requireAdmin("support:view");
  const params = await searchParams;
  const filter = isThreadFilter(params.filter) ? params.filter : "attention";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const q = params.q?.trim() ?? "";
  const [{ rows, hasNext }, counts] = await Promise.all([listThreads({ filter, q, page }), threadCounts()]);
  const now = new Date();
  const link = (nextFilter: string, nextPage = 1) =>
    `/support?filter=${nextFilter}${q ? `&q=${encodeURIComponent(q)}` : ""}${nextPage > 1 ? `&page=${nextPage}` : ""}`;

  return (
    <>
      <PageHeader title="Suporte" description="Conversas do Fale com a gente. A meta é responder em até 2 dias úteis.">
        {can(admin.role, "support:reply") ? (
          <Button asChild variant="outline">
            <Link href="/support/macros">Respostas prontas</Link>
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="gap-1 p-4">
          <p className="text-xs text-muted-foreground">Precisam de resposta</p>
          <p className="text-2xl font-semibold tabular-nums">{counts.attention}</p>
        </Card>
        <Card className="gap-1 p-4">
          <p className="text-xs text-muted-foreground">Urgentes</p>
          <p className="text-2xl font-semibold tabular-nums">{counts.urgent}</p>
        </Card>
        <Card className="gap-1 p-4">
          <p className="text-xs text-muted-foreground">Aguardando o cliente</p>
          <p className="text-2xl font-semibold tabular-nums">{counts.waitingCustomer}</p>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar conversas">
          {FILTERS.map((item) => (
            <Button key={item.value} asChild size="sm" variant={item.value === filter ? "default" : "outline"}>
              <Link href={link(item.value)}>{item.label}</Link>
            </Button>
          ))}
        </div>
        <form className="flex gap-2" action="/support">
          <input type="hidden" name="filter" value={filter} />
          <Input name="q" defaultValue={q} placeholder="Buscar espaço, pessoa ou assunto" aria-label="Buscar conversas" className="w-64 text-base md:text-sm" />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assunto</TableHead>
              <TableHead>Espaço e pessoa</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Última mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Nenhuma conversa aqui.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-72">
                    <Link href={`/support/${row.id}`} className="font-medium break-words hover:underline">
                      {row.subject}
                    </Link>
                  </TableCell>
                  <TableCell className="break-words">
                    <p>{row.organizationName}</p>
                    <p className="text-xs text-muted-foreground">{row.userName}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={row.status} />
                      {row.urgent ? <UrgentBadge /> : null}
                      <SlaBadge status={row.status} since={row.lastCustomerMessageAt ?? row.createdAt} now={now} />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground" title={format(row.lastMessageAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}>
                    {formatDistanceToNowStrict(row.lastMessageAt, { locale: ptBR, addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {page} · até {PAGE_SIZE} por página
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link href={link(filter, page - 1)}>Anterior</Link>
            </Button>
          ) : null}
          {hasNext ? (
            <Button asChild variant="outline">
              <Link href={link(filter, page + 1)}>Próxima</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
