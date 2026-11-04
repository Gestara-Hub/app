import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  BriefcaseMedical,
  Building2,
  Camera,
  ClipboardList,
  Droplets,
  FileText,
  GraduationCap,
  Handshake,
  HeartPulse,
  House,
  IdCard,
  LifeBuoy,
  Medal,
  PenLine,
  Percent,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import type { PersonDocumentKind } from "@gestarahub/contracts";

/**
 * Icone de cada tipo de documento na lista da ficha (ler o tipo de relance).
 * Tipo novo em `packages/core/src/person-documents.ts` pede o icone aqui (o
 * TypeScript acusa o que falta).
 */
export const DOCUMENT_KIND_ICONS: Record<PersonDocumentKind, LucideIcon> = {
  medical_certificate: Stethoscope,
  health_questionnaire: ClipboardList,
  dermatological_exam: Droplets,
  medical_report: HeartPulse,
  identity_document: IdCard,
  guardian_document: Users,
  proof_of_address: House,
  liability_waiver: PenLine,
  image_authorization: Camera,
  pickup_authorization: UserCheck,
  competition_authorization: Trophy,
  graduation_proof: Award,
  federation_membership: Medal,
  contract: Handshake,
  discount_proof: Percent,
  professional_registration: BadgeCheck,
  degree: GraduationCap,
  certification: ScrollText,
  first_aid: BriefcaseMedical,
  water_rescue: LifeBuoy,
  business_registration: Building2,
  background_check: ShieldCheck,
  other: FileText,
};
