"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldShellProps {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Ids do texto de erro/ajuda, para ligar ao controle via aria-describedby. */
export const fieldErrorId = (id: string) => `${id}-error`;
export const fieldHintId = (id: string) => `${id}-hint`;

/** `aria-invalid` e `aria-describedby` do controle (erro tem precedencia sobre a ajuda). */
export function fieldAria(id: string, error?: string, hint?: string) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? fieldErrorId(id) : hint ? fieldHintId(id) : undefined,
  } as const;
}

/**
 * Casca de campo igual a do app dos clientes: rotulo (+ asterisco se
 * obrigatorio), controle e, embaixo, o erro do schema Zod ou a ajuda.
 */
export function FieldShell({ id, label, hint, error, required, className, children }: FieldShellProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label htmlFor={id} className="text-sm">
          <span>
            {label}
            {required ? (
              <span className="ml-0.5 text-destructive" aria-hidden>
                *
              </span>
            ) : null}
          </span>
        </Label>
      ) : null}
      {children}
      {error ? (
        <p id={id ? fieldErrorId(id) : undefined} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={id ? fieldHintId(id) : undefined} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
