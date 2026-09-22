"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Client } from "@gestarahub/contracts";
import { useCan, useModel } from "@/features/auth";
import { useUpdateClient } from "../hooks/use-clients";
import { ClientsList } from "./clients-list";
import { ClientFormDialog } from "./client-form-dialog";
import { InactivateClientDialog } from "./inactivate-client-dialog";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

export function ClientsView() {
  const isClasses = useModel() === "classes";
  const [formState, setFormState] = useState<{
    open: boolean;
    client?: Client;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<Client | null>(null);

  const updateMut = useUpdateClient();
  const canManage = useCan()("clients:manage");

  const openCreate = () => setFormState({ open: true });
  const openEdit = (client: Client) => setFormState({ open: true, client });

  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  async function reactivate(client: Client) {
    if (
      !(await confirmAction({
        title: `Reativar ${isClasses ? "aluno" : "cliente"}?`,
        description: `“${client.name}” volta a aparecer em ${isClasses ? "novas matrículas" : "novos agendamentos"}.`,
        confirmLabel: "Reativar",
      }))
    ) {
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: client.id,
        payload: { status: "active" },
      });
      toast.success(isClasses ? "Aluno reativado." : "Cliente reativado.");
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          isClasses
            ? "Não foi possível reativar o aluno."
            : "Não foi possível reativar o cliente.",
        ),
      );
    }
  }

  return (
    <>
      {confirmDialog}
      <PageHeader
        title={isClasses ? "Alunos" : "Clientes"}
        description={
          isClasses
            ? "Cadastro e histórico de alunos."
            : "Cadastro e histórico de clientes."
        }
      >
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {isClasses ? "Novo aluno" : "Novo cliente"}
          </Button>
        ) : null}
      </PageHeader>

      <ClientsList
        canManage={canManage}
        onCreate={openCreate}
        onEdit={openEdit}
        onInactivate={setInactivating}
        onReactivate={reactivate}
      />

      <ClientFormDialog
        open={formState.open}
        onOpenChange={(open) => {
          if (!open) setFormState((state) => ({ ...state, open: false }));
        }}
        client={formState.client}
      />

      <InactivateClientDialog
        client={inactivating}
        onOpenChange={(open) => {
          if (!open) setInactivating(null);
        }}
      />
    </>
  );
}
