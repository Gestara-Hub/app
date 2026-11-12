import type { Metadata } from "next";
import { MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/shared/back-link";
import { EmptyState } from "@/components/shared/empty-state";
import { FormDrawer } from "@/components/shared/form-drawer";
import { ListContainer, ListRow } from "@/components/shared/list";
import { Pager } from "@/components/shared/pager";
import { UrlClearFilters, UrlSearch } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { normalizeSearch } from "@/lib/filter-input";
import { pageInfo, parsePage, rangeLabel } from "@/lib/pagination";
import { requireAdmin } from "@/lib/server/context";
import { MACRO_PAGE_SIZE, searchMacros } from "@/lib/server/macros";
import { MacroForm } from "./macro-form";
import { MacroRowActions } from "./macro-row-actions";

export const metadata: Metadata = { title: "Respostas prontas" };

export default async function MacrosPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin("support:reply");
  const params = await searchParams;
  const q = normalizeSearch(params.q);
  const { rows: macros, total, page } = await searchMacros({ q, page: parsePage(params.page) });
  const info = pageInfo(page, total, MACRO_PAGE_SIZE);
  const href = (next: number) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (next > 1) query.set("page", String(next));
    const text = query.toString();
    return text ? `/support/macros?${text}` : "/support/macros";
  };
  return (
    <>
      <BackLink href="/support" />
      <PageHeader title="Respostas prontas" description="Textos que você insere na resposta ao cliente com um clique.">
        <FormDrawer title="Nova resposta pronta" description="Fica disponível na caixa de resposta de cada conversa." trigger={<Button>+ Nova resposta pronta</Button>}>
          <MacroForm />
        </FormDrawer>
      </PageHeader>

      {total > 0 || q ? (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <UrlSearch placeholder="Buscar no título ou no texto" ariaLabel="Buscar respostas prontas" />
          <UrlClearFilters params={["q"]} />
        </div>
      ) : null}

      <div className="space-y-2">
        {total > 0 ? <p className="px-1 text-xs text-muted-foreground">{rangeLabel(info, "resposta pronta", "respostas prontas")}</p> : null}
        <ListContainer
          emptyState={
            macros.length === 0 ? (
              q ? (
                <EmptyState icon={MessageSquareText} title="Nenhuma resposta para esta busca" description="Mude o texto da busca ou limpe o filtro." />
              ) : (
                <EmptyState icon={MessageSquareText} title="Nenhuma resposta pronta ainda" description="Crie textos para as respostas que você repete.">
                  <FormDrawer title="Nova resposta pronta" trigger={<Button>+ Nova resposta pronta</Button>}>
                    <MacroForm />
                  </FormDrawer>
                </EmptyState>
              )
            ) : undefined
          }
        >
          {macros.map((macro) => (
            <ListRow key={macro.id} actions={<MacroRowActions macro={macro} />}>
              <p className="min-w-0 break-words font-medium">{macro.title}</p>
              <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-sm text-muted-foreground">{macro.body}</p>
            </ListRow>
          ))}
        </ListContainer>
      </div>
      <Pager page={page} hasNext={info.hasNext} totalPages={info.totalPages} href={href} />
    </>
  );
}
