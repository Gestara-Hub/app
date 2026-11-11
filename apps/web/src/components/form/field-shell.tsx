"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { useDialogDirty } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldShellProps {
  id?: string;
  label?: string;
  labelExtra?: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Campo com erro mostrado pelo proprio controle (sem `error` aqui): so marca para o foco ao salvar. */
  invalid?: boolean;
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
/**
 * Asterisco do campo obrigatorio ("Nome*", doc 08 §2): colado no texto, fora do
 * nome acessivel. Dentro de um `Label` (flex com gap), fica no MESMO span do
 * texto, senao o gap do flex afasta o asterisco: `<Label><span>Nome<RequiredMark /></span></Label>`.
 */
export function RequiredMark() {
  return (
    <span className="ml-0.5 text-destructive" aria-hidden>
      *
    </span>
  );
}

/** O que pode receber o foco dentro do campo (o primeiro da ordem da tela). */
const FOCUSABLE = [
  "input:not([type=hidden]):not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function FieldShell({
  id,
  label,
  labelExtra,
  hint,
  error,
  required,
  invalid,
  className,
  children,
}: FieldShellProps) {
  const form = useFormContext();
  const isDirty = Boolean(form?.formState?.isDirty);
  const dirtyRegistry = useDialogDirty();
  // O formulario (control do RHF) e a chave: ao desmontar, sai do registro do
  // dialog e deixa de contar como alteracao pendente.
  const source = form?.control;

  useEffect(() => {
    if (!dirtyRegistry || !source) return;
    dirtyRegistry.mount(source);
    return () => dirtyRegistry.unmount(source);
  }, [dirtyRegistry, source]);

  useEffect(() => {
    if (dirtyRegistry && source) dirtyRegistry.update(source, isDirty);
  }, [dirtyRegistry, source, isDirty]);

  // Foco no primeiro campo com erro ao salvar (10/11/2026, doc 07 §2.10). O RHF
  // ja foca o campo que tem `ref`; isto cobre os controles proprios (lista de
  // dias, chips, horarios, aceite) e garante a ordem da tela: so o primeiro
  // campo com erro do formulario age, e so se o foco ainda nao esta nele.
  const rootRef = useRef<HTMLDivElement>(null);
  const hasError = Boolean(error) || Boolean(invalid);
  const errorRef = useRef(hasError);
  useEffect(() => {
    errorRef.current = hasError;
  }, [hasError]);
  const submitCount = form?.formState?.submitCount ?? 0;
  useEffect(() => {
    if (submitCount === 0 || !errorRef.current) return;
    const root = rootRef.current;
    const formEl = root?.closest("form");
    if (!root || !formEl || formEl.querySelector("[data-field-error]") !== root) return;
    if (document.activeElement && root.contains(document.activeElement)) return;
    root.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [submitCount]);

  return (
    <div ref={rootRef} data-field-error={hasError ? "" : undefined} className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={id} className="text-sm">
            <span>
              {label}
              {required ? <RequiredMark /> : null}
            </span>
          </Label>
          {labelExtra}
        </div>
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
