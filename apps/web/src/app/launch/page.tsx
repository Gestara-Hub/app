import type { Metadata } from "next";
import { SITE_NAME } from "@/config/site";
import { LaunchRedirect } from "./launch-redirect";

export const metadata: Metadata = { title: SITE_NAME, robots: { index: false, follow: false } };

/**
 * Abertura do app instalado (PWA, 25/11/2026; doc technical/10). O manifesto
 * abre aqui: pagina estatica, servida na hora pelo CDN, com a logo no fundo do
 * tema. Ela ja pede o Painel; a logo fica ate a tela com os dados chegar (antes
 * o app abria direto no Painel e ficava vazio enquanto o servidor montava). No
 * painel, a mesma logo cobre a primeira tela ate as leituras terminarem
 * (`LaunchSplashOverlay`, 25/11/2026).
 */
export default function LaunchPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-6">
      <LaunchRedirect />
    </main>
  );
}
