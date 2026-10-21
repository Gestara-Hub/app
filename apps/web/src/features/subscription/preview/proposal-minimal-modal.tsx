"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  Crown,
  GraduationCap,
  Info,
  QrCode,
  Sparkles,
  Users,
} from "lucide-react";
import type { SubscriptionTier } from "@gestarahub/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ProposalProps {
  interval: "monthly" | "yearly";
  currentTier: SubscriptionTier;
  onSelectTier: (tier: SubscriptionTier) => void;
  isPending: boolean;
}

export function ProposalMinimalModal({
  interval,
  currentTier,
  onSelectTier,
  isPending,
}: ProposalProps) {
  const [modalTier, setModalTier] = useState<SubscriptionTier | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch max-w-6xl mx-auto">
        {/* 1. PLANO GRÁTIS */}
        <Card
          className={cn(
            "flex flex-col justify-between rounded-2xl border transition-all duration-200 bg-card shadow-xs",
            currentTier === "free"
              ? "border-primary/50 ring-1 ring-primary/20"
              : "border-border/70 hover:border-border",
          )}
        >
          <div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Começo Sem Custo
                </span>
                {currentTier === "free" ? (
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    Plano Atual
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="text-2xl font-bold">Grátis</CardTitle>
              <p className="text-xs text-muted-foreground">
                A base operacional completa para o dia a dia.
              </p>

              <div className="pt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">R$ 0</span>
                  <span className="text-xs text-muted-foreground font-medium">/ mês</span>
                </div>
                <p className="text-[11px] text-muted-foreground pt-0.5">
                  Grátis para sempre · Sem cartão
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-1 text-xs">
              {/* 4 Bullets Essenciais (Zero fadiga de leitura) */}
              <ul className="space-y-2.5 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  <span className="text-foreground"><strong>Alunos e turmas ilimitados</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  <span>Chamada no celular com áudio e fotos</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  <span>App do Aluno e do Professor inclusos</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  <span>Cobrança Pix integrada (R$ 1,99 por Pix)</span>
                </li>
              </ul>

              {/* Botão para abrir modal de detalhes */}
              <button
                type="button"
                onClick={() => setModalTier("free")}
                className="w-full text-center text-xs font-semibold text-primary hover:underline flex items-center justify-center gap-1 pt-1 cursor-pointer"
              >
                <Info className="size-3.5" />
                <span>Ver todos os recursos inclusos (8)</span>
              </button>
            </CardContent>
          </div>

          <CardFooter className="pt-2">
            <Button
              variant={currentTier === "free" ? "outline" : "secondary"}
              className="w-full text-xs font-semibold"
              disabled={currentTier === "free" || isPending}
              onClick={() => onSelectTier("free")}
            >
              {currentTier === "free" ? "Plano Atual" : "Voltar ao Grátis"}
            </Button>
          </CardFooter>
        </Card>

        {/* 2. PLANO PROFISSIONAL (DESTAQUE) */}
        <Card
          className={cn(
            "flex flex-col justify-between rounded-2xl border-2 transition-all duration-200 relative bg-card shadow-md",
            "border-primary ring-2 ring-primary/20",
          )}
        >
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
              <Sparkles className="size-3" />
              Mais Escolhido
            </span>
          </div>

          <div>
            <CardHeader className="pb-3 pt-6">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Piloto Automático
                </span>
                {currentTier === "pro" ? (
                  <Badge variant="secondary" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    Plano Atual
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <span>Profissional</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Zere a inadimplência e automatize cobranças e rotinas.
              </p>

              <div className="pt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">
                    {interval === "monthly" ? "R$ 79,90" : "R$ 58,25"}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">/ mês</span>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-0.5">
                  {interval === "monthly"
                    ? "Sem fidelidade ou carência"
                    : "R$ 799/ano à vista (2 meses grátis)"}
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-1 text-xs">
              {/* 4 Bullets Essenciais de Alto Impacto */}
              <ul className="space-y-2.5 text-foreground/90">
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-primary" />
                  <span>
                    <strong>Taxa Pix reduzida: R$ 1,29</strong>{" "}
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">(-35% OFF)</span>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-primary" />
                  <span><strong>WhatsApp 100% Automático</strong> (zero clique)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-primary" />
                  <span><strong>Portal do Aluno:</strong> pagamento em 1 clique e reservas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-primary" />
                  <span><strong>DRE Gerencial Completa</strong> e certificados com QR</span>
                </li>
              </ul>

              {/* Botão para abrir modal de detalhes */}
              <button
                type="button"
                onClick={() => setModalTier("pro")}
                className="w-full text-center text-xs font-semibold text-primary hover:underline flex items-center justify-center gap-1 pt-1 cursor-pointer"
              >
                <Info className="size-3.5" />
                <span>Ver todos os recursos e detalhes (14)</span>
              </button>
            </CardContent>
          </div>

          <CardFooter className="pt-2">
            <Button
              variant={currentTier === "pro" ? "outline" : "default"}
              className={cn(
                "w-full text-xs font-bold gap-1.5 shadow-sm",
                currentTier !== "pro" && "bg-primary hover:bg-primary/90",
              )}
              disabled={currentTier === "pro" || isPending}
              onClick={() => onSelectTier("pro")}
            >
              {currentTier === "pro" ? (
                "Plano Atual"
              ) : (
                <>
                  <span>Ativar Plano Profissional</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* 3. PLANO EXPANSÃO */}
        <Card
          className={cn(
            "flex flex-col justify-between rounded-2xl border transition-all duration-200 bg-card shadow-xs",
            currentTier === "scale"
              ? "border-indigo-500/60 ring-1 ring-indigo-500/20"
              : "border-border/70 hover:border-border",
          )}
        >
          <div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Redes & Presença
                </span>
                {currentTier === "scale" ? (
                  <Badge variant="secondary" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                    Plano Atual
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <span>Expansão</span>
                <Crown className="size-4 text-indigo-500" />
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Para quem opera filiais e quer presença digital própria.
              </p>

              <div className="pt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">
                    {interval === "monthly" ? "R$ 199,00" : "R$ 149,17"}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">/ mês</span>
                </div>
                <p className="text-[11px] text-muted-foreground pt-0.5">
                  {interval === "monthly"
                    ? "Sem fidelidade"
                    : "R$ 1.790/ano à vista (Economize R$ 598)"}
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-1 text-xs">
              {/* 4 Bullets Essenciais */}
              <ul className="space-y-2.5 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-indigo-500" />
                  <span className="text-foreground"><strong>Página web exclusiva</strong> (Link na Bio e Matrícula)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-indigo-500" />
                  <span><strong>Multiunidades ilimitadas</strong> em um único login</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-indigo-500" />
                  <span>Passe livre do aluno em todas as filiais da rede</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-indigo-500" />
                  <span>BI de ocupação e inteligência preditiva de evasão</span>
                </li>
              </ul>

              {/* Botão para abrir modal de detalhes */}
              <button
                type="button"
                onClick={() => setModalTier("scale")}
                className="w-full text-center text-xs font-semibold text-primary hover:underline flex items-center justify-center gap-1 pt-1 cursor-pointer"
              >
                <Info className="size-3.5" />
                <span>Ver todos os recursos e detalhes (18)</span>
              </button>
            </CardContent>
          </div>

          <CardFooter className="pt-2">
            <Button
              variant={currentTier === "scale" ? "outline" : "secondary"}
              className="w-full text-xs font-semibold"
              disabled={currentTier === "scale" || isPending}
              onClick={() => onSelectTier("scale")}
            >
              {currentTier === "scale" ? "Plano Atual" : "Ativar Plano Expansão"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* MODAL DETALHADA COM TODOS OS RECURSOS ORGANIZADOS */}
      <Dialog open={modalTier !== null} onOpenChange={(open) => !open && setModalTier(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {modalTier && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    {modalTier === "pro" && <Sparkles className="size-5 text-amber-500" />}
                    {modalTier === "scale" && <Crown className="size-5 text-indigo-500" />}
                    <span>
                      Tudo o que está incluso no Plano{" "}
                      {modalTier === "free" ? "Grátis" : modalTier === "pro" ? "Profissional" : "Expansão"}
                    </span>
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs">
                  {modalTier === "free" && "Recursos essenciais para o dia a dia da sua academia, sem nenhum custo fixo."}
                  {modalTier === "pro" && "Tudo do Grátis, além de automação total de cobranças por WhatsApp, taxa Pix reduzida e gestão avançada."}
                  {modalTier === "scale" && "Tudo do Profissional, além de multiunidades ilimitadas, presença web dedicada e inteligência analítica."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* 1. Alunos e Treinos */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2">
                  <h4 className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                    <GraduationCap className="size-4 text-primary" />
                    <span>Área do Aluno & Treinos</span>
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Alunos e turmas ilimitados</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Histórico de presenças e frequência</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Trilha de graduação (faixas e graus)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Multi-perfis familiares (pais e filhos)</span>
                    </li>
                    {modalTier !== "free" && (
                      <>
                        <li className="flex items-center gap-2 font-medium text-foreground">
                          <Check className="size-3.5 text-primary shrink-0" />
                          <span>Pagamento com 1 clique no app</span>
                        </li>
                        <li className="flex items-center gap-2 font-medium text-foreground">
                          <Check className="size-3.5 text-primary shrink-0" />
                          <span>Reserva de vagas e fila de espera</span>
                        </li>
                        <li className="flex items-center gap-2 font-medium text-foreground">
                          <Check className="size-3.5 text-primary shrink-0" />
                          <span>Cancelamento com liberação de vaga</span>
                        </li>
                        <li className="flex items-center gap-2 font-medium text-foreground">
                          <Check className="size-3.5 text-primary shrink-0" />
                          <span>Certificados em PDF com QR Code</span>
                        </li>
                      </>
                    )}
                    {modalTier === "scale" && (
                      <li className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
                        <Check className="size-3.5 text-indigo-500 shrink-0" />
                        <span>Passe livre em qualquer filial da rede</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* 2. Área do Professor */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2">
                  <h4 className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                    <Users className="size-4 text-primary" />
                    <span>Área do Professor & Tatame</span>
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Chamada rápida no celular com áudio</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Fotos dos alunos na lista de presença</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Modo offline com sincronização</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Extrato de aulas e repasse a receber</span>
                    </li>
                    {modalTier !== "free" && (
                      <>
                        <li className="flex items-center gap-2 font-medium text-foreground">
                          <Check className="size-3.5 text-primary shrink-0" />
                          <span>Lançamento de notas pedagógicas no app</span>
                        </li>
                        <li className="flex items-center gap-2 font-medium text-foreground">
                          <Check className="size-3.5 text-primary shrink-0" />
                          <span>Indicação de graduação pelo tatame</span>
                        </li>
                        <li className="flex items-center gap-2 font-medium text-foreground">
                          <Check className="size-3.5 text-primary shrink-0" />
                          <span>Avisos discretos de pendência/atestado</span>
                        </li>
                        <li className="flex items-center gap-2 font-medium text-foreground">
                          <Check className="size-3.5 text-primary shrink-0" />
                          <span>Radar de alunos ausentes (+7 dias)</span>
                        </li>
                      </>
                    )}
                    {modalTier === "scale" && (
                      <li className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
                        <Check className="size-3.5 text-indigo-500 shrink-0" />
                        <span>Grade de aulas unificada entre unidades</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* 3. Cobranças, Caixa e Automações */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2">
                  <h4 className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                    <QrCode className="size-4 text-primary" />
                    <span>Cobranças, Caixa & WhatsApp</span>
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>
                        Taxa Pix: {modalTier === "free" ? "R$ 1,99 por Pix" : "R$ 1,29 por Pix (Economia de 35%)"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Opção de repasse de taxa ao aluno</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Livro caixa de entradas e despesas</span>
                    </li>
                    {modalTier !== "free" && (
                      <>
                        <li className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                          <Check className="size-3.5 text-emerald-500 shrink-0" />
                          <span>WhatsApp 100% Automático</span>
                        </li>
                        <li className="flex items-center gap-2 font-medium text-foreground">
                          <Check className="size-3.5 text-primary shrink-0" />
                          <span>DRE Gerencial Completa (lucro real)</span>
                        </li>
                        <li className="flex items-center gap-2 font-medium text-foreground">
                          <Check className="size-3.5 text-primary shrink-0" />
                          <span>Taxa de retenção e churn de alunos</span>
                        </li>
                      </>
                    )}
                    {modalTier === "scale" && (
                      <>
                        <li className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
                          <Check className="size-3.5 text-indigo-500 shrink-0" />
                          <span>Página web exclusiva (Link na Bio)</span>
                        </li>
                        <li className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
                          <Check className="size-3.5 text-indigo-500 shrink-0" />
                          <span>Taxas negociadas para grandes volumes</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  className="w-full text-xs font-bold"
                  disabled={modalTier === currentTier || isPending}
                  onClick={() => {
                    onSelectTier(modalTier);
                    setModalTier(null);
                  }}
                >
                  {modalTier === currentTier ? "Seu Plano Atual" : `Escolher Plano ${modalTier === "free" ? "Grátis" : modalTier === "pro" ? "Profissional" : "Expansão"}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
