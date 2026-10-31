"use client";

import { PillTabs } from "@/components/shared/pill-tabs";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import type { Id, StudentMeasurement, StudentMeasurementsModality } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatMeasureChange, formatMeasureValue } from "@gestarahub/core/measurements";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { ListItemActionsMenu, type ListItemAction } from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { DialogBody } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useRetainedValue } from "@/lib/use-retained-value";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/auth";
import { useRemoveMeasurement, useStudentMeasurements } from "../hooks/use-measurements";
import { MeasurementFormDialog } from "./measurement-form-dialog";

const day = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");

/** "Peso 78,5 kg · Prancha 45 s" (so as medidas com valor). */
function valuesLine(modality: StudentMeasurementsModality, m: StudentMeasurement): string {
  return modality.measures
    .filter((x) => typeof m.values[x.id] === "number")
    .map((x) => `${x.name} ${formatMeasureValue(m.values[x.id], x.unit)}`)
    .join(" · ");
}

function ModalityMeasurements({
  studentId,
  studentName,
  modality,
}: {
  studentId: Id;
  studentName: string;
  modality: StudentMeasurementsModality;
}) {
  const canManage = useCan()("progression:manage");
  const removeMut = useRemoveMeasurement();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentMeasurement | undefined>(undefined);

  const remove = async (m: StudentMeasurement) => {
    const ok = await confirm({
      title: "Excluir avaliação?",
      description: `As medidas de ${day(m.date)} saem da evolução do aluno.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    removeMut.mutate(m.id, {
      onSuccess: () => toast.success("Avaliação excluída."),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível excluir a avaliação.")),
    });
  };

  return (
    <div className="space-y-4">
      {confirmDialog}
      {canManage ? (
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          Nova avaliação
        </Button>
      ) : null}

      <ul className="divide-y rounded-lg border">
        {modality.progress.map((p) => (
          <li key={p.measure.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium break-words">{p.measure.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.latest
                  ? [
                      `Em ${day(p.latest.date)}`,
                      p.previous ? `antes ${formatMeasureValue(p.previous.value, p.measure.unit)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Sem medida ainda"}
              </p>
            </div>
            {p.latest ? (
              <span className="inline-flex items-center gap-2">
                {p.change !== null ? (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
                      p.improved === true &&
                        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400",
                      p.improved === false &&
                        "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
                      p.improved === null && "border-border bg-muted/40 text-muted-foreground",
                    )}
                    title={p.improved === true ? "Melhorou" : p.improved === false ? "Piorou" : "Igual"}
                  >
                    {formatMeasureChange(p.change, p.measure.unit)}
                  </span>
                ) : null}
                <span className="text-sm font-semibold tabular-nums">
                  {formatMeasureValue(p.latest.value, p.measure.unit)}
                </span>
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Avaliações ({modality.history.length})
        </p>
        {modality.history.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma avaliação ainda.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {modality.history.map((m) => {
              const actions: ListItemAction[] = canManage
                ? [
                    {
                      key: "edit",
                      label: "Editar",
                      icon: <Pencil className="size-4" />,
                      onSelect: () => {
                        setEditing(m);
                        setFormOpen(true);
                      },
                    },
                    {
                      key: "delete",
                      label: "Excluir",
                      icon: <Trash2 className="size-4" />,
                      destructive: true,
                      disabled: removeMut.isPending,
                      onSelect: () => void remove(m),
                    },
                  ]
                : [];
              return (
                <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{day(m.date)}</p>
                    <p className="text-xs text-muted-foreground break-words">{valuesLine(modality, m)}</p>
                    {m.notes ? <p className="mt-1 text-xs break-words text-foreground/80">{m.notes}</p> : null}
                  </div>
                  {actions.length > 0 ? (
                    <ListItemActionsMenu actions={actions} title={`Ações da avaliação de ${day(m.date)}`} variant="ghost" />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <MeasurementFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(undefined);
        }}
        studentId={studentId}
        studentName={studentName}
        modality={{ id: modality.modalityId, name: modality.modalityName, measures: modality.measures }}
        measurement={editing}
      />
    </div>
  );
}

function MeasurementsContent({
  studentId,
  studentName,
  initialModalityId,
}: {
  studentId: Id;
  studentName: string;
  initialModalityId?: Id;
}) {
  const { data, isPending } = useStudentMeasurements(studentId);
  const [selected, setSelected] = useState<Id | undefined>(initialModalityId);
  const modalities = data?.modalities ?? [];
  const active = modalities.find((m) => m.modalityId === selected) ?? modalities[0];

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }
  if (!active) {
    return (
      <ModuleEmptyGuide
        icon={<Ruler className="size-8" />}
        title="Sem testes e medidas por aqui."
        description="Ligue em Modalidades, na modalidade do aluno."
      />
    );
  }
  return (
    <div className="space-y-4">
      <PillTabs
        tabs={modalities.map((m) => ({ value: m.modalityId, label: m.modalityName }))}
        value={active.modalityId}
        onChange={setSelected}
      />
      <ModalityMeasurements key={active.modalityId} studentId={studentId} studentName={studentName} modality={active} />
    </div>
  );
}

/**
 * "Testes e medidas" do aluno (doc 21 §2.4, fase B): por modalidade com
 * medidas ligadas, a evolucao de cada medida e o historico das avaliacoes.
 */
export function StudentMeasurementsDialog({
  client: clientProp,
  open,
  onOpenChange,
  initialModalityId,
}: {
  client: { id: Id; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialModalityId?: Id;
}) {
  const client = useRetainedValue(clientProp);
  const present = useDialogPresence(open);
  if (!client) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 p-6 pb-3 pr-16 text-left border-b border-border/40">
          <SheetTitle className="text-lg font-semibold text-foreground">Testes e medidas</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{client.name}</SheetDescription>
        </SheetHeader>
        <DialogBody className="pb-6">
          {present ? (
            <MeasurementsContent studentId={client.id} studentName={client.name} initialModalityId={initialModalityId} />
          ) : null}
        </DialogBody>
      </SheetContent>
    </Sheet>
  );
}
