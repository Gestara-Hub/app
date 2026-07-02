"use client";

import { useState } from "react";
import { Briefcase, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@/lib/api-error";
import type { ProfessionalView } from "@/types";
import { useCan } from "@/features/auth/session-provider";
import { RoleManagerDialog } from "@/features/roles/components/role-manager-dialog";
import { useUpdateProfessional } from "../hooks/use-professionals";
import { ProfessionalsList } from "./professionals-list";
import { ProfessionalFormDialog } from "./professional-form-dialog";
import { InactivateProfessionalDialog } from "./inactivate-professional-dialog";

export function ProfessionalsView() {
  const [formState, setFormState] = useState<{
    open: boolean;
    professional?: ProfessionalView;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<ProfessionalView | null>(
    null,
  );
  const [rolesOpen, setRolesOpen] = useState(false);

  const updateMut = useUpdateProfessional();
  const canManage = useCan()("team:manage");

  const openCreate = () => setFormState({ open: true });
  const openEdit = (professional: ProfessionalView) =>
    setFormState({ open: true, professional });

  async function reactivate(professional: ProfessionalView) {
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
      <PageHeader
        title="Equipe"
        description="Profissionais da Corte Nobre — Matriz."
      >
        {canManage ? (
          <>
            <Button variant="outline" onClick={() => setRolesOpen(true)}>
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
