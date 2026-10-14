import {
  Activity,
  Award,
  Brush,
  ChefHat,
  Dumbbell,
  Languages,
  Music,
  Palette,
  PlusCircle,
  Sparkles,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { ClassesBusinessSegment } from "@gestarahub/contracts";

/** Icone de cada area: o mesmo no setup e na landing page. */
export const SEGMENT_ICONS: Record<ClassesBusinessSegment, LucideIcon> = {
  martial_arts: Award,
  pilates_yoga: Activity,
  functional_training: Dumbbell,
  dance: Sparkles,
  music: Music,
  languages: Languages,
  swimming_sports: Waves,
  gastronomy: ChefHat,
  arts_crafts: Palette,
  beauty_courses: Brush,
  custom: PlusCircle,
};
