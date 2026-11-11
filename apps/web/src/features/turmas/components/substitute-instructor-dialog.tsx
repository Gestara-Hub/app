"use client";

import { RequiredMark } from "@/components/form";
import { useTeamWords } from "@/features/settings";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/lib/toast";
import { RotateCcw } from "lucide-react";
import { DialogBody } from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClassSessionDetail } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { useProfessionals } from "@/features/professionals";
import { substituteLabel, substituteOptions } from "../substitutes";
import {
  useRestorePrimaryInstructor,
  useSubstituteInstructor,
} from "../hooks/use-turmas";
import { focusField } from "@/lib/form-errors";

interface SubstituteInstructorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ClassSessionDetail;
}

interface SubstituteInstructorFormProps {
  session: ClassSessionDetail;
  onClose: () => void;
}

function SubstituteInstructorForm({
  session,
  onClose,
}: SubstituteInstructorFormProps) {
  const team = useTeamWords();
  const { data: professionals = [], isLoading: loadingProfessionals } =
    useProfessionals({ status: "active" });

  const substituteMut = useSubstituteInstructor();
  const restoreMut = useRestorePrimaryInstructor();

  const [instructorId, setInstructorId] = useState<string>(
    session.isSubstitute ? session.instructorId : "",
  );
  const [reason, setReason] = useState<string>(
    session.substitutionReason ?? "",
  );
  // Erro do service (ex.: conflito de horario do substituto), mostrado junto ao campo.
  const [submitError, setSubmitError] = useState<string | null>(null);

  const primaryInstructorId = session.primaryInstructorId ?? session.instructorId;
  const primaryInstructorName =
    session.primaryInstructorName ?? session.instructorName;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructorId) {
      toast.error(`Selecione o ${team.lower} substituto.`);
      focusField("substitute-instructor");
      return;
    }

    try {
      await substituteMut.mutateAsync({
        sessionId: session.id,
        payload: {
          instructorId,
          reason: reason.trim() || undefined,
        },
      });
      toast.success(`${team.title} da aula atualizado com sucesso.`);
      onClose();
    } catch (err) {
      const message = getErrorMessage(err, `Erro ao trocar ${team.lower}.`);
      setSubmitError(message);
      toast.error(message);
    }
  };

  const handleRestore = async () => {
    try {
      await restoreMut.mutateAsync(session.id);
      toast.success(`${team.title} titular restaurado com sucesso.`);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao restaurar titular."));
    }
  };

  const isPending = substituteMut.isPending || restoreMut.isPending;

  // Drawer a direita, como os outros formularios (doc 07 §2.7; pedido de 31/10/2026).
  return (
    <>
      <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
        <SheetTitle className="text-lg font-semibold text-foreground">Trocar {team.lower} desta aula</SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground">
          Só nesta aula. As outras seguem com o {team.lower} titular.
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={handleConfirm} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          {/* Resumo da aula: o que esta sendo trocado. */}
          <div className="space-y-0.5 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <p className="font-medium text-foreground">{session.className}</p>
            <p className="text-muted-foreground">
              {format(parseISO(session.date), "EEEE, dd/MM/yyyy", { locale: ptBR })} · {session.start} às {session.end}
            </p>
            <p className="text-muted-foreground">
              {team.title} titular: <span className="font-medium text-foreground">{primaryInstructorName}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="substitute-instructor">
              <span>
                {team.title} substituto
                <RequiredMark />
              </span>
            </Label>
            <Select
              value={instructorId}
              onValueChange={(value) => {
                setInstructorId(value);
                setSubmitError(null);
              }}
              disabled={isPending || loadingProfessionals}
            >
              <SelectTrigger
                id="substitute-instructor"
                className="w-full"
                aria-label={`${team.title} substituto`}
                aria-invalid={submitError ? true : undefined}
              >
                <SelectValue placeholder={`Selecione o ${team.lower}`} />
              </SelectTrigger>
              <SelectContent>
                {substituteOptions(professionals, session.modalityId, primaryInstructorId).map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {substituteLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {submitError ? (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="substitute-reason">Motivo (opcional)</Label>
            <Input
              id="substitute-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">Aparece na aula, ao lado do nome de quem substitui.</p>
          </div>
        </DialogBody>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/40 bg-background p-6 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {session.isSubstitute ? (
            <Button type="button" variant="outline" onClick={handleRestore} disabled={isPending} className="gap-1.5">
              <RotateCcw className="size-4" />
              Restaurar titular
            </Button>
          ) : (
            <span />
          )}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </SheetClose>
            <Button type="submit" disabled={isPending || !instructorId}>
              {isPending ? "Salvando..." : "Confirmar alteração"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

export function SubstituteInstructorDialog({
  open,
  onOpenChange,
  session,
}: SubstituteInstructorDialogProps) {
  const present = useDialogPresence(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {present && (
          <SubstituteInstructorForm
            key={session.id + (session.isSubstitute ? "-sub" : "-orig")}
            session={session}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
