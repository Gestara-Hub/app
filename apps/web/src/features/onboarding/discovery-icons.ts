import {
  CalendarCheck,
  Layers,
  MessageCircle,
  ReceiptText,
  TrendingUp,
  UserPlus,
  Wallet,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { DiscoveryItemId } from "./discovery-items";

/** Icone de cada item do dia a dia (card do Painel e "Proximo passo"). */
export const DISCOVERY_ICONS: Record<DiscoveryItemId, LucideIcon> = {
  enroll: UserPlus,
  attendance: CalendarCheck,
  membership_payment: Wallet,
  course_installments: ReceiptText,
  package_sale: Layers,
  message: MessageCircle,
  progress: TrendingUp,
  finance: WalletCards,
};
