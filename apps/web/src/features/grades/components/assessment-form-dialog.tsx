"use client";

import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { AssessmentView, Id, ModalityProgressionTrack } from "@gestarahub/contracts";
import { validateWeight } from "@gestarahub/core/grades";
import { todayISO } from "@gestarahub/core/date";
import {
  DateField,
  DialogFormFooter,
  FieldShell,
  InputText,
  SelectField,
  fieldAria,
} from "@/components/form";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { handleFormApiError } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { useModalityVocabulary } from "@/features/settings";
import { useCreateAssessment, useUpdateAssessment } from "../hooks/use-grades";

const NAME_SUGGESTIONS = ["Prova", "Trabalho", "Prova prática", "Exame final"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome da avaliação."),
  date: z.string().min(1, "Informe a data da avaliação."),
  weight: z.string().superRefine((value, ctx) => {
    const check = validateWeight(value);
    if (!check.ok) ctx.addIssue({ code: "custom", message: check.message });
  }),
  levelId: z.string(),
});

type Values = z.infer<typeof schema>;

function toDefaults(assessment?: AssessmentView): Values {
  return {
    name: assessment?.name ?? "",
    date: assessment?.date ?? todayISO(),
    weight: assessment ? assessment.weight.toLocaleString("pt-BR") : "1",
    levelId: assessment?.levelId ?? "",
  };
}

function AssessmentForm({
  classGroupId,
  assessment,
  track,
  onDone,
}: {
  classGroupId: Id;
  assessment?: AssessmentView;
  track: ModalityProgressionTrack | null;
  onDone: () => void;
}) {
  const isEdit = Boolean(assessment);
  const createMut = useCreateAssessment();
  const updateMut = useUpdateAssessment();
  const pending = createMut.isPending || updateMut.isPending;
  const vocabulary = useModalityVocabulary(track);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(assessment),
  });
  const name = useWatch({ control: form.control, name: "name" }) ?? "";
  const levels = track?.enabled ? track.levels : [];

  const onSubmit = form.handleSubmit(async (values) => {
    const weight = Number(values.weight.trim().replace(",", "."));
    try {
      if (assessment) {
        await updateMut.mutateAsync({
          id: assessment.id,
          payload: { name: values.name, date: values.date, weight, levelId: values.levelId || null },
        });
        toast.success("Avaliação atualizada.");
      } else {
        await createMut.mutateAsync({
          classGroupId,
          name: values.name,
          date: values.date,
          weight,
          ...(values.levelId ? { levelId: values.levelId } : {}),
        });
        toast.success("Avaliação criada.");
      }
      onDone();
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar a avaliação.");
    }
  });

  return (
    <FormProvider {...form}>
      <form id="assessment-form" onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <InputText<Values>
              name="name"
              label="Nome"
              placeholder="Informe o nome da avaliação"
              required
              disabled={pending}
            />
            {!isEdit ? (
              <div className="flex flex-wrap items-center gap-1">
                {NAME_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={pending}
                    onClick={() => form.setValue("name", suggestion, { shouldDirty: true, shouldValidate: true })}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                      name.trim() === suggestion
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DateField<Values> name="date" label="Data" required disabled={pending} />
            <Controller
              control={form.control}
              name="weight"
              render={({ field, fieldState }) => (
                <FieldShell
                  id="assessment-weight"
                  label="Peso"
                  hint="Conta na média"
                  error={fieldState.error?.message}
                  required
                >
                  <Input
                    id="assessment-weight"
                    inputMode="decimal"
                    autoComplete="off"
                    className="text-base tabular-nums md:text-sm"
                    disabled={pending}
                    {...field}
                    {...fieldAria("assessment-weight", fieldState.error?.message, "Conta na média")}
                  />
                </FieldShell>
              )}
            />
          </div>

          {levels.length > 0 ? (
            <SelectField<Values>
              name="levelId"
              label={`${vocabulary.level} (opcional)`}
              placeholder={vocabulary.selectLevel}
              disabled={pending}
              options={levels.map((l) => ({ value: l.id, label: l.name }))}
            />
          ) : null}
        </DialogBody>
        <DialogFormFooter
          isPending={pending}
          isEdit={isEdit}
          className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
        />
      </form>
    </FormProvider>
  );
}

/** Nova avaliacao ou edicao (nome, data, peso e etapa da trilha). */
export function AssessmentFormDialog({
  open,
  onOpenChange,
  classGroupId,
  classGroupName,
  assessment,
  track,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classGroupId: Id;
  classGroupName: string;
  assessment?: AssessmentView;
  /** Trilha da modalidade da turma (etapa opcional). */
  track: ModalityProgressionTrack | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 p-6 pb-2 pr-20">
          <DialogTitle>{assessment ? "Editar avaliação" : "Nova avaliação"}</DialogTitle>
          <DialogDescription>{classGroupName}</DialogDescription>
        </DialogHeader>
        {open ? (
          <AssessmentForm
            key={assessment?.id ?? "new"}
            classGroupId={classGroupId}
            assessment={assessment}
            track={track}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
