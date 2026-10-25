import type { Metadata } from "next";
import { MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/shared/back-link";
import { EmptyState } from "@/components/shared/empty-state";
import { FormDrawer } from "@/components/shared/form-drawer";
import { ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/server/context";
import { listMacros } from "@/lib/server/support";
import { MacroForm } from "./macro-form";
import { MacroRowActions } from "./macro-row-actions";

export const metadata: Metadata = { title: "Respostas prontas" };

export default async function MacrosPage() {
  await requireAdmin("support:reply");
  const macros = await listMacros();
  return (
    <>
      <BackLink href="/support" label="Voltar ao Suporte" />
      <PageHeader title="Respostas prontas" description="Textos que você insere na resposta ao cliente com um clique.">
        <FormDrawer title="Nova resposta pronta" description="Fica disponível na caixa de resposta de cada conversa." trigger={<Button>+ Nova resposta pronta</Button>}>
          <MacroForm />
        </FormDrawer>
      </PageHeader>

      <div className="space-y-2">
        <ListSummaryBar count={macros.length} singularLabel="resposta pronta" pluralLabel="respostas prontas" />
        <ListContainer
          emptyState={
            macros.length === 0 ? (
              <EmptyState icon={MessageSquareText} title="Nenhuma resposta pronta ainda" description="Crie textos para as respostas que você repete.">
                <FormDrawer title="Nova resposta pronta" trigger={<Button>+ Nova resposta pronta</Button>}>
                  <MacroForm />
                </FormDrawer>
              </EmptyState>
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
    </>
  );
}
