import { toast } from "@/lib/toast";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";

/** O que pode receber o foco dentro do campo com erro (mesma lista do `FieldShell`). */
const FOCUSABLE = [
  "input:not([type=hidden]):not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Erro do servidor por campo: mostra em cada campo e poe o foco no primeiro
 * (doc 07 §2.10). Pelo `ref` do RHF quando o campo tem; senao, depois de
 * desenhar, o primeiro campo marcado com erro (dentro do dialogo aberto, se
 * houver). Sem campo, vira aviso.
 */
export function handleFormApiError<T extends FieldValues>(
  error: unknown,
  form: UseFormReturn<T>,
  fallbackMessage: string,
): void {
  const fields = getFieldErrors(error);
  if (fields && fields.length > 0) {
    for (const f of fields) {
      form.setError(f.field as Path<T>, { message: f.message });
    }
    try {
      form.setFocus(fields[0].field as Path<T>);
    } catch {
      // Campo sem ref (controle proprio): fica para o passo abaixo.
    }
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active?.closest("[data-field-error]")) return;
      const scope = document.querySelector('[role="dialog"][data-state="open"]') ?? document;
      scope.querySelector("[data-field-error]")?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });
  } else {
    toast.error(getErrorMessage(error, fallbackMessage));
  }
}

/**
 * Formulario fora do RHF (login, paginas publicas, assistente): poe o foco no
 * campo do erro pelo `id` (doc 07 §2.10). Depois de desenhar, para pegar
 * campo que acabou de aparecer.
 */
export function focusField(id: string): void {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => document.getElementById(id)?.focus());
}

/**
 * Sem `id` fixo (lista de notas, codigos do diálogo de seguranca): depois de
 * desenhar, foca o primeiro controle marcado com `aria-invalid` no dialogo
 * aberto (ou na pagina).
 */
export function focusFirstInvalid(): void {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    const scope = document.querySelector('[role="dialog"][data-state="open"]') ?? document;
    scope.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
