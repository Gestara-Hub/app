"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Category } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { useUpdateCategory } from "@/features/categories";
import { ModalitiesList } from "./modalities-list";
import { ModalityFormDialog } from "./modality-form-dialog";
import { InactivateModalityDialog } from "./inactivate-modality-dialog";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

export function ModalitiesView() {
  const [formState, setFormState] = useState<{
    open: boolean;
    modality?: Category;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<Category | null>(null);

  const updateMut = useUpdateCategory();
  const canManage = useCan()("classes:manage");

  const openCreate = () => setFormState({ open: true });
  const openEdit = (modality: Category) => setFormState({ open: true, modality });

  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  async function reactivate(modality: Category) {
    if (
      !(await confirmAction({
        title: "Reativar modalidade?",
        description: `“${modality.name}” volta a aparecer para turmas e professores.`,
        confirmLabel: "Reativar",
      }))
    ) {
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: modality.id,
        payload: { status: "active" },
      });
      toast.success("Modalidade reativada.");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Não foi possível reativar a modalidade."),
      );
    }
  }

  return (
    <>
      {confirmDialog}
      <PageHeader
        title="Modalidades"
        description="Os tipos de aula que a unidade oferece. As turmas e os instrutores se organizam por elas."
      >
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nova modalidade
          </Button>
        ) : null}
      </PageHeader>

      <ModalitiesList
        canManage={canManage}
        onCreate={openCreate}
        onEdit={openEdit}
        onInactivate={setInactivating}
        onReactivate={reactivate}
      />

      <ModalityFormDialog
        open={formState.open}
        onOpenChange={(open) => {
          if (!open) setFormState((state) => ({ ...state, open: false }));
        }}
        modality={formState.modality}
      />

      <InactivateModalityDialog
        modality={inactivating}
        onOpenChange={(open) => {
          if (!open) setInactivating(null);
        }}
      />
    </>
  );
}
