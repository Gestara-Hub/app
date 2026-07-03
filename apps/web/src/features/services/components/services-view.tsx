"use client";

import { useState } from "react";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Service } from "@gestarahub/contracts";
import { useCan } from "@/features/auth/session-provider";
import { CategoryManagerDialog } from "@/features/categories/components/category-manager-dialog";
import { useUpdateService } from "../hooks/use-services";
import { ServicesList } from "./services-list";
import { ServiceFormDialog } from "./service-form-dialog";
import { InactivateServiceDialog } from "./inactivate-service-dialog";

export function ServicesView() {
  const [formState, setFormState] = useState<{
    open: boolean;
    service?: Service;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<Service | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const updateMut = useUpdateService();
  const canManage = useCan()("services:manage");

  const openCreate = () => setFormState({ open: true });
  const openEdit = (service: Service) => setFormState({ open: true, service });

  async function reactivate(service: Service) {
    try {
      await updateMut.mutateAsync({
        id: service.id,
        payload: { status: "active" },
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
        {canManage ? (
          <>
            <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
              <Tag className="size-4" />
              Categorias
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Novo serviço
            </Button>
          </>
        ) : null}
      </PageHeader>

      <ServicesList
        canManage={canManage}
        onCreate={openCreate}
        onEdit={openEdit}
        onInactivate={setInactivating}
        onReactivate={reactivate}
      />

      <ServiceFormDialog
        open={formState.open}
        onOpenChange={(open) => {
          if (!open) setFormState((state) => ({ ...state, open: false }));
        }}
        service={formState.service}
      />

      <InactivateServiceDialog
        service={inactivating}
        onOpenChange={(open) => {
          if (!open) setInactivating(null);
        }}
      />

      <CategoryManagerDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
      />
    </>
  );
}
