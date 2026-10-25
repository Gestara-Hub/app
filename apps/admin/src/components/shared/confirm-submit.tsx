"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "./confirm-action-dialog";

/**
 * Botão de ação crítica dentro de um <form action={...}>: abre a confirmação e só envia o formulário ao
 * confirmar (dinheiro, inativar, desativar, reiniciar acesso: nunca num clique só, como no app dos clientes).
 */
export function ConfirmSubmit({
  children,
  title,
  description,
  confirmLabel = "Confirmar",
  variant = "outline",
  destructive = false,
  disabled,
  className,
}: {
  children: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button ref={anchor} type="button" variant={variant} disabled={disabled} className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        variant={destructive ? "destructive" : "default"}
        onConfirm={() => {
          setOpen(false);
          anchor.current?.form?.requestSubmit();
        }}
      />
    </>
  );
}
