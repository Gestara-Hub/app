import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { dateOnly } from "@/lib/format";
import { REQUEST_KINDS, REQUEST_STATUS, listRequests, requestCounts, type RequestFilter } from "@/lib/server/privacy";
import { requireAdmin } from "@/lib/server/context";
import { NewRequestForm, UpdateRequestForm } from "./privacy-forms";

export const metadata: Metadata = { title: "LGPD" };

const FILTERS: { value: RequestFilter; label: string }[] = [
  { value: "pending", label: "Em aberto" },
  { value: "overdue", label: "Vencidos" },
  { value: "closed", label: "Encerrados" },
  { value: "all", label: "Todos" },
];

/** Pedidos dos titulares de dados (LGPD): prazo de 15 dias, motivo e o que foi feito. */
export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin("lgpd:manage");
  const { filter: raw } = await searchParams;
  const filter = FILTERS.some((f) => f.value === raw) ? (raw as RequestFilter) : "pending";
  const [rows, counts] = await Promise.all([listRequests(filter), requestCounts()]);
  const now = new Date();
  return (
    <>
      <PageHeader
        title="LGPD"
        description={`${counts.pending} em aberto${counts.overdue > 0 ? `, ${counts.overdue} vencido${counts.overdue > 1 ? "s" : ""}` : ""}. Para exportar ou inativar um espaço, abra o espaço, aba Dados e LGPD.`}
      />
      <div className="mb-6">
        <NewRequestForm />
      </div>
      <nav className="mb-3 flex flex-wrap gap-2" aria-label="Filtro">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/privacy?filter=${f.value}`}
            className={`rounded-md border px-3 py-1 text-sm ${f.value === filter ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <Card className="divide-y py-0">
        {rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nenhum pedido aqui.</p> : null}
        {rows.map((row) => {
          const open = row.status === "open" || row.status === "in_progress";
          const overdue = open && row.dueAt < now;
          return (
            <div key={row.id} className="grid gap-3 p-4 md:grid-cols-2">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium break-words">
                  {REQUEST_KINDS[row.kind]} · {row.requesterName}
                </p>
                <p className="break-all text-muted-foreground">{row.requesterEmail}</p>
                {row.organizationId ? (
                  <p>
                    Espaço:{" "}
                    <Link href={`/spaces/${row.organizationId}?tab=dados`} className="underline">
                      {row.spaceName ?? row.organizationId}
                    </Link>
                  </p>
                ) : null}
                <p className="break-words whitespace-pre-wrap">{row.description}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  Recebido em {dateOnly(row.receivedAt)} · prazo {dateOnly(row.dueAt)}
                  {overdue ? <Badge variant="destructive">Vencido</Badge> : null}
                  {!open ? <Badge variant="secondary">{REQUEST_STATUS[row.status]}</Badge> : null}
                </p>
              </div>
              <UpdateRequestForm id={row.id} status={row.status} resolution={row.resolution ?? ""} />
            </div>
          );
        })}
      </Card>
    </>
  );
}
