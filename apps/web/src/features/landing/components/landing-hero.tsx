"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

import { TypewriterText } from "./typewriter-text";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
      {/* Background radial gradients */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center space-y-6">
          {/* Pill announcement badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs backdrop-blur-sm">
            <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Sistema 100% Gratuito • Alunos e turmas ilimitados</span>
          </div>

          {/* Headline with Typewriter Effect */}
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-foreground leading-[1.15]">
            <span className="block">A plataforma definitiva</span>
            <span className="block">para gerenciar turmas de</span>
            <span className="block text-primary min-h-[1.2em]">
              <TypewriterText
                words={[
                  "Artes Marciais.",
                  "Pilates & Yoga.",
                  "CrossFit & Funcional.",
                  "Dança & Ritmos.",
                  "Natação & Esportes.",
                ]}
              />
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            Grade de horários, chamada rápida no celular, controle de vagas e
            mensalidades em um só lugar. Abandone o papel e as planilhas com uma
            gestão feita para quem ensina em grupo.
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              asChild
              size="lg"
              className="h-12 w-full sm:w-auto px-7 text-sm font-semibold shadow-md gap-2"
            >
              <Link href="/login">
                <span>Criar conta gratuita agora</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 w-full sm:w-auto px-6 text-sm font-medium"
            >
              <a href="#recursos">Ver como funciona</a>
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Sem limite de alunos ou turmas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Sem necessidade de cartão
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Chamada direta no celular
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
