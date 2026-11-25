"use client";

import { useTeamWords } from "@/features/settings";
import type { ClassGroupView } from "@gestarahub/contracts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TurmaForm } from "./turma-form";

interface TurmaFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turma?: ClassGroupView;
  /** Duplicar: nova turma preenchida com esta (sem alunos, aulas nem cobranças). */
  template?: ClassGroupView;
  /** Cobrança travada na edição: "Duplicar turma" abre a cópia. */
  onDuplicate?: (turma: ClassGroupView) => void;
  onCreated?: (created: ClassGroupView) => void;
}

/**
 * Drawer lateral para criação e edição de Turma.
 * Ocupa 100vh de altura e largura ampla (max-w-2xl a max-w-3xl),
 * mantendo o contexto de fundo visível com backdrop escuro.
 */
export function TurmaFormDrawer({
  open,
  onOpenChange,
  turma,
  template,
  onDuplicate,
  onCreated,
}: TurmaFormDrawerProps) {
  const team = useTeamWords();
  const isEdit = Boolean(turma);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {isEdit ? "Editar turma" : template ? "Duplicar turma" : "Nova turma"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {isEdit
              ? `Atualize os dados, o ${team.lower} e os encontros da turma.`
              : template
                ? "Nova turma com os dados desta, sem alunos nem aulas. Ajuste o que precisar."
                : `Cadastre uma turma, o ${team.lower} e os encontros recorrentes.`}
          </SheetDescription>
        </SheetHeader>
        <TurmaForm
          key={turma?.id ?? (template ? `copy-${template.id}` : open ? "open" : "closed")}
          turma={turma}
          template={template}
          onDuplicate={turma && onDuplicate ? () => onDuplicate(turma) : undefined}
          formId="turma-form-drawer"
          onSuccess={(created) => {
            onOpenChange(false);
            if (!isEdit && created && onCreated) {
              onCreated(created);
            }
          }}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
