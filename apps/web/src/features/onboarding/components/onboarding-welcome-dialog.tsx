"use client";

import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Boas-vindas do primeiro acesso: oferece dois caminhos (tour rapido pela
 * navegacao ou ir direto configurar). Dispensavel — "Agora nao" fecha sem forcar.
 */
export function OnboardingWelcomeDialog({
  open,
  onOpenChange,
  onStartTour,
  onStartSetup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartTour: () => void;
  onStartSetup: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Rocket className="size-5" />
          </div>
          <DialogTitle>Bem-vindo ao GestaraHub 👋</DialogTitle>
          <DialogDescription>
            Vamos deixar seu negócio pronto para os primeiros agendamentos.
            Prefere um tour rápido pela tela ou já começar a configurar?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button className="w-full" onClick={onStartSetup}>
            Configurar meu negócio
          </Button>
          <Button variant="outline" className="w-full" onClick={onStartTour}>
            Fazer o tour rápido
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
