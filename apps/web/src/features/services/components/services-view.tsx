"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Service } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { CategoryManagerDialog } from "@/features/categories";
import { useUpdateService } from "../hooks/use-services";
import { ServicesList } from "./services-list";
import { ServiceFormDialog } from "./service-form-dialog";
import { InactivateServiceDialog } from "./inactivate-service-dialog";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

export function ServicesView() {
  const [formState, setFormState] = useState<{
    open: boolean;
    service?: Service;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<Service | null>(null);
  // Deep-link do checklist de onboarding: /services?manage=categories abre o CRUD.
  const searchParams = useSearchParams();
  const [categoriesOpen, setCategoriesOpen] = useState(
    () => searchParams.get("manage") === "categories",
  );

  const updateMut = useUpdateService();
  const canManage = useCan()("services:manage");

  const openCreate = () => setFormState({ open: true });
  const openEdit = (service: Service) => setFormState({ open: true, service });

  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  async function reactivate(service: Service) {
    if (
      !(await confirmAction({
        title: "Reativar serviço?",
        description: `“${service.name}” volta a aparecer em novos agendamentos.`,
        confirmLabel: "Reativar",
      }))
    ) {
      return;
    }
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
      {confirmDialog}
      <PageHeader
        title="Serviços"
        description="Catálogo de serviços da unidade."
      >
        {canManage ? (
          <>
            <Button
              variant="outline"
              onClick={() => setCategoriesOpen(true)}
            >
              <Tags className="size-4" />
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
