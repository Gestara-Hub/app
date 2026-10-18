"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "./scroll-reveal";
import { SignupForm, SignupLoginLink } from "./signup-form";

/**
 * Bloco de cadastro da landing: card estreito e centralizado, so o essencial
 * (doc 08, secao 3.7; escolhido entre 5 variacoes em 17/10/2026).
 */
export function LandingSignupSection({ signedInName }: { signedInName?: string }) {
  return (
    <section id="cadastro" className="py-20 bg-muted/30 border-t border-border/40 scroll-mt-16">
      <div className="px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" distancePx={24} durationMs={500}>
          <div className="mx-auto max-w-md">
            <div className="mb-8 space-y-2 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground text-balance">
                Comece a organizar suas aulas hoje
              </h2>
              <p className="text-muted-foreground">Grátis, sem cartão e sem limite de alunos.</p>
            </div>
            {signedInName ? (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
                <p className="text-sm text-foreground">
                  Você já está na conta de <strong>{signedInName}</strong>.
                </p>
                <Button asChild className="w-full">
                  <Link href="/dashboard">Ir para o painel</Link>
                </Button>
                <p className="text-xs text-muted-foreground">Para criar outra conta, saia desta primeiro.</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
                  <SignupForm idPrefix="signup" />
                </div>
                <SignupLoginLink className="mt-5 text-center" />
              </>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
