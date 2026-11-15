"use client";

import { Check } from "lucide-react";
import type { ModalityColorKey } from "@gestarahub/contracts";
import { MODALITY_COLORS } from "@gestarahub/core/modality-colors";
import { cn } from "@/lib/utils";
import { MODALITY_COLOR_LABELS, MODALITY_COLOR_STYLES } from "../modality-colors";

function formatUsedBy(names: string[]): string {
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names[0]} e mais ${names.length - 1}`;
}

/**
 * "Cor no calendário" da modalidade (doc product/29 §Calendario, versao 2):
 * paleta curada (14 cores), a escolhida com o check. O roxo fica so para Evento.
 */
export function ModalityColorPicker({
  value,
  onChange,
  usedBy,
  disabled,
}: {
  value: ModalityColorKey;
  onChange: (color: ModalityColorKey) => void;
  usedBy?: Partial<Record<ModalityColorKey, string[]>>;
  disabled?: boolean;
}) {
  const selectedUsedNames = usedBy?.[value] ?? [];

  return (
    <div className="space-y-1.5">
      <p id="modality-color-label" className="text-sm font-medium text-foreground">
        Cor no calendário
      </p>
      <div role="radiogroup" aria-labelledby="modality-color-label" className="flex flex-wrap gap-2">
        {MODALITY_COLORS.map((color) => {
          const selected = color === value;
          const usedNames = usedBy?.[color] ?? [];
          const label =
            usedNames.length > 0
              ? `${MODALITY_COLOR_LABELS[color]} — já usada em ${formatUsedBy(usedNames)}`
              : MODALITY_COLOR_LABELS[color];
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              disabled={disabled}
              onClick={() => onChange(color)}
              className={cn(
                "relative flex size-9 items-center justify-center rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                MODALITY_COLOR_STYLES[color].dot,
                selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
            >
              {selected ? <Check className="size-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" aria-hidden /> : null}
              {!selected && usedNames.length > 0 ? (
                <span
                  aria-hidden
                  className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-muted-foreground"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {usedBy ? (
        <p className="text-xs text-muted-foreground">
          {selectedUsedNames.length > 0
            ? `Já usada em ${formatUsedBy(selectedUsedNames)}.`
            : "Cor livre (ainda não usada por outra modalidade)."}
        </p>
      ) : null}
    </div>
  );
}
