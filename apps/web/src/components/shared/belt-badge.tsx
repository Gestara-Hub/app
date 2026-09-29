"use client";

import type { ProgressionBeltColor } from "@gestarahub/contracts";
import {
  BELT_COLOR_META,
  inferTipColorFromLevelName,
  isMartialArtsLevelName,
} from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";

export interface BeltBadgeProps {
  levelName?: string;
  name?: string;
  color: ProgressionBeltColor;
  tipColor?: ProgressionBeltColor | null;
  subLevel?: number;
  maxSubLevels?: number;
  modalityName?: string;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  subLevelLabelMode?: "ordinal" | "count";
  className?: string;
}

export function BeltBadge({
  levelName,
  name,
  color,
  tipColor,
  subLevel = 0,
  maxSubLevels = 4,
  modalityName,
  size = "sm",
  showLabel = true,
  subLevelLabelMode = "ordinal",
  className,
}: BeltBadgeProps) {
  const displayLabel = levelName ?? name ?? "";
  const meta = BELT_COLOR_META[color] ?? BELT_COLOR_META.slate;
  const isMartial = isMartialArtsLevelName(displayLabel);
  const inferredTip =
    tipColor !== undefined
      ? tipColor && tipColor !== color
        ? tipColor
        : null
      : inferTipColorFromLevelName(displayLabel, color);
  const stripes = Math.min(Math.max(subLevel, 0), 6);
  const hasDegrees = maxSubLevels > 0 || subLevel > 0;

  const subLevelText =
    subLevel > 0
      ? isMartial
        ? subLevelLabelMode === "count"
          ? ` • ${subLevel} ${subLevel === 1 ? "grau" : "graus"}`
          : ` • ${subLevel}º grau`
        : subLevelLabelMode === "count"
          ? ` • ${subLevel} ${subLevel === 1 ? "etapa" : "etapas"}`
          : ` • ${subLevel}ª etapa`
      : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium leading-none shrink-0",
        size === "xs"
          ? "px-1.5 py-0.5 text-[10px]"
          : size === "sm"
            ? "px-2 py-0.5 text-[11px]"
            : "px-2.5 py-1 text-xs",
        meta.badgeBg,
        meta.badgeText,
        meta.badgeBorder,
        className,
      )}
    >
      {isMartial ? (
        /* Visual de Faixa / Kruang / Corda (Artes Marciais) */
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex items-center justify-end overflow-hidden rounded-[2px] border border-black/15 shrink-0",
            size === "xs"
              ? stripes >= 4
                ? "h-2.5 w-8"
                : "h-2.5 w-6"
              : size === "sm"
                ? stripes >= 4
                  ? "h-3 w-9"
                  : "h-3 w-7"
                : "h-3.5 w-10",
            meta.barFill,
          )}
        >
          {hasDegrees ? (
            /* Tarja de graus / Dans com listras brancas */
            <span
              className={cn(
                "flex h-full items-center justify-end gap-[2px] px-[2.5px]",
                stripes === 0
                  ? "w-2.5"
                  : stripes <= 2
                    ? "min-w-[10px]"
                    : stripes <= 4
                      ? "min-w-[16px]"
                      : "min-w-[22px]",
                inferredTip
                  ? BELT_COLOR_META[inferredTip].barFill
                  : meta.tipBg,
              )}
            >
              {Array.from({ length: stripes }).map((_, idx) => (
                <span
                  key={idx}
                  className="h-[85%] w-[1.5px] rounded-[0.5px] bg-white shadow-[0_0_1px_rgba(0,0,0,0.6)]"
                />
              ))}
            </span>
          ) : inferredTip ? (
            /* Ponteira colorida sem graus (Ex.: Judô Branca Ponta Cinza, Cinza Ponta Azul, Muay Thai Ponta Vermelha) */
            <span
              className={cn(
                "h-full w-2.5 border-l border-black/15",
                BELT_COLOR_META[inferredTip].barFill,
              )}
            />
          ) : null}
        </span>
      ) : (
        /* Visual Universal de Nível / Etapa (Funcional, Pilates, Natação, Cursos) */
        <span aria-hidden="true" className="inline-flex items-center gap-1 shrink-0">
          <span
            className={cn(
              "rounded-full shrink-0",
              size === "xs" ? "size-2" : "size-2.5",
              meta.swatchClass,
            )}
          />
          {stripes > 0 ? (
            <span className="inline-flex items-center gap-[2px]">
              {Array.from({ length: stripes }).map((_, idx) => (
                <span
                  key={idx}
                  className="size-1 rounded-full bg-current opacity-70"
                />
              ))}
            </span>
          ) : null}
        </span>
      )}

      {showLabel ? (
        <span className="truncate">
          {modalityName ? (
            <span className="opacity-75 font-normal">{modalityName}: </span>
          ) : null}
          <span>{displayLabel}</span>
          {subLevelText ? (
            <span className="opacity-85">{subLevelText}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
