import type { Metadata } from "next";
import { LandingView } from "@/features/landing";
import { getCurrentUser } from "@/features/auth/get-current-user";
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

// Quem ja entrou ve "Ir para o painel" em vez do cadastro (ONB-32): um novo
// cadastro trocava o nome e o e-mail do dono atual.
export default async function LandingPage() {
  const user = await getCurrentUser();
  return <LandingView signedInName={user?.name} />;
}
