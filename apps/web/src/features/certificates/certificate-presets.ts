import type { CertificateTemplate, ClassesBusinessSegment } from "@gestarahub/contracts";
import { CERTIFICATE_PRESETS, type CertificatePreset } from "@gestarahub/core/certificate";
import { CLASSES_SEGMENT_PRESETS } from "@/lib/business-segment-presets";

export interface CertificatePresetOption {
  id: ClassesBusinessSegment;
  /** Nome da area ("Lutas"); o generico e "Padrão". */
  label: string;
  preset: CertificatePreset;
}

/** Modelos prontos na ordem das areas (a do espaco vai primeiro na galeria); "Padrão" por ultimo. */
export const CERTIFICATE_PRESET_OPTIONS: readonly CertificatePresetOption[] = [
  ...(Object.keys(CLASSES_SEGMENT_PRESETS) as ClassesBusinessSegment[])
    .filter((id) => id !== "custom")
    .map((id): CertificatePresetOption => ({ id, label: CLASSES_SEGMENT_PRESETS[id].label, preset: CERTIFICATE_PRESETS[id] })),
  { id: "custom", label: "Padrão", preset: CERTIFICATE_PRESETS.custom },
];

/** A area do espaco primeiro, para o modelo dela ser o primeiro cartao. */
export function certificatePresetOptionsFor(segment?: ClassesBusinessSegment): CertificatePresetOption[] {
  const own = CERTIFICATE_PRESET_OPTIONS.find((o) => o.id === segment);
  return own ? [own, ...CERTIFICATE_PRESET_OPTIONS.filter((o) => o !== own)] : [...CERTIFICATE_PRESET_OPTIONS];
}

/** O modelo pronto que o modelo atual reproduz (layout, cor, titulo e texto iguais), se algum. */
export function matchingCertificatePreset(
  template: Pick<CertificateTemplate, "layout" | "accentColor" | "title" | "body">,
): CertificatePresetOption | undefined {
  return CERTIFICATE_PRESET_OPTIONS.find(
    (o) =>
      o.preset.layout === template.layout &&
      o.preset.accentColor === template.accentColor &&
      o.preset.title === template.title.trim() &&
      o.preset.body === template.body.trim(),
  );
}
