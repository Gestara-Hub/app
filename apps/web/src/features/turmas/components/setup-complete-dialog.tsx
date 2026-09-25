"use client";

import { useRef } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  PartyPopper,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfettiBurst } from "@/components/shared/confetti-burst";

const NEXT_STEPS = [
  { icon: UserPlus, title: "Matricular alunos na turma" },
  { icon: CalendarCheck, title: "Fazer chamada no Calendário" },
  { icon: Wallet, title: "Acompanhar Mensalidades" },
];

/**
 * Comemoracao do setup inicial concluido, quando a 1a turma criada fecha as 7
 * etapas do guia. Permite ir direto para a matricula ou criar a proxima turma.
 */
export function SetupCompleteDialog({
  groupName,
  open,
  onOpenChange,
  onEnroll,
}: {
  groupName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnroll: () => void;
}) {
  const enrollRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          enrollRef.current?.focus();
        }}
      >
        <div className="relative overflow-hidden border-b bg-muted/30 px-6 pt-7 pb-5 text-center">
          <ConfettiBurst />
          <div className="relative mx-auto flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground ring-8 ring-primary/10 animate-in zoom-in-50 duration-500">
            <PartyPopper className="size-6" />
          </div>
          <div className="relative mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            <span>Configuração inicial 100% concluída</span>
          </div>
          <AlertDialogTitle className="relative mt-2 text-xl sm:text-2xl font-bold">
            Sua academia está pronta!
          </AlertDialogTitle>
          <AlertDialogDescription className="relative mt-1 text-center text-xs sm:text-sm">
            A turma <strong className="text-foreground">&ldquo;{groupName}&rdquo;</strong> foi
            criada.
          </AlertDialogDescription>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Sua operação no dia a dia
            </p>
            <ul className="space-y-2">
              {NEXT_STEPS.map(({ icon: Icon, title }) => (
                <li key={title} className="flex items-center gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background border border-border/60 text-muted-foreground shadow-2xs">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {title}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button ref={enrollRef} className="h-10 w-full gap-1.5" onClick={onEnroll}>
              Matricular alunos agora
              <ArrowRight className="size-4" />
            </Button>
            <AlertDialogCancel className="h-9 w-full">
              Agora não
            </AlertDialogCancel>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
