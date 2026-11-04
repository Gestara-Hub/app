"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { UserView } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { useResendInviteUser, useUpdateUser } from "../hooks/use-users";
import { UsersList } from "./users-list";
import { UserFormDrawer } from "./user-form-drawer";
import { InactivateUserDialog } from "./inactivate-user-dialog";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

export function UsersView() {
  const [formState, setFormState] = useState<{
    open: boolean;
    user?: UserView;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<UserView | null>(null);

  const updateMut = useUpdateUser();
  const resendInviteMut = useResendInviteUser();
  const canManage = useCan()("users:manage");

  const openCreate = () => {
    if (!canManage) return;
    setFormState({ open: true });
  };
  const openEdit = (user: UserView) => {
    if (!canManage) return;
    setFormState({ open: true, user });
  };

  const handleResendInvite = async (user: UserView) => {
    try {
      const res = await resendInviteMut.mutateAsync(user.id);
      if (res.success) {
        toast.success(`Convite reenviado com sucesso para ${user.email}.`);
      } else {
        toast.error(res.error || "Não foi possível reenviar o convite.");
      }
    } catch {
      toast.error("Erro ao reenviar convite.");
    }
  };

  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  async function reactivate(user: UserView) {
    if (
      !(await confirmAction({
        title: "Reativar usuário?",
        description: `“${user.name}” volta a ter acesso ao sistema com o perfil atual.`,
        confirmLabel: "Reativar",
      }))
    ) {
      return;
    }
    try {
      await updateMut.mutateAsync({ id: user.id, payload: { status: "active" } });
      toast.success("Usuário reativado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível reativar o usuário."));
    }
  }

  return (
    <>
      {confirmDialog}
      <PageHeader
        title="Usuários"
        description="Quem acessa o sistema e o perfil de acesso."
      >
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo usuário
          </Button>
        ) : null}
      </PageHeader>

      <UsersList
        canManage={canManage}
        onCreate={openCreate}
        onEdit={openEdit}
        onInactivate={setInactivating}
        onReactivate={reactivate}
        onResendInvite={handleResendInvite}
      />

      <UserFormDrawer
        open={formState.open}
        onOpenChange={(open) => {
          if (!open) setFormState((state) => ({ ...state, open: false }));
        }}
        user={formState.user}
      />

      <InactivateUserDialog
        user={inactivating}
        onOpenChange={(open) => {
          if (!open) setInactivating(null);
        }}
      />
    </>
  );
}
