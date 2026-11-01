"use client";

import type { AnyCertificate, CertificateKind, ClassesBusinessSegment } from "@gestarahub/contracts";
import { certificateTemplateFromPreset } from "@gestarahub/core/certificate";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { certificatePresetOptionsFor, type CertificatePresetOption } from "../certificate-presets";
import { CertificateSheet } from "./certificate-sheet";

/**
 * Galeria "Comece por um modelo" (doc 21 §1.5): um cartao por area, com a
 * miniatura da folha de verdade. O da area do espaco vem primeiro. Escolher
 * preenche layout, cor, titulo, texto e cargos; logo e arte ficam.
 */
export function CertificatePresetGallery({
  sample,
  kind = "course",
  segment,
  teacherTitle,
  logoUrl,
  selectedId,
  disabled,
  onPick,
}: {
  sample: AnyCertificate;
  /** Curso ou graduacao: cada tipo tem os proprios modelos prontos. */
  kind?: CertificateKind;
  segment?: ClassesBusinessSegment;
  teacherTitle: string;
  logoUrl?: string | null;
  /** Modelo pronto que o formulario reproduz agora (nenhum = ajustado a mao). */
  selectedId?: ClassesBusinessSegment;
  disabled?: boolean;
  onPick: (option: CertificatePresetOption) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Modelos prontos" className="grid grid-cols-2 gap-2">
      {certificatePresetOptionsFor(segment, kind).map((option) => {
        const selected = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onPick(option)}
            className={cn(
              "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-2 text-left transition-colors select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-60",
              selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/70 bg-background hover:border-border hover:bg-muted/40",
            )}
          >
            {/* Miniatura: a folha de verdade, so para olhar. */}
            <div aria-hidden className="pointer-events-none">
              <CertificateSheet
                certificate={sample}
                template={certificateTemplateFromPreset(option.preset, teacherTitle)}
                logoUrl={logoUrl}
                className="rounded-sm"
              />
            </div>
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight break-words">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground break-words">
                  {option.id === segment ? "Sua área. " : ""}
                  {option.preset.description}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {selected ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
