"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md transition-colors">
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
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a
            href="#como-funciona"
            className="transition-colors hover:text-foreground"
          >
            Como funciona
          </a>
          <a
            href="#modalidades"
            className="transition-colors hover:text-foreground"
          >
            Modalidades
          </a>
          <a
            href="#recursos"
            className="transition-colors hover:text-foreground"
          >
            Recursos
          </a>
          <a
            href="#faq"
            className="transition-colors hover:text-foreground"
          >
            Dúvidas
          </a>
        </nav>

        {/* Right Actions */}
        <div className="hidden items-center gap-3 md:flex">
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
            <Link href="/login">
              <span>Começar grátis</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-border/40 bg-background/95 px-4 pt-2 pb-6 backdrop-blur-md md:hidden space-y-4 animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-3 pt-2 text-sm font-medium">
            <a
              href="#como-funciona"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              Como funciona
            </a>
            <a
              href="#modalidades"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              Modalidades
            </a>
            <a
              href="#recursos"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              Recursos
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              Dúvidas
            </a>
          </nav>
          <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
            <Button variant="outline" asChild className="w-full justify-center">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                Entrar
              </Link>
            </Button>
            <Button asChild className="w-full justify-center gap-1.5 font-semibold">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <span>Criar conta grátis</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
