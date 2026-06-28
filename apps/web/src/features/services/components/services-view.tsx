"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@/lib/api-error";
import type { Servico } from "@/types";
import { useUpdateService } from "../hooks/use-services";
import { ServicesList } from "./services-list";
import { ServiceFormDialog } from "./service-form-dialog";
import { InactivateServiceDialog } from "./inactivate-service-dialog";

export function ServicesView() {
  const [formState, setFormState] = useState<{
    open: boolean;
    service?: Servico;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<Servico | null>(null);

  const updateMut = useUpdateService();

  const openCreate = () => setFormState({ open: true });
  const openEdit = (service: Servico) => setFormState({ open: true, service });

  async function reactivate(service: Servico) {
    try {
      await updateMut.mutateAsync({
        id: service.id,
        payload: { status: "ativo" },
      });
      toast.success("Serviço reativado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível reativar o serviço."));
    }
  }

  return (
    <>
      <PageHeader
        title="Serviços"
        description="Catálogo de serviços da Corte Nobre — Matriz."
      >
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Novo serviço
        </Button>
      </PageHeader>

      <ServicesList
        onCreate={openCreate}
        onEdit={openEdit}
        onInactivate={setInactivating}
        onReactivate={reactivate}
      />

      <ServiceFormDialog
        open={formState.open}
        onOpenChange={(open) => {
          if (!open) setFormState({ open: false });
        }}
        service={formState.service}
      />

      <InactivateServiceDialog
        service={inactivating}
        onOpenChange={(open) => {
          if (!open) setInactivating(null);
        }}
      />
    </>
  );
}
