import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsConsentBanner } from "@/components/shared/analytics-consent-banner";
import appIcon from "@/assets/icon.svg";
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
  // O iPhone so aceita PNG na tela de inicio, em quadrado cheio (ele arredonda).
  icons: { icon: appIcon.src, shortcut: appIcon.src, apple: "/icons/apple-touch-icon.png" },
  // Aberto pela tela de inicio do iPhone: sem a barra do Safari (PWA, doc technical/10).
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
};

// Cor da barra do navegador e do sistema, igual ao fundo de cada tema.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
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
            // So a cor de destaque (o resto do tema e fixo no CSS desde 31/10/2026).
            // Cor que nao existe mais fica no padrao: o CSS nao tem regra para ela.
            __html: `
              try {
                var raw = localStorage.getItem("gestarahub:theme-generator-state");
                var s = raw ? JSON.parse(raw) : null;
                var c = (s && s.themeColor) || localStorage.getItem("gestarahub:theme-color") || "zinc";
                document.documentElement.setAttribute("data-theme-color", c);
              } catch (_) {}
            `,
          }}
        />
        {/* Instalar o app (PWA): o navegador avisa uma vez so, logo ao carregar,
            antes do codigo do cartao chegar. Guarda o aviso aqui; o cartao
            (components/layout/install-app-prompt) le depois. */}
        <Script
          id="gh-install-capture"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener("beforeinstallprompt", function (e) {
                e.preventDefault();
                window.__ghInstallPrompt = e;
                window.dispatchEvent(new Event("gh-install-available"));
              });
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
