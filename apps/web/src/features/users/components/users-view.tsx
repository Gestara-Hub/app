"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@/lib/api-error";
import type { UserView } from "@gestarahub/contracts";
import { useCan } from "@/features/auth/session-provider";
import { useUpdateUser } from "../hooks/use-users";
import { UsersList } from "./users-list";
import { UserFormDialog } from "./user-form-dialog";
import { InactivateUserDialog } from "./inactivate-user-dialog";

export function UsersView() {
  const [formState, setFormState] = useState<{
    open: boolean;
    user?: UserView;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<UserView | null>(null);

  const updateMut = useUpdateUser();
  const canManage = useCan()("users:manage");

  const openCreate = () => setFormState({ open: true });
  const openEdit = (user: UserView) => setFormState({ open: true, user });

  async function reactivate(user: UserView) {
    try {
      await updateMut.mutateAsync({ id: user.id, payload: { status: "active" } });
      toast.success("Usuário reativado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível reativar o usuário."));
    }
  }

  return (
    <>
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
      />

      <UserFormDialog
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
