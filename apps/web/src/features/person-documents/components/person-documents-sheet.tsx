"use client";

import type { Id, PersonDocumentOwnerKind } from "@gestarahub/contracts";
import { DialogBody } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRetainedValue } from "@/lib/use-retained-value";
import { PersonDocumentsPanel } from "./person-documents-panel";

/** Documentos numa gaveta, para quem nao tem ficha propria (instrutor, pelo menu da linha). */
export function PersonDocumentsSheet({
  owner: ownerProp,
  ownerKind,
  canManage,
  onOpenChange,
}: {
  owner: { id: Id; name: string } | null;
  ownerKind: PersonDocumentOwnerKind;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const owner = useRetainedValue(ownerProp);
  return (
    <Sheet open={Boolean(ownerProp)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
      >
        <SheetHeader className="shrink-0 p-6 pb-4 border-b border-border/40 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">Documentos</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{owner?.name}</SheetDescription>
        </SheetHeader>
        <DialogBody>
          {owner ? (
            <PersonDocumentsPanel ownerKind={ownerKind} ownerId={owner.id} ownerName={owner.name} canManage={canManage} />
          ) : null}
        </DialogBody>
      </SheetContent>
    </Sheet>
  );
}
