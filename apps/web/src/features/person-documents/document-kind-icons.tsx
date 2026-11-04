import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  Camera,
  FileText,
  GraduationCap,
  Handshake,
  HeartPulse,
  PenLine,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { PersonDocumentKind } from "@gestarahub/contracts";

/** Icone de cada tipo de documento na lista da ficha (ler o tipo de relance). */
export const DOCUMENT_KIND_ICONS: Record<PersonDocumentKind, LucideIcon> = {
  medical_certificate: Stethoscope,
  liability_waiver: PenLine,
  image_authorization: Camera,
  medical_report: HeartPulse,
  graduation_proof: Award,
  contract: Handshake,
  professional_registration: BadgeCheck,
  certification: GraduationCap,
  background_check: ShieldCheck,
  other: FileText,
};
