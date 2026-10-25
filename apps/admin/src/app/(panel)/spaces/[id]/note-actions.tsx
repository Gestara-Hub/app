"use client";

import { useState, useTransition } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteNoteAction, pinNoteAction } from "./actions";

/** Menu "⋮" de uma anotação: fixar ou desafixar, e excluir (este pede confirmação). */
export function NoteActions({ id, spaceId, pinned }: { id: string; spaceId: string; pinned: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = (action: (formData: FormData) => Promise<void>, data: Record<string, string>, done: string) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) formData.set(key, value);
    startTransition(async () => {
      await action(formData);
      toast.success(done);
    });
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Ações da anotação" disabled={pending}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => run(pinNoteAction, { id, spaceId, pinned: pinned ? "0" : "1" }, pinned ? "Anotação desafixada." : "Anotação fixada.")}>{pinned ? "Desafixar" : "Fixar"}</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Excluir anotação"
        description="A anotação some para toda a equipe. Não dá para desfazer."
        confirmLabel="Excluir"
        isPending={pending}
        onConfirm={() => {
          setConfirming(false);
          run(deleteNoteAction, { id }, "Anotação excluída.");
        }}
      />
    </>
  );
}
