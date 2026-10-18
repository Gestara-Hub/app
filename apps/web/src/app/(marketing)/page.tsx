import type { Metadata } from "next";
import { LandingView } from "@/features/landing";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/config/site";

const title = `${SITE_NAME} | ${SITE_TAGLINE}`;

export const metadata: Metadata = {
  title,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title, description: SITE_DESCRIPTION },
};

export default function LandingPage() {
  return <LandingView />;
}
