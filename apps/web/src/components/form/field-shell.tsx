"use client";

import { useEffect, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { useDialogDirty } from "@/components/ui/dialog";
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

/**
 * Props de acessibilidade do controle: `aria-invalid` e `aria-describedby`
 * apontando para o erro (ou para o hint quando nao ha erro), igual ao shell.
 */
export function fieldAria(id: string, error?: string, hint?: string) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? fieldErrorId(id) : hint ? fieldHintId(id) : undefined,
  } as const;
}

/**
 * Shell de campo consistente: label (+ asterisco se obrigatorio) -> controle ->
 * hint/erro abaixo. Erro tem precedencia sobre hint. O texto do erro vem do
 * schema Zod (doc 10).
 */
export function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldShellProps) {
  const form = useFormContext();
  const isDirty = Boolean(form?.formState?.isDirty);
  const setDialogDirty = useDialogDirty();

  useEffect(() => {
    setDialogDirty?.(isDirty);
  }, [isDirty, setDialogDirty]);

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
        <p
          id={id ? fieldErrorId(id) : undefined}
          role="alert"
          className="text-xs text-destructive"
        >
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
