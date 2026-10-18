"use client";

import { useState } from "react";
import Image, { type StaticImageData } from "next/image";
import attendanceLight from "@/assets/landing/attendance-light.png";
import attendanceDark from "@/assets/landing/attendance-dark.png";
import billingLight from "@/assets/landing/billing-light.png";
import billingDark from "@/assets/landing/billing-dark.png";
import studentLight from "@/assets/landing/student-light.png";
import studentDark from "@/assets/landing/student-dark.png";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./scroll-reveal";

interface Screen {
  key: string;
  label: string;
  caption: string;
  alt: string;
  device: "phone" | "desktop";
  light: StaticImageData;
  dark: StaticImageData;
}

// Telas reais do app com dados de demonstracao (nada de mockup montado). Para
// recapturar: scripts/landing-screenshots (doc 08, secao 3.11).
const SCREENS: Screen[] = [
  {
    key: "attendance",
    label: "Chamada",
    caption: "Presença em um toque, direto no celular.",
    alt: "Lista de chamada de uma aula de Jiu-Jitsu no celular, com alunos marcados como presentes",
    device: "phone",
    light: attendanceLight,
    dark: attendanceDark,
  },
  {
    key: "billing",
    label: "Cobranças",
    caption: "Quem pagou e quem atrasou, mês a mês.",
    alt: "Tela de cobranças do mês com o total recebido, os valores em atraso e a lista de mensalidades",
    device: "desktop",
    light: billingLight,
    dark: billingDark,
  },
  {
    key: "student",
    label: "Ficha do aluno",
    caption: "Faixa, frequência e pagamentos num lugar só.",
    alt: "Ficha de um aluno com valor em aberto, frequência de 30 dias, faixa atual e turmas",
    device: "desktop",
    light: studentLight,
    dark: studentDark,
  },
];

/** A mesma tela nos dois temas: a pagina mostra a do tema atual. */
function ThemedShot({ screen, sizes }: { screen: Screen; sizes: string }) {
  return (
    <>
      <Image src={screen.light} alt={screen.alt} sizes={sizes} placeholder="blur" className="h-auto w-full dark:hidden" />
      <Image src={screen.dark} alt={screen.alt} sizes={sizes} placeholder="blur" className="hidden h-auto w-full dark:block" />
    </>
  );
}

export function LandingShowcase() {
  const [activeKey, setActiveKey] = useState(SCREENS[0].key);
  const active = SCREENS.find((s) => s.key === activeKey) ?? SCREENS[0];

  return (
    <section id="o-sistema" className="scroll-mt-16 py-20 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">O sistema</span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground text-balance">
              Veja o sistema por dentro
            </h2>
          </div>
        </ScrollReveal>

        <div className="space-y-3">
          <div role="tablist" aria-label="Telas do sistema" className="mx-auto flex w-fit flex-wrap justify-center gap-1 rounded-full border border-border bg-muted/40 p-1">
            {SCREENS.map((screen) => {
              const selected = screen.key === active.key;
              return (
                <button
                  key={screen.key}
                  type="button"
                  role="tab"
                  id={`showcase-tab-${screen.key}`}
                  aria-selected={selected}
                  aria-controls="showcase-panel"
                  onClick={() => setActiveKey(screen.key)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    selected ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {screen.label}
                </button>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground">{active.caption}</p>
        </div>

        <div id="showcase-panel" role="tabpanel" aria-labelledby={`showcase-tab-${active.key}`}>
          {active.device === "phone" ? (
            <div className="mx-auto w-full max-w-[280px] rounded-[2.25rem] border border-border bg-card p-2 shadow-lg">
              <div className="overflow-hidden rounded-[1.75rem] border border-border/60">
                <ThemedShot screen={active} sizes="280px" />
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="flex h-8 items-center gap-1.5 border-b border-border px-3" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-muted-foreground/25" />
                <span className="size-2.5 rounded-full bg-muted-foreground/25" />
                <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              </div>
              <ThemedShot screen={active} sizes="(min-width: 1024px) 1024px, 100vw" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
