"use client";

import type { ProfessionalView } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useTeamWords } from "@/features/settings";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProfessionalForm } from "./professional-form";

export interface ProfessionalFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional?: ProfessionalView;
}

/**
 * Drawer lateral para criação e edição de Profissional / Instrutor.
 * Ocupa 100vh de altura com largura ampla (sm:max-w-xl md:max-w-2xl),
 * mantendo o contexto de fundo visível com backdrop escuro.
 */
export function ProfessionalFormDrawer({
  open,
  onOpenChange,
  professional,
}: ProfessionalFormDrawerProps) {
  const isEdit = Boolean(professional);
  const isClasses = useModel() === "classes";
  const team = useTeamWords();

  const description = isClasses
    ? isEdit
      ? `Atualize os dados e modalidades do ${team.lower}.`
      : `Cadastre um ${team.lower} e as modalidades que leciona.`
    : isEdit
      ? "Atualize os dados, serviços e disponibilidade."
      : "Cadastre um profissional, os serviços que realiza e a disponibilidade.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {isEdit
              ? isClasses
                ? `Editar ${team.lower}`
                : "Editar profissional"
              : isClasses
                ? `Novo ${team.lower}`
                : "Novo profissional"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{description}</SheetDescription>
        </SheetHeader>
        <ProfessionalForm
          key={professional?.id ?? (open ? "open" : "closed")}
          professional={professional}
          formId="professional-form-drawer"
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
