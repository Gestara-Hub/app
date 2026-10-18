"use client";

import type { ReactNode } from "react";
import { LEGAL_UPDATED_AT, SUPPORT_EMAIL } from "@/config/site";
import { LandingHeader } from "./landing-header";
import { LandingFooter } from "./landing-footer";

interface LandingLegalPageProps {
  title: string;
  children: ReactNode;
}

/** Moldura das paginas de Termos e Privacidade: mesmo topo e rodape da landing. */
export function LandingLegalPage({ title, children }: LandingLegalPageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased">
      <LandingHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
            <p className="text-sm text-muted-foreground">Última atualização: {LEGAL_UPDATED_AT}.</p>
          </header>
          {children}
          {SUPPORT_EMAIL ? (
            <LegalSection title="Contato">
              <p>
                Dúvidas ou pedidos sobre seus dados:{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground underline underline-offset-4">
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </LegalSection>
          ) : null}
        </article>
      </main>
      <LandingFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
