"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Loader2, Mail, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersService } from "@/services/usersService";
import { settingsService } from "@/services/settingsService";
import { signIn } from "@/app/(auth)/actions";
import { ScrollReveal } from "./scroll-reveal";

export function LandingSignupSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Por favor, informe seu nome.");
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Por favor, informe um e-mail válido.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const switchList = await usersService.listForSwitch();
        const targetOption =
          switchList.find((opt) => opt.user.name === "Ana Ribeiro" || opt.user.profile === "owner") ??
          switchList[0];

        if (!targetOption) {
          setError("Não foi possível inicializar a conta. Tente novamente.");
          return;
        }

        // Ativa o tenant da academia
        await settingsService.setActiveTenant(targetOption.organizationId);

        // Atualiza o usuário com nome e email informados
        try {
          await usersService.update(targetOption.user.id, {
            name: trimmedName,
            email: trimmedEmail,
          });
        } catch {
          // Ignora se não puder alterar no mock
        }

        const userToLogin = {
          ...targetOption.user,
          name: trimmedName,
          email: trimmedEmail,
        };

        // Direciona para o setup inicial do espaço
        await signIn(userToLogin, "/setup");
      } catch (err) {
        console.error("Erro ao cadastrar:", err);
        setError("Ocorreu um erro ao criar a conta. Tente novamente.");
      }
    });
  };

  return (
    <section id="cadastro" className="py-20 bg-muted/20 border-t border-border/40 scroll-mt-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" distancePx={24} durationMs={500}>
          <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card/90 p-8 sm:p-12 shadow-xl backdrop-blur-md">
          {/* Subtle background glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-64 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-8">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>Crie sua conta em 30 segundos</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              Comece a organizar suas turmas hoje mesmo
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Sem burocracia, sem cartão de crédito e sem pegadinhas. Crie sua conta gratuita e acesse na hora.
            </p>
          </div>

          {/* Form: Apenas Nome e E-mail */}
          <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <Label htmlFor="signup-name" className="text-xs font-semibold text-foreground">
                  Seu nome <span className="text-primary">*</span>
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    required
                    disabled={isPending}
                    placeholder="Ex: Carlos Silva"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError(null);
                    }}
                    className="pl-9 h-11 text-sm bg-background border-border/80 focus-visible:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <Label htmlFor="signup-email" className="text-xs font-semibold text-foreground">
                  Seu melhor e-mail <span className="text-primary">*</span>
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    required
                    disabled={isPending}
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    className="pl-9 h-11 text-sm bg-background border-border/80 focus-visible:border-primary"
                  />
                </div>
              </div>
            </div>

            {error ? (
              <p className="text-xs font-medium text-destructive text-center animate-in fade-in-50">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              disabled={isPending || !name.trim() || !email.trim()}
              className="w-full h-12 text-sm sm:text-base font-semibold gap-2 shadow-md hover:shadow-lg transition-all"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Acessando o sistema…</span>
                </>
              ) : (
                <>
                  <span>Criar conta gratuita agora</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>

            {/* Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                100% Gratuito para sempre
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Sem necessidade de cartão
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Alunos e turmas ilimitados
              </span>
            </div>
          </form>
        </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
