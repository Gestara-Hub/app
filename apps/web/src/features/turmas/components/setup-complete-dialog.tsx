"use client";

import { useRef } from "react";
import { ArrowRight, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfettiBurst } from "@/components/shared/confetti-burst";

/**
 * Comemoracao da configuracao inicial concluida, com uma acao so (quem nao le
 * ainda acha o passo seguinte). `created`: a 1a turma fecha o guia e leva a
 * matricular. `enrolled`: na area de curso, o guia so fecha na 1a matricula do
 * curso e leva as cobrancas geradas. Fechar deixa o "Proximo passo" no topo.
 */
export function SetupCompleteDialog({
  groupName,
  open,
  onOpenChange,
  onPrimary,
  variant = "created",
}: {
  groupName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrimary: () => void;
  variant?: "created" | "enrolled";
}) {
  const enrolled = variant === "enrolled";
  const primaryRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          primaryRef.current?.focus();
        }}
      >
        <div className="relative overflow-hidden px-6 pt-8 pb-6 text-center">
          <ConfettiBurst />
          <div className="relative mx-auto flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground ring-8 ring-primary/10 animate-in zoom-in-50 duration-500">
            <PartyPopper className="size-6" />
          </div>
          <AlertDialogTitle className="relative mt-4 text-xl font-bold sm:text-2xl">
            Seu espaço está pronto!
          </AlertDialogTitle>
          <AlertDialogDescription className="relative mt-2 text-center text-sm leading-relaxed">
            {enrolled ? (
              <>
                Os alunos já estão no curso{" "}
                <strong className="text-foreground">&ldquo;{groupName}&rdquo;</strong>. Veja as parcelas geradas.
              </>
            ) : (
              <>
                Agora matricule os alunos da turma{" "}
                <strong className="text-foreground">&ldquo;{groupName}&rdquo;</strong>.
              </>
            )}
          </AlertDialogDescription>

          <div className="relative mt-6 flex flex-col gap-1">
            <Button ref={primaryRef} className="w-full gap-1.5" onClick={onPrimary}>
              {enrolled ? "Ver as cobranças" : "Matricular alunos agora"}
              <ArrowRight className="size-4" />
            </Button>
            <AlertDialogCancel variant="ghost" className="w-full text-muted-foreground">
              Agora não
            </AlertDialogCancel>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
