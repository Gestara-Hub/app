import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";
import { HubGridBackground } from "@/components/shared/hub-grid-background";

type PublicAuthShellProps = {
  /** Sem titulo, o conteudo traz o proprio (o painel Entrar | Criar conta). */
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * Telas de entrada (login, esqueci a senha, nova senha): cartao central e
 * enxuto sobre a malha do HubGridBackground, cujos pulsos correm para o cartao.
 */
export function PublicAuthShell({ title, subtitle, children }: PublicAuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-muted/30 px-4 py-12">
      <HubGridBackground />
      <div className="relative w-full max-w-[400px] space-y-6">
        <div className="flex justify-center">
          <Link href="/" aria-label="GestaraHub, página inicial">
            <Image src={logoLightImage} alt="GestaraHub" className="h-14 w-auto dark:hidden" priority />
            <Image src={logoDarkImage} alt="GestaraHub" className="hidden h-14 w-auto dark:block" priority />
          </Link>
        </div>
        <div
          data-hub-target
          className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xl ring-1 ring-black/5 sm:p-8 dark:ring-white/5"
        >
          {title ? (
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          ) : null}
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground hover:underline">
            Termos de uso
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            Privacidade
          </Link>
        </p>
      </div>
    </div>
  );
}
