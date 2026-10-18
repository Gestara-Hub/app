import type { Metadata } from "next";
import { TermsOfUse } from "@/features/landing";

export const metadata: Metadata = {
  title: "Termos de uso | GestaraHub",
};

export default function TermsPage() {
  return <TermsOfUse />;
}
