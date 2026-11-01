import type { CertificateKind, CertificateTemplate, ClassesBusinessSegment } from "@gestarahub/contracts";
import { certificatePresetsFor, type CertificatePreset } from "@gestarahub/core/certificate";
import { CLASSES_SEGMENT_PRESETS } from "@/lib/business-segment-presets";

export interface CertificatePresetOption {
  id: ClassesBusinessSegment;
  /** Nome da area ("Lutas"); o generico e "Padrão". */
  label: string;
  preset: CertificatePreset;
}

/** Modelos prontos de um tipo na ordem das areas; "Padrão" por ultimo. */
export function certificatePresetOptions(kind: CertificateKind = "course"): CertificatePresetOption[] {
  const presets = certificatePresetsFor(kind);
  return [
    ...(Object.keys(CLASSES_SEGMENT_PRESETS) as ClassesBusinessSegment[])
      .filter((id) => id !== "custom")
      .map((id): CertificatePresetOption => ({ id, label: CLASSES_SEGMENT_PRESETS[id].label, preset: presets[id] })),
    { id: "custom", label: "Padrão", preset: presets.custom },
  ];
}

/** Os de curso, na ordem das areas (os testes e a galeria antiga usam). */
export const CERTIFICATE_PRESET_OPTIONS: readonly CertificatePresetOption[] = certificatePresetOptions("course");

/** A area do espaco primeiro, para o modelo dela ser o primeiro cartao. */
export function certificatePresetOptionsFor(segment?: ClassesBusinessSegment, kind: CertificateKind = "course"): CertificatePresetOption[] {
  const options = certificatePresetOptions(kind);
  const own = options.find((o) => o.id === segment);
  return own ? [own, ...options.filter((o) => o !== own)] : options;
}

/** O modelo pronto que o modelo atual reproduz (layout, cor, titulo e texto iguais), se algum. */
export function matchingCertificatePreset(
  template: Pick<CertificateTemplate, "layout" | "accentColor" | "title" | "body">,
  kind: CertificateKind = "course",
): CertificatePresetOption | undefined {
  return certificatePresetOptions(kind).find(
    (o) =>
      o.preset.layout === template.layout &&
      o.preset.accentColor === template.accentColor &&
      o.preset.title === template.title.trim() &&
      o.preset.body === template.body.trim(),
  );
}
