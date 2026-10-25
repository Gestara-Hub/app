import type { Metadata } from "next";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SearchX, ThumbsUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/shared/back-link";
import { EmptyState } from "@/components/shared/empty-state";
import { ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/server/context";
import { listHelpFeedback, listHelpMisses } from "@/lib/server/support";

export const metadata: Metadata = { title: "Uso da ajuda" };

const DAYS = 30;

/** Pelo que o app mostra: o que as pessoas buscam e não acham, e quais artigos não ajudam. */
export default async function HelpUsagePage() {
  await requireAdmin("support:view");
  const [misses, feedback] = await Promise.all([listHelpMisses(DAYS), listHelpFeedback(DAYS)]);
  const missSearches = misses.reduce((sum, miss) => sum + miss.searches, 0);
  const helpful = feedback.reduce((sum, row) => sum + row.helpful, 0);
  const notHelpful = feedback.reduce((sum, row) => sum + row.notHelpful, 0);
  return (
    <>
      <BackLink href="/support" label="Voltar ao Suporte" />
      <PageHeader title="Uso da ajuda" description={`Últimos ${DAYS} dias. Mostra o que falta escrever e o que precisa melhorar nos artigos.`} />

      <StatGrid>
        <StatCard label="Buscas sem resultado" value={missSearches} tone={missSearches > 0 ? "warning" : "default"} sub={`${misses.length} ${misses.length === 1 ? "termo diferente" : "termos diferentes"}`} />
        <StatCard label="Avaliações" value={helpful + notHelpful} sub={`${feedback.length} ${feedback.length === 1 ? "trecho avaliado" : "trechos avaliados"}`} />
        <StatCard label="Ajudou" value={helpful} tone={helpful > 0 ? "success" : "default"} />
        <StatCard label="Não ajudou" value={notHelpful} tone={notHelpful > 0 ? "danger" : "default"} />
      </StatGrid>

      <section className="mb-8 space-y-2">
        <h2 className="px-1 text-base font-semibold">Buscas sem resultado</h2>
        <ListSummaryBar count={misses.length} singularLabel="termo" pluralLabel="termos" />
        <ListContainer emptyState={misses.length === 0 ? <EmptyState icon={SearchX} title="Nenhuma busca sem resultado no período" /> : undefined}>
          {misses.map((miss) => (
            <ListRow key={miss.term}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="min-w-0 break-words font-medium">{miss.term}</p>
                  <p className="text-xs text-muted-foreground">Última vez em {format(miss.lastAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    {miss.searches} {miss.searches === 1 ? "busca" : "buscas"}
                  </Badge>
                  <Badge variant="outline" className="font-normal tabular-nums">
                    {miss.spaces} {miss.spaces === 1 ? "espaço" : "espaços"}
                  </Badge>
                </div>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-base font-semibold">Isso ajudou?</h2>
        <ListSummaryBar count={feedback.length} singularLabel="trecho avaliado" pluralLabel="trechos avaliados" />
        <ListContainer emptyState={feedback.length === 0 ? <EmptyState icon={ThumbsUp} title="Ninguém avaliou um trecho no período" /> : undefined}>
          {feedback.map((row) => (
            <ListRow key={row.chunkId}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 break-all font-mono text-[11px] text-muted-foreground">{row.chunkId}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="border-success/40 bg-success/10 font-normal tabular-nums text-success">
                    {row.helpful} ajudou
                  </Badge>
                  <Badge variant="outline" className="border-destructive/40 bg-destructive/10 font-normal tabular-nums text-destructive">
                    {row.notHelpful} não ajudou
                  </Badge>
                </div>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      </section>
    </>
  );
}
