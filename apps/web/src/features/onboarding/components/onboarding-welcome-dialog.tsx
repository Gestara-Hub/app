"use client";

import { ChevronRight, Compass, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface OnboardingWelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartTour: () => void;
  onStartSetup: () => void;
  isClasses?: boolean;
}

/**
 * Boas-vindas do primeiro acesso (estilo Action Cards):
 * Apresenta dois caminhos visuais bem definidos em cartões clicáveis com hover
 * refinado. O tour ganha status de destaque ("RECOMENDADO · 1 MINUTO"), eliminando
 * o atrito de tempo e a hierarquia invertida.
 */
export function OnboardingWelcomeDialog({
  open,
  onOpenChange,
  onStartTour,
  onStartSetup,
  isClasses = true,
}: OnboardingWelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 overflow-hidden border shadow-2xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {/* Topo com ambientação e boas-vindas */}
        <div className="px-6 pt-6 pb-2 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent">
          <div className="mb-2">
            <Badge
              variant="outline"
              className="border-primary/25 bg-background/80 text-[11px] font-semibold text-primary uppercase tracking-wider backdrop-blur-xs"
            >
              {isClasses ? "Gestão de Turmas & Aulas" : "Primeiro Acesso"}
            </Badge>
          </div>

          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Bem-vindo ao GestaraHub
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Seu painel para gerenciar {isClasses ? "turmas, mensalidades e alunos" : "serviços, agendamentos e equipe"} está pronto. Como prefere começar?
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Escolha entre os dois caminhos em cards interativos */}
        <div className="px-6 pt-1 pb-3 space-y-3">
          {/* Card 1: Tour Guiado (Recomendado) */}
          <div
            role="button"
            tabIndex={0}
            onClick={onStartTour}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStartTour();
              }
            }}
            className="group relative flex items-center justify-between gap-4 p-4 rounded-xl border-2 border-primary/30 bg-primary/[0.03] hover:bg-primary/[0.08] hover:border-primary/70 transition-all duration-200 cursor-pointer shadow-xs"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="shrink-0 mt-0.5 size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm shadow-primary/25 group-hover:scale-105 transition-transform">
                <Compass className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    Fazer o tour guiado
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary tracking-wide">
                    RECOMENDADO · 1 MINUTO
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-snug">
                  Conheça os atalhos essenciais: turmas, planos de mensalidade,
                  alunos e configurações.
                </p>
              </div>
            </div>

            <ChevronRight className="size-5 shrink-0 text-primary/60 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>

          {/* Card 2: Configuração Direta */}
          <div
            role="button"
            tabIndex={0}
            onClick={onStartSetup}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStartSetup();
              }
            }}
            className="group relative flex items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card hover:bg-accent/40 hover:border-foreground/20 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="shrink-0 mt-0.5 size-10 rounded-xl border bg-muted/60 text-muted-foreground flex items-center justify-center group-hover:text-foreground group-hover:border-foreground/30 transition-colors">
                <ListChecks className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    Configurar no meu ritmo
                  </h3>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-snug">
                  Vá direto ao checklist guiado para cadastrar horários, planos e
                  a primeira turma.
                </p>
              </div>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-1 transition-all" />
          </div>
        </div>

        {/* Rodapé sutil */}
        <div className="px-6 py-4 mt-1 bg-muted/20 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p className="text-xs text-muted-foreground">
            Você pode reabrir o tour ou checklist quando quiser pelo menu.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground h-8"
            onClick={() => onOpenChange(false)}
          >
            Explorar por conta própria
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
