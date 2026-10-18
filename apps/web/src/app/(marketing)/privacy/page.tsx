import type { Metadata } from "next";
import { PrivacyPolicy } from "@/features/landing";

export const metadata: Metadata = {
  title: "Política de privacidade | GestaraHub",
};

export default function PrivacyPage() {
  return <PrivacyPolicy />;
}
