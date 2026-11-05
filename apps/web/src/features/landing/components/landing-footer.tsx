"use client";

import Image from "next/image";
import Link from "next/link";
import logoLightImage from "@/assets/logo-light.svg";
import logoDarkImage from "@/assets/logo-dark.svg";
import {
  COMPANY_ADDRESS,
  COMPANY_CNPJ,
  COMPANY_NAME,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  SITE_TAGLINE,
  SUPPORT_EMAIL,
} from "@/config/site";
import { LANDING_NAV_LINKS } from "./landing-header";

const LEGAL_LINKS = [
  { href: "/terms", label: "Termos de uso" },
  { href: "/privacy", label: "Privacidade" },
  { href: "/privacy#exclusao", label: "Exclusão de dados" },
];

/** O lucide nao traz marcas: o glifo do Instagram em SVG, no mesmo tamanho dos outros icones. */
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

const linkClass = "text-sm text-muted-foreground transition-colors hover:text-foreground";

/**
 * Rodape em dois andares (02/11/2026): em cima, marca, navegacao da pagina e
 * legal com contato, em tres colunas; embaixo, a faixa com o copyright e a
 * identificacao da empresa (Decreto 7.962/2013 e LGPD, doc product/27), em
 * texto menor. No celular as colunas empilham e a faixa fica centralizada.
 */
export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Marca (logo institucional completa no rodape) */}
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-block transition-opacity hover:opacity-90"
              aria-label="GestaraHub início"
            >
              <Image
                src={logoLightImage}
                alt="GestaraHub"
                className="h-11 w-auto dark:hidden"
              />
              <Image
                src={logoDarkImage}
                alt="GestaraHub"
                className="hidden h-11 w-auto dark:block"
              />
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">{SITE_TAGLINE}</p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <InstagramIcon />
              {`@${INSTAGRAM_HANDLE}`}
            </a>
          </div>

          {/* Navegacao da pagina */}
          <nav aria-label="Seções da página" className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Navegação</p>
            <ul className="space-y-2">
              {LANDING_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal e contato */}
          <nav aria-label="Legal e contato" className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Legal e contato</p>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className={`${linkClass} break-all`}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <Link href="/login" className={linkClass}>
                  Entrar
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Faixa legal */}
        <div className="mt-10 space-y-1 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground md:text-left">
          <p>
            © {currentYear} GestaraHub · {COMPANY_NAME} · CNPJ {COMPANY_CNPJ}
          </p>
          <p>{COMPANY_ADDRESS}</p>
        </div>
      </div>
    </footer>
  );
}
