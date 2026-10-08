"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 bg-card/40">
      {/* Final Pre-Footer Call to Action Banner */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8 sm:p-12 text-center space-y-6 shadow-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            <span>Modernize sua gestão hoje</span>
          </div>

          <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground max-w-2xl mx-auto">
            Pronto para aposentar o caderno e organizar suas turmas?
          </h2>

          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            Junte-se a professores e gestores que simplificaram a chamada,
            o controle de turmas e as mensalidades com o GestaraHub.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="h-12 px-8 font-semibold shadow-md gap-2">
              <Link href="/login">
                <span>Criar conta gratuita agora</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-6">
              <Link href="/login">Já sou cliente</Link>
            </Button>
          </div>
        </div>

        {/* Footer Links & Copyright */}
        <div className="mt-16 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-border/40 pt-8">
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
      </div>
    </footer>
  );
}
