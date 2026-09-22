"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { ProfessionalView } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { RoleManagerDialog } from "@/features/roles";
import { useUpdateProfessional } from "../hooks/use-professionals";
import { ProfessionalsList } from "./professionals-list";
import { ProfessionalFormDialog } from "./professional-form-dialog";
import { InactivateProfessionalDialog } from "./inactivate-professional-dialog";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

export function ProfessionalsView() {
  const [formState, setFormState] = useState<{
    open: boolean;
    professional?: ProfessionalView;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<ProfessionalView | null>(
    null,
  );
  // Deep-link do checklist de onboarding: /team?manage=roles abre o CRUD de Cargos.
  const searchParams = useSearchParams();
  const [rolesOpen, setRolesOpen] = useState(
    () => searchParams.get("manage") === "roles",
  );

  const updateMut = useUpdateProfessional();
  const canManage = useCan()("team:manage");

  const openCreate = () => setFormState({ open: true });
  const openEdit = (professional: ProfessionalView) =>
    setFormState({ open: true, professional });

  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  async function reactivate(professional: ProfessionalView) {
    if (
      !(await confirmAction({
        title: "Reativar profissional?",
        description: `“${professional.name}” volta a aparecer nas escalas e atribuições.`,
        confirmLabel: "Reativar",
      }))
    ) {
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: professional.id,
        payload: { status: "active" },
      });
      toast.success("Profissional reativado.");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Não foi possível reativar o profissional."),
      );
    }
  }

  return (
    <>
      {confirmDialog}
      <PageHeader
        title="Equipe"
        description="Profissionais da unidade e a disponibilidade de cada um."
      >
        {canManage ? (
          <>
            <Button
              variant="outline"
              onClick={() => setRolesOpen(true)}
            >
              <Briefcase className="size-4" />
              Cargos
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Novo profissional
            </Button>
          </>
        ) : null}
      </PageHeader>

      <ProfessionalsList
        canManage={canManage}
        onCreate={openCreate}
        onEdit={openEdit}
        onInactivate={setInactivating}
        onReactivate={reactivate}
      />

      <ProfessionalFormDialog
        open={formState.open}
        onOpenChange={(open) => {
          if (!open) setFormState((state) => ({ ...state, open: false }));
        }}
        professional={formState.professional}
      />

      <InactivateProfessionalDialog
        professional={inactivating}
        onOpenChange={(open) => {
          if (!open) setInactivating(null);
        }}
      />

      <RoleManagerDialog open={rolesOpen} onOpenChange={setRolesOpen} />
    </>
  );
}
