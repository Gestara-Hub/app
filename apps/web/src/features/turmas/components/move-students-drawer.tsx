"use client";

import { useMemo, useState } from "react";
import { isApiError, type ClassGroupView, type Id } from "@gestarahub/contracts";
import { classBillingMode } from "@gestarahub/core/billing";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { plural } from "@gestarahub/core/format";
import { RequiredMark } from "@/components/form";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { Combobox } from "@/components/shared/combobox";
import { Button } from "@/components/ui/button";
import { DialogBody } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/features/categories";
import { useCan } from "@/features/auth";
import { useModalityVocabulary } from "@/features/settings";
import { focusField } from "@/lib/form-errors";
import { resolveModalityTrack } from "@/lib/progression-tracks";
import { toast } from "@/lib/toast";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useClassGroups, useMoveStudents } from "../hooks/use-turmas";

/**
 * "Mudar de turma" (doc product/30 §2): um ou varios alunos saem desta turma e
 * entram em outra num passo, sem cancelar e matricular de novo. A matricula
 * antiga fica como "Mudou para {turma}". Curso fica de fora (o proximo modulo
 * e uma matricula nova, com cobranca).
 */

export interface MovingStudent {
  id: Id;
  name: string;
}

interface MoveStudentsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: ClassGroupView;
  students: MovingStudent[];
  /** Depois de mudar (ex.: sair da selecao). */
  onMoved?: () => void;
}

function spotsLabel(g: ClassGroupView): string {
  return g.availableSpots > 0 ? plural(g.availableSpots, "vaga", "vagas") : "lotada";
}

function MoveStudentsForm({ from, students, onClose, onMoved }: Omit<MoveStudentsDrawerProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const can = useCan();
  const { data: classGroups, isPending: classesPending } = useClassGroups({ status: "active" });
  const { data: categories } = useCategories();
  const moveMut = useMoveStudents();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const [toId, setToId] = useState("");
  const [promote, setPromote] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Mesma modalidade primeiro; curso fica de fora.
  const options = useMemo(() => {
    const list = (classGroups ?? []).filter((g) => g.id !== from.id && classBillingMode(g) !== "course");
    const same = list.filter((g) => g.modalityId === from.modalityId);
    const others = list.filter((g) => g.modalityId !== from.modalityId);
    return [...same, ...others].map((g) => ({
      value: g.id,
      label: `${g.name} · ${g.modalityId === from.modalityId ? "" : `${g.modalityName ?? "Outra modalidade"} · `}${spotsLabel(g)}`,
    }));
  }, [classGroups, from.id, from.modalityId]);

  const to = (classGroups ?? []).find((g) => g.id === toId);
  const toModality = (categories ?? []).find((c) => c.id === to?.modalityId);
  const toTrack = toModality ? resolveModalityTrack(toModality) : undefined;
  const vocabulary = useModalityVocabulary(toTrack);
  // "Subir de nivel junto" so com trilha na modalidade de destino e quem pode graduar.
  const canPromote = Boolean(toTrack?.enabled) && can("progression:manage");
  const levelWord = vocabulary.level.toLowerCase();

  const single = students.length === 1;
  const isPending = moveMut.isPending;

  const send = async (allowOverCapacity: boolean) => {
    if (!to) return;
    try {
      const result = await moveMut.mutateAsync({
        input: {
          fromClassGroupId: from.id,
          toClassGroupId: to.id,
          studentIds: students.map((s) => s.id),
          promote: canPromote && promote,
        },
        allowOverCapacity,
      });
      const who = single ? `${students[0].name} mudou` : `${plural(result.moved, "aluno mudou", "alunos mudaram")}`;
      const up =
        result.promoted > 0
          ? single
            ? ` e subiu de ${levelWord}`
            : `; ${plural(result.promoted, "subiu", "subiram")} de ${levelWord}`
          : "";
      toast.success(`${who} para ${to.name}${up}.`);
      onMoved?.();
      onClose();
    } catch (err) {
      if (!allowOverCapacity && isApiError(err) && err.code === "CLASS_FULL") {
        const ok = await confirm({
          title: "Turma sem vagas para todos",
          description: `${err.message} Mudar mesmo assim?`,
          confirmLabel: "Mudar mesmo assim",
        });
        if (ok) await send(true);
        return;
      }
      const message = getErrorMessage(err, "Não foi possível mudar de turma.");
      setFieldError(message);
      toast.error(message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to) {
      setFieldError("Escolha a turma de destino.");
      focusField("move-to-class");
      return;
    }
    await send(false);
  };

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
        <SheetTitle className="text-lg font-semibold text-foreground">Mudar de turma</SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground">
          {single ? `${students[0].name} sai de ${from.name}.` : `${plural(students.length, "aluno sai", "alunos saem")} de ${from.name}.`}{" "}
          A matrícula fica como mudança, não como saída.
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          {!single ? (
            <p className="min-w-0 break-words rounded-lg border bg-muted/40 px-3 py-2 text-sm text-foreground">
              {students.map((s) => s.name).join(", ")}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="move-to-class">
              <span>
                Turma de destino
                <RequiredMark />
              </span>
            </Label>
            <Combobox
              id="move-to-class"
              value={toId}
              onChange={(value) => {
                setToId(value);
                setFieldError(null);
              }}
              options={options}
              placeholder={classesPending ? "Carregando turmas..." : "Selecione a turma"}
              searchPlaceholder="Buscar turma..."
              emptyMessage="Nenhuma outra turma ativa."
              invalid={Boolean(fieldError)}
              ariaDescribedBy={fieldError ? "move-to-class-error" : undefined}
              disabled={isPending}
            />
            {fieldError ? (
              <p id="move-to-class-error" role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            ) : null}
          </div>

          {canPromote ? (
            <label htmlFor="move-promote" className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-medium text-foreground">Subir de {levelWord} junto</span>
                <span className="block text-xs text-muted-foreground">
                  {single ? "Vai para o próximo" : "Cada aluno vai para o próximo"} {levelWord} de {toModality?.name}.
                </span>
              </span>
              <Switch id="move-promote" checked={promote} onCheckedChange={setPromote} disabled={isPending} />
            </label>
          ) : null}
        </DialogBody>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border/40 bg-background p-6 pt-4 sm:flex sm:justify-end">
          <SheetClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </SheetClose>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando..." : "Mudar de turma"}
          </Button>
        </div>
      </form>
      {confirmDialog}
    </>
  );
}

export function MoveStudentsDrawer({ open, onOpenChange, from, students, onMoved }: MoveStudentsDrawerProps) {
  const present = useDialogPresence(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {present && students.length > 0 ? (
          <MoveStudentsForm
            key={students.map((s) => s.id).join(",")}
            from={from}
            students={students}
            onMoved={onMoved}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
