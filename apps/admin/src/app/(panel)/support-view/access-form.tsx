"use client";

import { FormProvider } from "react-hook-form";
import { Eye } from "lucide-react";
import { FormFeedback, TextArea, useActionForm } from "@/components/form";
import { DrawerBody, DrawerFooter, FormDrawer } from "@/components/shared/form-drawer";
import { ListContainer, ListRow } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import { accessSchema } from "@/lib/form-schemas";
import { startAccessAction, type AccessFormState } from "./actions";

/** Linha "Ver como o suporte": o botão abre a gaveta que pede o motivo e abre a visão de suporte do espaço. */
export function AccessForm({ spaceId }: { spaceId: string }) {
  return (
    <ListContainer>
      <ListRow
        actions={
          <FormDrawer
            title="Ver como o suporte"
            description="Visão só de leitura, por 30 minutos, com a configuração e os totais do espaço. Não mostra nome, telefone nem dados dos alunos. O dono vê o aviso na Auditoria dele."
            trigger={
              <Button variant="outline">
                <Eye /> Abrir visão
              </Button>
            }
          >
            <AccessDrawerForm spaceId={spaceId} />
          </FormDrawer>
        }
      >
        <p className="font-medium">Ver como o suporte</p>
        <p className="min-w-0 break-words text-sm text-muted-foreground">Só leitura, por 30 minutos, com a configuração e os totais. Nenhum dado de aluno.</p>
      </ListRow>
    </ListContainer>
  );
}

function AccessDrawerForm({ spaceId }: { spaceId: string }) {
  const { form, state, pending, submit } = useActionForm<typeof accessSchema, AccessFormState>({
    schema: accessSchema,
    defaultValues: { spaceId, reason: "" },
    action: startAccessAction,
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="flex min-h-0 flex-1 flex-col" noValidate>
        <DrawerBody>
          <TextArea name="reason" label="Motivo (fica registrado)" required rows={3} maxLength={300} />
          <FormFeedback state={state} />
        </DrawerBody>
        <DrawerFooter submitLabel="Abrir visão de suporte" pendingLabel="Abrindo..." pending={pending} />
      </form>
    </FormProvider>
  );
}
