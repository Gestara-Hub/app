"use client";

import type { EventView } from "@gestarahub/contracts";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useRetainedValue } from "@/lib/use-retained-value";
import { EventForm } from "./event-form";

interface EventFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EventView;
  onCreated?: (created: EventView) => void;
}

/** Drawer lateral de criacao e edicao de evento (doc product/29 §Telas). */
export function EventFormDrawer({ open, onOpenChange, event: eventProp, onCreated }: EventFormDrawerProps) {
  const event = useRetainedValue(eventProp);
  const present = useDialogPresence(open);
  const isEdit = Boolean(eventProp);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-xl md:max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">{isEdit ? "Editar evento" : "Novo evento"}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {isEdit ? "Atualize os dados, os dias e a cobrança do evento." : "Seminário, workshop ou aulão com datas fechadas."}
          </SheetDescription>
        </SheetHeader>
        {present ? (
          <EventForm
            key={event?.id ?? "new"}
            event={isEdit ? (event ?? undefined) : undefined}
            onSuccess={(saved) => {
              onOpenChange(false);
              if (!isEdit && onCreated) onCreated(saved);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
