"use client";

import type { ClassGroupView } from "@gestarahub/contracts";
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
  turma,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turma?: ClassGroupView;
  onCreated?: (created: ClassGroupView) => void;
}) {
  const isEdit = Boolean(turma);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] sm:max-w-xl flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(event) => event.preventDefault()}
        expandable
        storageKey="turma"
      >
        <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-20">
          <DialogTitle>{isEdit ? "Editar turma" : "Nova turma"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados, o instrutor e os encontros da turma."
              : "Cadastre uma turma, o instrutor e os encontros recorrentes."}
          </DialogDescription>
        </DialogHeader>
        <TurmaForm
          key={turma?.id ?? (open ? "open" : "closed")}
          turma={turma}
          formId="turma-form"
          onSuccess={(created) => {
            onOpenChange(false);
            if (!isEdit && created && onCreated) {
              onCreated(created);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
