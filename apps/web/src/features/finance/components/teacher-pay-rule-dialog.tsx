"use client";

import { useMemo } from "react";
import { FormProvider, useFieldArray, useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addCompetence, competenceRange } from "@gestarahub/core/finance";
import {
  DialogFormFooter,
  InputCurrency,
  InputNumber,
  MultiSelectField,
  SelectField,
  SwitchField,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { handleFormApiError } from "@/lib/form-errors";
import { teacherPayComponentLabel } from "@/lib/labels";
import { useRetainedValue } from "@/lib/use-retained-value";
import type { TeacherPayTeacher } from "@/services/teacherPayService";
import { useSaveTeacherPayRule } from "../hooks/use-teacher-pay";
import { competenceLabel, currentCompetence } from "../lib";
import {
  TEACHER_PAY_KINDS,
  emptyComponent,
  formValuesToPayload,
  ruleToFormValues,
  teacherPayRuleFormSchema,
  type TeacherPayRuleFormValues,
} from "../teacher-pay-schema";

type Values = TeacherPayRuleFormValues;

const KIND_OPTIONS = TEACHER_PAY_KINDS.map((kind) => ({
  value: kind,
  label: teacherPayComponentLabel(kind),
}));

const KIND_HINT: Record<Values["components"][number]["kind"], string> = {
  fixed_monthly: "Valor fixo todo mês.",
  per_session: "Valor por aula dada no mês (substituto recebe a aula).",
  per_student: "Valor por aluno ativo nas turmas dele no último dia do mês.",
  percent_of_memberships: "Porcentagem das mensalidades pagas dos alunos das turmas dele.",
};

interface TeacherPayRuleDialogProps {
  teacher: TeacherPayTeacher | null;
  /** Mes aberto na tela (padrao da vigencia de uma regra nova). */
  competence: string;
  onOpenChange: (open: boolean) => void;
}

/** "Configurar pagamento": partes da regra, dia de pagamento e vigencia. */
export function TeacherPayRuleDialog({ teacher: current, competence, onOpenChange }: TeacherPayRuleDialogProps) {
  // Guarda o ultimo professor enquanto o dialog anima a saida (sem isso o
  // formulario sumia e o titulo trocava no meio da animacao).
  const teacher = useRetainedValue(current) ?? null;

  return (
    <Dialog open={current !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="pr-12">
          <DialogTitle>
            {teacher?.rule ? "Editar pagamento" : "Configurar pagamento"}
          </DialogTitle>
          <DialogDescription>
            {teacher
              ? `Como ${teacher.name} recebe por mês. As partes são somadas.`
              : null}
          </DialogDescription>
        </DialogHeader>
        {teacher ? (
          <TeacherPayRuleForm
            key={teacher.professionalId}
            teacher={teacher}
            competence={competence}
            onSuccess={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TeacherPayRuleForm({
  teacher,
  competence,
  onSuccess,
}: {
  teacher: TeacherPayTeacher;
  competence: string;
  onSuccess: () => void;
}) {
  const saveMut = useSaveTeacherPayRule();
  const pending = saveMut.isPending;
  const isEdit = Boolean(teacher.rule);

  const form = useForm<Values>({
    resolver: zodResolver(teacherPayRuleFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: ruleToFormValues(teacher.rule, competence),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "components" });
  const components = useWatch({ control: form.control, name: "components" });

  const competenceOptions = useMemo(() => {
    const now = currentCompetence();
    const list = competenceRange(addCompetence(now, -12), addCompetence(now, 6));
    const start = teacher.rule?.startCompetence;
    if (start && !list.includes(start)) list.unshift(start);
    if (!list.includes(competence)) list.push(competence);
    return list.sort().map((c) => ({ value: c, label: competenceLabel(c) }));
  }, [teacher.rule?.startCompetence, competence]);

  // Turmas em que ele e titular (ativas + as ja escolhidas, mesmo inativas).
  const classOptions = useMemo(() => {
    const chosen = new Set(teacher.rule?.components.flatMap((c) => c.classGroupIds ?? []) ?? []);
    return teacher.classGroups
      .filter((g) => g.status === "active" || chosen.has(g.id))
      .map((g) => ({
        value: g.id,
        label: g.status === "active" ? g.name : `${g.name} (inativa)`,
      }));
  }, [teacher]);

  const componentsError =
    form.formState.errors.components?.message ?? form.formState.errors.components?.root?.message;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await saveMut.mutateAsync({
        professionalId: teacher.professionalId,
        payload: formValuesToPayload(values),
      });
      toast.success(isEdit ? "Pagamento atualizado." : "Pagamento configurado.");
      onSuccess();
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar o pagamento.");
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-3">
          {fields.map((field, index) => {
            const kind = components?.[index]?.kind ?? field.kind;
            const base = `components.${index}` as const;
            return (
              <div key={field.id} className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">Parte {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover parte ${index + 1}`}
                    disabled={pending || fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SelectField<Values>
                    name={`${base}.kind` as Path<Values>}
                    id={`${base}.kind`}
                    label="Tipo"
                    options={KIND_OPTIONS}
                    clearable={false}
                    required
                    disabled={pending}
                    hint={KIND_HINT[kind]}
                  />
                  {kind === "percent_of_memberships" ? (
                    <InputNumber<Values>
                      name={`${base}.percent` as Path<Values>}
                      id={`${base}.percent`}
                      label="Porcentagem"
                      placeholder="Ex.: 30"
                      min={0}
                      max={100}
                      step={0.5}
                      suffix="%"
                      required
                      disabled={pending}
                    />
                  ) : (
                    <InputCurrency<Values>
                      name={`${base}.amountCents` as Path<Values>}
                      id={`${base}.amountCents`}
                      label={
                        kind === "per_session"
                          ? "Valor por aula"
                          : kind === "per_student"
                            ? "Valor por aluno"
                            : "Valor mensal"
                      }
                      required
                      disabled={pending}
                    />
                  )}
                </div>
                {kind !== "fixed_monthly" ? (
                  classOptions.length > 0 ? (
                    <MultiSelectField<Values>
                      name={`${base}.classGroupIds` as Path<Values>}
                      id={`${base}.classGroupIds`}
                      label="Turmas"
                      placeholder="Todas as turmas dele"
                      searchPlaceholder="Buscar turma..."
                      emptyMessage="Nenhuma turma encontrada."
                      hint="Deixe vazio para valer em todas as turmas em que ele é titular."
                      options={classOptions}
                      disabled={pending}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {kind === "per_session"
                        ? "Ele ainda não é titular de nenhuma turma; contam só as aulas em que substituir."
                        : "Ele ainda não é titular de nenhuma turma; esta parte fica zerada até ter alunos."}
                    </p>
                  )
                ) : null}
              </div>
            );
          })}
          {componentsError ? (
            <p role="alert" className="text-sm text-destructive">
              {componentsError}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => append(emptyComponent("per_session"))}
          >
            <Plus className="size-4" />
            Adicionar parte
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputNumber<Values>
            name="paymentDay"
            label="Dia do pagamento"
            hint="Dia do mês seguinte em que o pagamento vence."
            min={1}
            max={28}
            required
            disabled={pending}
          />
          <SelectField<Values>
            name="startCompetence"
            label="Vale a partir de"
            options={competenceOptions}
            clearable={false}
            required
            disabled={pending}
          />
        </div>

        {isEdit ? (
          <SwitchField<Values>
            name="active"
            label="Regra ativa"
            hint="Desligada, o professor sai da prévia dos próximos fechamentos. Meses fechados não mudam."
            disabled={pending}
          />
        ) : null}

        <DialogFormFooter
          isPending={pending}
          isEdit={isEdit}
        />
      </form>
    </FormProvider>
  );
}
