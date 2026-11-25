import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/config/site";

/**
 * Instalacao como app (PWA, 04/11/2026; doc technical/10). Os icones saem de
 * `assets/icon.svg` pelo gerador da marca: o comum com cantos arredondados, o
 * "maskable" com o G menor para caber no corte em circulo do Android, e o do
 * iPhone (`apple-touch-icon.png`, em `layout.tsx`) em quadrado cheio.
 * Abre na tela de abertura (`/launch`, 25/11/2026): a logo aparece na hora e o
 * Painel entra quando chegar; sem sessao, o proxy leva ao login.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_TAGLINE,
    lang: "pt-BR",
    start_url: "/launch",
    scope: "/",
    display: "standalone",
    background_color: "#18181B",
    theme_color: "#18181B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
