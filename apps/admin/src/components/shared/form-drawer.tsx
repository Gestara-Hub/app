"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const DrawerContext = createContext<{ close: () => void } | null>(null);

/** Fecha a gaveta em que o formulário está (sem efeito fora de uma gaveta). */
export function useDrawerClose(): () => void {
  return useContext(DrawerContext)?.close ?? (() => undefined);
}

/**
 * Formulário em gaveta à direita, como os cadastros do app dos clientes: o botão que abre fica no
 * cabeçalho da tela, o cabeçalho e o rodapé ficam fixos e os campos rolam no meio. O formulário
 * recebe `useDrawerClose()` para fechar ao salvar.
 */
export function FormDrawer({
  trigger,
  title,
  description,
  children,
  width = "sm:max-w-md",
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className={`flex h-full w-full flex-col gap-0 p-0 ${width}`}>
        <SheetHeader className="shrink-0 border-b p-5 pr-12 text-left">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <DrawerContext.Provider value={{ close: () => setOpen(false) }}>{children}</DrawerContext.Provider>
      </SheetContent>
    </Sheet>
  );
}

/** Campos que rolam entre o cabeçalho e o rodapé da gaveta. */
export function DrawerBody({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>;
}

/** Rodapé fixo da gaveta: "Cancelar" e o botão de salvar (rótulos do padrão: "Adicionar" ao criar, "Salvar" ao editar). */
export function DrawerFooter({ submitLabel, pendingLabel = "Salvando...", pending, disabled }: { submitLabel: string; pendingLabel?: string; pending: boolean; disabled?: boolean }) {
  const close = useDrawerClose();
  return (
    <div className="flex shrink-0 justify-end gap-2 border-t bg-background p-4">
      <Button type="button" variant="outline" onClick={close} disabled={pending}>
        Cancelar
      </Button>
      <Button type="submit" disabled={pending || disabled}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}
