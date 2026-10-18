"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";

// Com "/" na frente, os links tambem funcionam nas paginas de Termos e Privacidade.
export const LANDING_NAV_LINKS = [
  { href: "/#parte-chata", label: "Parte chata" },
  { href: "/#o-sistema", label: "O sistema" },
  { href: "/#areas", label: "Áreas" },
  { href: "/#recursos", label: "Recursos" },
  { href: "/#faq", label: "Dúvidas" },
];

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const updateScrollProgress = () => {
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const progress = Math.min(
          100,
          Math.max(0, (window.scrollY / scrollHeight) * 100)
        );
        setScrollProgress(progress);
      }
    };

    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    updateScrollProgress();
    return () => window.removeEventListener("scroll", updateScrollProgress);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md transition-colors relative">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src={logoLightImage}
            alt="GestaraHub"
            className="h-11 w-auto dark:hidden"
            priority
          />
          <Image
            src={logoDarkImage}
            alt="GestaraHub"
            className="hidden h-11 w-auto dark:block"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex">
          {LANDING_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="hidden items-center gap-3 lg:flex">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <Button variant="ghost" asChild className="text-sm font-medium">
            <Link href="/login">Entrar</Link>
          </Button>

          <Button asChild size="sm" className="gap-1.5 px-4 font-semibold shadow-xs">
            <Link href="/#cadastro">
              <span>Criar conta grátis</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        {/* No celular o botao de criar conta fica sempre a vista; o tema vai para o menu. */}
        <div className="flex items-center gap-2 lg:hidden">
          <Button asChild className="px-3 font-semibold">
            <Link href="/#cadastro" onClick={() => setMobileMenuOpen(false)}>
              Criar conta
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          id="landing-mobile-menu"
          className="border-b border-border/40 bg-background/95 px-4 pt-2 pb-6 backdrop-blur-md lg:hidden space-y-4 animate-in slide-in-from-top-2 duration-200"
        >
          <nav className="flex flex-col space-y-3 pt-2 text-sm font-medium">
            {LANDING_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
            <Button variant="outline" asChild className="w-full justify-center">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                Entrar
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-center gap-2 text-muted-foreground"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
            </Button>
          </div>
        </div>
      )}

      {/* Barra de Progresso no Scroll */}
      <div
        className="absolute bottom-0 left-0 h-[2px] bg-primary transition-[width] duration-150 ease-out z-10"
        style={{ width: `${scrollProgress}%` }}
        aria-hidden="true"
      />
    </header>
  );
}
