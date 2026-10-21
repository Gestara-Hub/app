"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@gestarahub/contracts";
import { useModalityVocabulary, useOrganization } from "@/features/settings";
import { ModalityForm } from "./modality-form";

interface ModalityFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modality?: Category;
}

/**
 * Opção 1: Drawer lateral largo (slide-over pela direita).
 * Ocupa 100vh de altura, garantindo espaço vertical amplo sem espremer o conteúdo,
 * com largura expandida (max-w-2xl a max-w-3xl) e mantendo a tela anterior visível ao fundo.
 */
export function ModalityFormDrawer({
  open,
  onOpenChange,
  modality,
}: ModalityFormDrawerProps) {
  const isEdit = Boolean(modality);
  const vocabulary = useModalityVocabulary(modality);
  const { isPending: segmentPending } = useOrganization();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {isEdit ? "Editar modalidade" : "Nova modalidade"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {isEdit
              ? `Configure o nome, a ${vocabulary.trackTitle.toLowerCase()} e a disponibilidade.`
              : `Configure a modalidade e, se quiser, a ${vocabulary.trackTitle.toLowerCase()}.`}
          </SheetDescription>
        </SheetHeader>

        {!isEdit && segmentPending ? (
          <div className="space-y-3 p-6 flex-1">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <ModalityForm
            key={modality?.id ?? "nova-drawer"}
            modality={modality}
            formId="modality-form-drawer"
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
