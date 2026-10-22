"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowUpRight, CheckCircle2, MessageCircle, QrCode, ShieldCheck } from "lucide-react";
import pixLight from "@/assets/landing/pix-light.png";
import pixDark from "@/assets/landing/pix-dark.png";
import { trackEvent } from "@/lib/analytics";
import { ScrollReveal } from "./scroll-reveal";

// Cobranca online (doc 08): opcional e tambem no plano gratis. Sem valores de
// taxa e sem o nome do provedor na pagina (decisao de 22/10/2026).
const POINTS = [
  { icon: QrCode, text: "Pix ou link de cartão em cada cobrança." },
  { icon: CheckCircle2, text: "O aluno paga e a cobrança baixa sozinha." },
  { icon: MessageCircle, text: "O lembrete no WhatsApp já leva o Pix." },
  { icon: ArrowUpRight, text: "Você saca para o seu Pix quando quiser." },
];

const ALT = "Tela Cobrar online com o QR Code do Pix, o código copia e cola e o valor líquido da cobrança";

export function LandingOnlinePayments() {
  // Quantos chegam ate o Pix: um evento por visita, quando metade da secao aparece.
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        trackEvent("landing_section_viewed", { section: "online_payments" });
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="pagamento-online" className="scroll-mt-16 py-20 border-t border-border/40">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="space-y-6">
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Pagamento online</span>
              <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground text-balance">
                Receba pelo Pix sem conferir extrato
              </h2>
            </div>
            <ul className="space-y-3">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="inline-flex shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-500">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="pt-1 text-sm sm:text-base text-foreground">{text}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>Opcional, também no plano grátis. Você ativa quando quiser.</p>
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                Processado por um parceiro de pagamentos regulado.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" distancePx={20} durationMs={500} delayMs={80}>
          <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border shadow-lg">
            <Image src={pixLight} alt={ALT} sizes="448px" placeholder="blur" className="h-auto w-full dark:hidden" />
            <Image src={pixDark} alt={ALT} sizes="448px" placeholder="blur" className="hidden h-auto w-full dark:block" />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
