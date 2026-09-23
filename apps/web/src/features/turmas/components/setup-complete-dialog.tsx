"use client";

import { ArrowRight, CalendarCheck, PartyPopper, UserPlus, Wallet } from "lucide-react";
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
  { icon: UserPlus, label: "Matricular os alunos" },
  { icon: CalendarCheck, label: "Registrar a frequência" },
  { icon: Wallet, label: "Gerar as mensalidades" },
];

/**
 * Comemoracao do cadastro basico concluido, quando a turma criada era o ultimo
 * passo pendente. A partir daqui a academia ja opera; as outras criacoes usam o
 * aviso simples.
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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="relative overflow-hidden bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-500 px-6 pt-8 pb-7 text-center text-white">
          <ConfettiBurst />
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-white/20 ring-8 ring-white/10 animate-in zoom-in-50 duration-500">
            <PartyPopper className="size-8" />
          </div>
          <p className="relative mt-4 text-xs font-semibold uppercase tracking-widest text-white/85">
            Cadastro básico concluído
          </p>
          <AlertDialogTitle className="relative mt-1 text-2xl font-bold text-white">
            Sua academia está pronta! 🎉
          </AlertDialogTitle>
        </div>

        <div className="space-y-5 p-6">
          <AlertDialogDescription className="text-center">
            A turma <strong className="text-foreground">&ldquo;{groupName}&rdquo;</strong> foi
            criada. Com ela, o cadastro básico está completo e você já pode começar a usar o
            GestaraHub no dia a dia.
          </AlertDialogDescription>

          <div className="grid grid-cols-3 gap-2">
            {NEXT_STEPS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-lg border border-fuchsia-200/80 bg-fuchsia-50/60 px-2 py-3 text-center dark:border-fuchsia-900/50 dark:bg-fuchsia-950/30"
              >
                <Icon className="size-5 text-fuchsia-600 dark:text-fuchsia-400" />
                <span className="text-xs font-medium leading-tight text-foreground">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="h-10 w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-xs shadow-fuchsia-600/25 hover:from-fuchsia-700 hover:to-pink-700"
              onClick={onEnroll}
            >
              Matricular alunos agora
              <ArrowRight className="size-4" />
            </Button>
            <AlertDialogCancel className="w-full">Fazer isso mais tarde</AlertDialogCancel>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
