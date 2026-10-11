"use client";

import Image from "next/image";
import Link from "next/link";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 bg-card/40 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
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
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium">
          <a href="#como-funciona" className="hover:text-foreground transition-colors">
            Como funciona
          </a>
          <a href="#modalidades" className="hover:text-foreground transition-colors">
            Modalidades
          </a>
          <a href="#recursos" className="hover:text-foreground transition-colors">
            Recursos
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            Dúvidas
          </a>
          <Link href="/login" className="hover:text-foreground transition-colors">
            Acessar Plataforma
          </Link>
        </div>
      </div>
    </footer>
  );
}

