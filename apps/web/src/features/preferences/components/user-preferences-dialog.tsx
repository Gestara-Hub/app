"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <DialogTitle>Preferências do Usuário</DialogTitle>
              <DialogDescription>
                Personalize sua experiência de navegação, aparência e sons.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          <UserPreferencesView onResetComplete={() => onOpenChange(false)} />
        </div>

        <div className="border-t border-border/40 pt-3 text-right">
          <p className="text-[11px] text-muted-foreground">
            {isDirty
              ? "Sincronizando com a nuvem em segundo plano..."
              : "Suas escolhas são salvas automaticamente."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
