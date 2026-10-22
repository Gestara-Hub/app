"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleDivider, GoogleSignInButton } from "@/features/auth";
import { ScrollReveal } from "./scroll-reveal";
import { SignupForm, SignupLoginLink } from "./signup-form";

/** O que a pessoa leva ao criar a conta (frases curtas, sem prometer o que nao existe). */
const PERKS = [
  "Grátis, sem cartão e sem limite de alunos.",
  "Configuração inicial em três passos.",
  "Pix opcional, com baixa automática.",
];

/**
 * Bloco de cadastro da landing (doc 08, secao 3.7): resumo do que a pessoa
 * leva a esquerda e o cartao do formulario a direita (22/10/2026); no
 * celular, o titulo e o resumo (curtos) vem antes do formulario.
 */
export function LandingSignupSection({ signedInName }: { signedInName?: string }) {
  return (
    <section id="cadastro" className="py-20 bg-muted/30 border-t border-border/40 scroll-mt-16">
      <div className="px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" distancePx={24} durationMs={500}>
          <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-6 text-center lg:text-left">
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Cadastro</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground text-balance sm:text-4xl">
                  Comece a organizar suas aulas hoje
                </h2>
              </div>
              <ul className="mx-auto w-fit space-y-3 text-left lg:mx-0">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-3 text-sm text-foreground sm:text-base">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full">
              {signedInName ? (
                <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-lg sm:p-8">
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
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-lg ring-1 ring-black/5 sm:p-8 dark:ring-white/5">
                    <div className="mb-6 space-y-1">
                      <h3 className="text-xl font-bold text-foreground">Crie sua conta</h3>
                      <p className="text-sm text-muted-foreground">Leva menos de um minuto.</p>
                    </div>
                    <div className="mb-5 space-y-5 empty:hidden">
                      <GoogleSignInButton placement="signup" />
                      <GoogleDivider />
                    </div>
                    <SignupForm idPrefix="signup" />
                  </div>
                  <SignupLoginLink className="mt-5 text-center" />
                </>
              )}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
