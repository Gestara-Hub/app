"use client";

import { useMemo } from "react";
import { useRetainedValue } from "@/lib/use-retained-value";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import type { AssessmentView, Id, ModalityAssessmentSettings, ModalityProgressionTrack } from "@gestarahub/contracts";
import { scaleMax, usesPointsSum, validatePoints, validateWeight } from "@gestarahub/core/grades";
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
  DialogBody,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { handleFormApiError } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { useModalityVocabulary } from "@/features/settings";
import { useCreateAssessment, useUpdateAssessment } from "../hooks/use-grades";

const NAME_SUGGESTIONS = ["Prova", "Trabalho", "Prova prática", "Exame final"] as const;

const baseSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da avaliação."),
  date: z.string().min(1, "Informe a data da avaliação."),
  weight: z.string(),
  points: z.string(),
  levelId: z.string(),
  recoveryOf: z.string(),
});

type Values = z.infer<typeof baseSchema>;

/**
 * Peso (media) ou pontos (soma) conforme a modalidade; a recuperacao nao tem
 * nenhum dos dois (herda da avaliacao recuperada).
 */
function schemaFor(settings: ModalityAssessmentSettings | undefined) {
  const sum = settings ? usesPointsSum(settings) : false;
  return baseSchema.superRefine((values, ctx) => {
    if (values.recoveryOf) return;
    if (sum && settings) {
      const check = validatePoints(settings.scale, values.points);
      if (!check.ok) ctx.addIssue({ code: "custom", path: ["points"], message: check.message });
      return;
    }
    const check = validateWeight(values.weight);
    if (!check.ok) ctx.addIssue({ code: "custom", path: ["weight"], message: check.message });
  });
}

function toDefaults(assessment?: AssessmentView): Values {
  return {
    name: assessment?.name ?? "",
    date: assessment?.date ?? todayISO(),
    weight: assessment ? assessment.weight.toLocaleString("pt-BR") : "1",
    points: assessment?.points !== undefined ? assessment.points.toLocaleString("pt-BR") : "",
    levelId: assessment?.levelId ?? "",
    recoveryOf: assessment?.recoveryOf ?? "",
  };
}

const toNumber = (raw: string) => Number(raw.trim().replace(",", "."));

function AssessmentForm({
  classGroupId,
  assessment,
  track,
  settings,
  classAssessments,
  onDone,
}: {
  classGroupId: Id;
  assessment?: AssessmentView;
  track: ModalityProgressionTrack | null;
  settings: ModalityAssessmentSettings | undefined;
  classAssessments: AssessmentView[];
  onDone: () => void;
}) {
  const isEdit = Boolean(assessment);
  const createMut = useCreateAssessment();
  const updateMut = useUpdateAssessment();
  const pending = createMut.isPending || updateMut.isPending;
  const vocabulary = useModalityVocabulary(track);
  const schema = useMemo(() => schemaFor(settings), [settings]);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(assessment),
  });
  const name = useWatch({ control: form.control, name: "name" }) ?? "";
  const recoveryOf = useWatch({ control: form.control, name: "recoveryOf" }) ?? "";
  const levels = track?.enabled ? track.levels : [];
  const sum = settings ? usesPointsSum(settings) : false;
  const top = settings ? scaleMax(settings.scale) : undefined;
  // Recuperacao de uma avaliacao da turma que nao e recuperacao e ainda nao tem uma.
  const recoveryOptions = classAssessments
    .filter(
      (a) =>
        a.id !== assessment?.id &&
        !a.recoveryOf &&
        (a.id === assessment?.recoveryOf ||
          !classAssessments.some((r) => r.recoveryOf === a.id && r.id !== assessment?.id)),
    )
    .map((a) => ({ value: a.id, label: a.name }));
  const hasRecovery = Boolean(assessment && classAssessments.some((r) => r.recoveryOf === assessment.id));

  const onSubmit = form.handleSubmit(async (values) => {
    const isRecovery = Boolean(values.recoveryOf);
    const amounts = isRecovery ? {} : sum ? { points: toNumber(values.points) } : { weight: toNumber(values.weight) };
    try {
      if (assessment) {
        await updateMut.mutateAsync({
          id: assessment.id,
          payload: {
            name: values.name,
            date: values.date,
            ...amounts,
            levelId: isRecovery ? null : values.levelId || null,
            recoveryOf: values.recoveryOf || null,
          },
        });
        toast.success("Avaliação atualizada.");
      } else {
        await createMut.mutateAsync({
          classGroupId,
          name: values.name,
          date: values.date,
          ...amounts,
          ...(isRecovery ? { recoveryOf: values.recoveryOf } : values.levelId ? { levelId: values.levelId } : {}),
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

          {recoveryOptions.length > 0 && !hasRecovery ? (
            <SelectField<Values>
              name="recoveryOf"
              label="Recuperação de (opcional)"
              placeholder="Não é recuperação"
              hint="Vale a maior nota de cada aluno."
              disabled={pending}
              options={recoveryOptions}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <DateField<Values> name="date" label="Data" required disabled={pending} />
            {recoveryOf ? null : sum ? (
              <Controller
                control={form.control}
                name="points"
                render={({ field, fieldState }) => (
                  <FieldShell
                    id="assessment-points"
                    label="Vale (pontos)"
                    hint={top ? `Parte dos ${top} pontos` : undefined}
                    error={fieldState.error?.message}
                    required
                  >
                    <Input
                      id="assessment-points"
                      inputMode="decimal"
                      autoComplete="off"
                      className="text-base tabular-nums md:text-sm"
                      disabled={pending}
                      {...field}
                      {...fieldAria("assessment-points", fieldState.error?.message, top ? `Parte dos ${top} pontos` : undefined)}
                    />
                  </FieldShell>
                )}
              />
            ) : (
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
            )}
          </div>

          {levels.length > 0 && !recoveryOf ? (
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

/** Nova avaliacao ou edicao (nome, data, peso ou pontos, etapa e recuperacao). */
export function AssessmentFormDialog({
  open,
  onOpenChange,
  classGroupId,
  classGroupName,
  assessment: assessmentProp,
  track,
  settings,
  classAssessments = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classGroupId: Id;
  classGroupName: string;
  assessment?: AssessmentView;
  /** Trilha da modalidade da turma (etapa opcional). */
  track: ModalityProgressionTrack | null;
  /** Configuracao da modalidade (peso ou pontos). */
  settings?: ModalityAssessmentSettings;
  /** Avaliacoes da turma (para escolher a recuperada). */
  classAssessments?: AssessmentView[];
}) {
  // Enquanto fecha, mantem a avaliacao (titulo "Editar") e o formulario montado.
  const assessment = useRetainedValue(assessmentProp) ?? undefined;
  const present = useDialogPresence(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 p-6 pb-4 border-b border-border/40 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {assessment ? "Editar avaliação" : "Nova avaliação"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{classGroupName}</SheetDescription>
        </SheetHeader>
        {present ? (
          <AssessmentForm
            key={assessment?.id ?? "new"}
            classGroupId={classGroupId}
            assessment={assessment}
            track={track}
            settings={settings}
            classAssessments={classAssessments}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
