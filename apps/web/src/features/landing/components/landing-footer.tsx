"use client";

import Image from "next/image";
import Link from "next/link";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";
import { COMPANY_ADDRESS, COMPANY_CNPJ, COMPANY_NAME, SUPPORT_EMAIL } from "@/config/site";
import { LANDING_NAV_LINKS } from "./landing-header";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 bg-card/40 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Image
            src={logoLightImage}
            alt="GestaraHub"
            className="h-9 w-auto dark:hidden"
          />
          <Image
            src={logoDarkImage}
            alt="GestaraHub"
            className="hidden h-9 w-auto dark:block"
          />
          <span className="text-xs text-muted-foreground">
            © {currentYear} GestaraHub. Todos os direitos reservados.
            <span className="block">
              Um produto da {COMPANY_NAME} · CNPJ {COMPANY_CNPJ}
            </span>
            <span className="block">{COMPANY_ADDRESS}</span>
          </span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-muted-foreground font-medium">
          {LANDING_NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground transition-colors">
              {link.label}
            </Link>
          ))}
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Termos de uso
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacidade
          </Link>
          {SUPPORT_EMAIL ? (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground transition-colors">
              Contato
            </a>
          ) : null}
          <Link href="/login" className="hover:text-foreground transition-colors">
            Entrar
          </Link>
        </nav>
      </div>
    </footer>
  );
}

