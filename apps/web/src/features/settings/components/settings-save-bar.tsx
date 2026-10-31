"use client";

import type { ReactNode, Ref } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Barra de salvar das abas de Configurações (decisão de 31/10/2026): presa
 * embaixo da tela, aparece só com alteração não salva (ou com um passo da
 * configuração inicial esperando confirmação) e some depois de salvar. No
 * celular, "Descartar" e "Salvar" dividem a linha, como os rodapés das janelas.
 */
export function SettingsSaveBar({
  visible,
  status = "Alterações não salvas",
  tone = "pending",
  onDiscard,
  saveLabel = "Salvar",
  onSave,
  pending,
  disabled,
  attention,
  ref,
}: {
  visible: boolean;
  status?: ReactNode;
  /** "error": o aviso explica por que não dá para salvar. */
  tone?: "pending" | "error";
  /** Sem ele (nada a desfazer), só o Salvar. */
  onDiscard?: () => void;
  saveLabel?: string;
  /** Sem ele, o Salvar envia o formulário em volta. */
  onSave?: () => void;
  pending: boolean;
  disabled?: boolean;
  /** Pulso da configuração inicial no Salvar. */
  attention?: boolean;
  ref?: Ref<HTMLDivElement>;
}) {
  if (!visible) return null;
  return (
    <div
      ref={ref}
      className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mt-4 flex flex-col gap-2 rounded-lg border bg-background/95 px-3 py-2.5 shadow-md backdrop-blur-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-200 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
    >
      <p
        role={tone === "error" ? "alert" : "status"}
        className={cn(
          "text-xs font-medium",
          tone === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400",
        )}
      >
        {status}
      </p>
      <div className={cn("grid gap-2 sm:flex", onDiscard ? "grid-cols-2" : "grid-cols-1")}>
        {onDiscard ? (
          <Button type="button" variant="outline" disabled={pending} onClick={onDiscard}>
            Descartar
          </Button>
        ) : null}
        <Button
          type={onSave ? "button" : "submit"}
          disabled={pending || disabled}
          onClick={onSave}
          // Treme de leve e solta o anel, sem crescer: o botao fica dentro do destaque.
          className={cn(attention && "motion-safe:animate-attention-soft-infinite")}
        >
          {pending ? "Salvando..." : saveLabel}
        </Button>
      </div>
    </div>
  );
}
