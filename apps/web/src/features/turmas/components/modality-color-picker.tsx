"use client";

import { Check } from "lucide-react";
import type { ModalityColorKey } from "@gestarahub/contracts";
import { MODALITY_COLORS } from "@gestarahub/core/modality-colors";
import { cn } from "@/lib/utils";
import { MODALITY_COLOR_LABELS, MODALITY_COLOR_STYLES } from "../modality-colors";

/**
 * "Cor no calendário" da modalidade (doc product/29 §Calendario, versao 2):
 * oito bolinhas, a escolhida com o check. O roxo fica so para Evento.
 */
export function ModalityColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: ModalityColorKey;
  onChange: (color: ModalityColorKey) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p id="modality-color-label" className="text-sm font-medium text-foreground">
        Cor no calendário
      </p>
      <div role="radiogroup" aria-labelledby="modality-color-label" className="flex flex-wrap gap-2">
        {MODALITY_COLORS.map((color) => {
          const selected = color === value;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={MODALITY_COLOR_LABELS[color]}
              title={MODALITY_COLOR_LABELS[color]}
              disabled={disabled}
              onClick={() => onChange(color)}
              className={cn(
                "flex size-9 items-center justify-center rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                MODALITY_COLOR_STYLES[color].dot,
                selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
            >
              {selected ? <Check className="size-4 text-white" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
