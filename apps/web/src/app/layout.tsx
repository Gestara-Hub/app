import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Toaster } from "@/components/ui/sonner";
import appIcon from "@/assets/icon.png";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GestaraHub",
  description: "Plataforma de gestão — agenda, clientes, equipe e serviços.",
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
        <script
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
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
