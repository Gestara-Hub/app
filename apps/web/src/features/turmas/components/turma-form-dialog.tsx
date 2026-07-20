"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TurmaForm } from "./turma-form";

export function TurmaFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] overflow-y-auto sm:max-w-xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Nova turma</DialogTitle>
          <DialogDescription>
            Cadastre uma turma, o instrutor e os encontros recorrentes.
          </DialogDescription>
        </DialogHeader>
        <TurmaForm
          key={open ? "open" : "closed"}
          formId="turma-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
