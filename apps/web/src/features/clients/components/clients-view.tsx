"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Client } from "@gestarahub/contracts";
import { useCan } from "@/features/auth/session-provider";
import { useUpdateClient } from "../hooks/use-clients";
import { ClientsList } from "./clients-list";
import { ClientFormDialog } from "./client-form-dialog";
import { InactivateClientDialog } from "./inactivate-client-dialog";

export function ClientsView() {
  const [formState, setFormState] = useState<{
    open: boolean;
    client?: Client;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<Client | null>(null);

  const updateMut = useUpdateClient();
  const canManage = useCan()("clients:manage");

  const openCreate = () => setFormState({ open: true });
  const openEdit = (client: Client) => setFormState({ open: true, client });

  async function reactivate(client: Client) {
    try {
      await updateMut.mutateAsync({
        id: client.id,
        payload: { status: "active" },
      });
      toast.success("Cliente reativado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível reativar o cliente."));
    }
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes da Corte Nobre."
      >
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo cliente
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
