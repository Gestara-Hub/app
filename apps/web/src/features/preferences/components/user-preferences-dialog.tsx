"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserPreferencesView } from "./user-preferences-view";
import { useUserPreferences } from "../hooks/use-user-preferences";

export function UserPreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isDirty } = useUserPreferences();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold text-foreground">
                Preferências
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                Tema, cor de destaque e som. Valem só para você.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <UserPreferencesView onResetComplete={() => onOpenChange(false)} />
        </div>

        <div className="border-t border-border/40 px-6 py-3 text-right bg-muted/10 shrink-0">
          <p className="text-[11px] text-muted-foreground">
            {isDirty
              ? "Sincronizando com a nuvem em segundo plano..."
              : "Suas escolhas são salvas automaticamente."}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
