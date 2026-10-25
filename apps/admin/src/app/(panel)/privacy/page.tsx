import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FormDrawer } from "@/components/shared/form-drawer";
import { InitialsAvatar, ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { SegmentedLinks } from "@/components/shared/segmented-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const summary =
    counts.pending === 0
      ? "Nenhum pedido em aberto."
      : `${counts.pending} pedido${counts.pending > 1 ? "s" : ""} em aberto${counts.overdue > 0 ? `, ${counts.overdue} vencido${counts.overdue > 1 ? "s" : ""}` : ""}.`;
  return (
    <>
      <PageHeader title="LGPD" description={`${summary} Para exportar ou inativar um espaço, abra o espaço, aba Dados e LGPD.`}>
        <FormDrawer
          title="Registrar pedido do titular"
          description="Quando alguém pede acesso, correção, exclusão ou portabilidade dos dados. O prazo de resposta é de 15 dias."
          trigger={
            <Button>
              <Plus className="size-4" /> Registrar pedido
            </Button>
          }
        >
          <NewRequestForm />
        </FormDrawer>
      </PageHeader>
      <div className="mb-4">
        <SegmentedLinks
          label="Filtro"
          items={FILTERS.map((f) => ({ ...f, count: f.value === "pending" ? counts.pending : f.value === "overdue" ? counts.overdue : undefined }))}
          active={filter}
          href={(value) => `/privacy?filter=${value}`}
        />
      </div>
      <div className="space-y-2">
        <ListSummaryBar count={rows.length} singularLabel="pedido" pluralLabel="pedidos" />
        <ListContainer emptyState={rows.length === 0 ? <EmptyState icon={ShieldCheck} title="Nenhum pedido aqui." /> : undefined}>
          {rows.map((row) => {
            const open = row.status === "open" || row.status === "in_progress";
            const overdue = open && row.dueAt < now;
            return (
              <ListRow
                key={row.id}
                actions={
                  <FormDrawer title="Atualizar pedido" description={`${REQUEST_KINDS[row.kind]} · ${row.requesterName}`} trigger={<Button variant="outline">Atualizar</Button>}>
                    <UpdateRequestForm id={row.id} status={row.status} resolution={row.resolution ?? ""} />
                  </FormDrawer>
                }
              >
                <div className="flex items-start gap-3">
                  <InitialsAvatar name={row.requesterName} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 break-words text-sm font-medium">{row.requesterName}</p>
                      <Badge variant="outline" className="font-normal">
                        {REQUEST_KINDS[row.kind]}
                      </Badge>
                      {overdue ? <Badge variant="destructive">Vencido</Badge> : null}
                      <Badge variant="secondary" className="font-normal">{REQUEST_STATUS[row.status]}</Badge>
                    </div>
                    <p className="min-w-0 break-all text-xs text-muted-foreground">{row.requesterEmail}</p>
                    <p className="min-w-0 whitespace-pre-wrap break-words text-sm">{row.description}</p>
                    {row.resolution ? (
                      <p className="min-w-0 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        <span className="font-medium">Feito: </span>
                        {row.resolution}
                      </p>
                    ) : null}
                    <p className="min-w-0 break-words text-xs text-muted-foreground">
                      Recebido em {dateOnly(row.receivedAt)} · prazo {dateOnly(row.dueAt)}
                      {row.organizationId ? (
                        <>
                          {" · Espaço: "}
                          <Link href={`/spaces/${row.organizationId}?tab=dados`} className="underline underline-offset-2">
                            {row.spaceName ?? "Ver espaço"}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              </ListRow>
            );
          })}
        </ListContainer>
      </div>
    </>
  );
}
