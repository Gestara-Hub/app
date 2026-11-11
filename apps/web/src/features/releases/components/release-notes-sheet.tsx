"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APP_VERSION_LABEL } from "@/config/release";
import { formatDate } from "@gestarahub/core/format";
import { RELEASE_NOTES } from "../release-notes";

interface ReleaseNotesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado ao abrir: a versao mais nova conta como vista. */
  onSeen: () => void;
}

/** Novidades do GestaraHub, da versao mais nova para a mais antiga (doc technical/27). */
export function ReleaseNotesSheet({ open, onOpenChange, onSeen }: ReleaseNotesSheetProps) {
  useEffect(() => {
    if (open) onSeen();
  }, [open, onSeen]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-5 text-primary" />
            Novidades
          </SheetTitle>
          <SheetDescription>O que mudou no GestaraHub.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          {RELEASE_NOTES.map((note) => (
            <section key={note.version} className="space-y-2">
              <h3 className="text-sm font-semibold">{formatDate(note.date)}</h3>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-primary">
                {note.items.map((item) => (
                  <li key={item.text} className="break-words">
                    {item.text}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="shrink-0 border-t border-border/40 px-6 py-3 text-xs text-muted-foreground">
          Versão {APP_VERSION_LABEL}
        </p>
      </SheetContent>
    </Sheet>
  );
}
