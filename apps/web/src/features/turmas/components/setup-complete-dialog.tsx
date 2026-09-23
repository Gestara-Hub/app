"use client";

import { useRef } from "react";
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
  const enrollRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
        // Foco inicial na acao principal (o padrao do AlertDialog e o "Cancelar").
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          enrollRef.current?.focus();
        }}
      >
        <div className="relative overflow-hidden border-b bg-muted/40 px-6 pt-8 pb-6 text-center">
          <ConfettiBurst />
          <div className="relative mx-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground ring-8 ring-primary/10 animate-in zoom-in-50 duration-500">
            <PartyPopper className="size-7" />
          </div>
          <p className="relative mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Cadastro básico concluído
          </p>
          <AlertDialogTitle className="relative mt-1 text-2xl font-bold">
            Sua academia está pronta!
          </AlertDialogTitle>
        </div>

        <div className="space-y-5 p-6">
          <AlertDialogDescription className="text-center">
            A turma <strong className="text-foreground">&ldquo;{groupName}&rdquo;</strong> foi
            criada. Com ela, o cadastro básico está completo e você já pode começar a usar o
            GestaraHub no dia a dia.
          </AlertDialogDescription>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Próximos passos
            </p>
            <ul className="space-y-2">
              {NEXT_STEPS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm text-foreground">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button ref={enrollRef} className="h-10 w-full" onClick={onEnroll}>
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
