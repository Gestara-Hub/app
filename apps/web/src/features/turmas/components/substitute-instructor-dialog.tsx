"use client";

import { useTeamWords } from "@/features/settings";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "@/lib/toast";
import { RotateCcw, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  return (
    <>
      <DialogHeader className="pr-14">
        <DialogTitle className="flex items-center gap-2">
          <UserCheck className="size-5 text-primary" />
          Trocar {team.lower} desta aula
        </DialogTitle>
        <DialogDescription>
          Altere o {team.lower} responsável apenas por esta data e horário. As
          demais aulas da turma continuarão com o {team.lower} titular.
        </DialogDescription>
      </DialogHeader>

      {/* Resumo da Ocorrência */}
      <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-1 text-xs">
        <p className="font-semibold text-foreground">{session.className}</p>
        <p className="text-muted-foreground">
          Data:{" "}
          <span className="font-medium text-foreground">
            {format(parseISO(session.date), "dd/MM/yyyy")}
          </span>{" "}
          · Horário:{" "}
          <span className="font-medium text-foreground">
            {session.start}–{session.end}
          </span>
        </p>
        <p className="text-muted-foreground">
          {team.title} titular da turma:{" "}
          <span className="font-medium text-foreground">
            {primaryInstructorName}
          </span>
        </p>
      </div>

      <form onSubmit={handleConfirm} className="space-y-4 py-1">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            {team.title} substituto <span className="text-destructive">*</span>
          </label>
          <Select
            value={instructorId}
            onValueChange={(value) => {
              setInstructorId(value);
              setSubmitError(null);
            }}
            disabled={isPending || loadingProfessionals}
          >
            <SelectTrigger
              className="w-full"
              aria-label={`${team.title} substituto`}
              aria-invalid={submitError ? true : undefined}
            >
              <SelectValue placeholder={`Selecione o ${team.lower} substituto`} />
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
            <p role="alert" className="text-xs text-destructive">
              {submitError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Motivo da substituição (opcional)
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Informe o motivo da substituição (opcional)"
            disabled={isPending}
          />
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between pt-2">
          {session.isSubstitute ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleRestore}
              disabled={isPending}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              Restaurar titular
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 justify-end">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || !instructorId}>
              {isPending ? "Salvando..." : "Confirmar alteração"}
            </Button>
          </div>
        </DialogFooter>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
        expandable
        storageKey="substitute-instructor"
      >
        {present && (
          <SubstituteInstructorForm
            key={session.id + (session.isSubstitute ? "-sub" : "-orig")}
            session={session}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
