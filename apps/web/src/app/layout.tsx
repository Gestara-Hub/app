import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsConsentBanner } from "@/components/shared/analytics-consent-banner";
import appIcon from "@/assets/icon.png";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/config/site";
import { PRE_PAINT_VIEW_MODE_SCRIPT } from "@/components/shared/list/view-mode-script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: `${SITE_TAGLINE}: turmas, chamada, mensalidades e evolução dos alunos.`,
  icons: { icon: appIcon.src, shortcut: appIcon.src, apple: appIcon.src },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Tema antes da pintura. next/script com beforeInteractive (e nao <script>
            cru): o React 19 avisa quando um componente renderiza <script>, que no
            cliente nunca executa; o Next injeta este no <head> antes de hidratar. */}
        <Script
          id="gh-theme-pre-paint"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var raw = localStorage.getItem("gestarahub:theme-generator-state");
                var s = raw ? JSON.parse(raw) : null;
                var c = (s && s.themeColor) || localStorage.getItem("gestarahub:theme-color") || "zinc";
                var r = (s && s.radius) || localStorage.getItem("gestarahub:theme-radius") || "0.5";
                var b = (s && s.baseColor) || "zinc";
                var m = (s && s.menuColor) || "inverted";
                var f = (s && s.font) || "geist";
                var st = (s && s.style) || "mira";
                document.documentElement.setAttribute("data-theme-color", c);
                document.documentElement.setAttribute("data-theme-radius", r);
                document.documentElement.setAttribute("data-base-color", b);
                document.documentElement.setAttribute("data-menu-color", m);
                document.documentElement.setAttribute("data-font", f);
                document.documentElement.setAttribute("data-style", st);

                var fontQueries = {
                  "inter": "Inter:wght@400;500;600;700",
                  "roboto": "Roboto:wght@400;500;700",
                  "open-sans": "Open+Sans:wght@400;500;600;700",
                  "poppins": "Poppins:wght@400;500;600;700",
                  "montserrat": "Montserrat:wght@400;500;600;700",
                  "outfit": "Outfit:wght@400;500;600;700",
                  "plus-jakarta-sans": "Plus+Jakarta+Sans:wght@400;500;600;700",
                  "dm-sans": "DM+Sans:wght@400;500;700",
                  "ibm-plex-sans": "IBM+Plex+Sans:wght@400;500;600;700",
                  "nunito": "Nunito:wght@400;500;600;700",
                  "lato": "Lato:wght@400;700",
                  "noto-sans": "Noto+Sans:wght@400;500;600;700",
                  "nunito-sans": "Nunito+Sans:wght@400;500;600;700",
                  "figtree": "Figtree:wght@400;500;600;700",
                  "raleway": "Raleway:wght@400;500;600;700",
                  "public-sans": "Public+Sans:wght@400;500;600;700",
                  "delius-swash-caps": "Delius+Swash+Caps",
                  "barlow": "Barlow:wght@400;500;600;700",
                  "hind": "Hind:wght@400;500;600;700",
                  "instrument-sans": "Instrument+Sans:wght@400;500;600;700",
                  "manrope": "Manrope:wght@400;500;600;700",
                  "oxanium": "Oxanium:wght@400;500;600;700"
                };
                if (fontQueries[f]) {
                  var l = document.createElement("link");
                  l.id = "gh-font-" + f;
                  l.rel = "stylesheet";
                  l.href = "https://fonts.googleapis.com/css2?family=" + fontQueries[f] + "&display=swap";
                  document.head.appendChild(l);
                }
              } catch (_) {}
            `,
          }}
        />
        {/* Lista vs cards antes da pintura (skeleton certo, sem flicker). */}
        <Script
          id="gh-view-mode-pre-paint"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: PRE_PAINT_VIEW_MODE_SCRIPT }}
        />
      </head>
      <body className="min-h-full">
        <Providers>
          {children}
          <AnalyticsConsentBanner />
        </Providers>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
