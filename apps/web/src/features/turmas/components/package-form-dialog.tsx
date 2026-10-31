"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import type { ClassGroupView, CreateLessonPackage, LessonPackage } from "@gestarahub/contracts";
import { classBillingMode } from "@gestarahub/core/billing";
import { MAX_PACKAGE_LESSONS } from "@gestarahub/core/packages";
import {
  DialogFormFooter,
  InputCurrency,
  InputNumber,
  InputText,
  MultiSelectField,
  SelectField,
  SwitchField,
  type MultiSelectOption,
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
import { handleFormApiError } from "@/lib/form-errors";
import { useCreateLessonPackage, useUpdateLessonPackage } from "../hooks/use-packages";
import { useClassGroups } from "../hooks/use-turmas";

/** Validade em dias ("none" = sem validade). */
export const VALIDITY_OPTIONS = [
  { value: "none", label: "Sem validade" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
  { value: "180", label: "180 dias" },
  { value: "365", label: "1 ano" },
];

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome do pacote."),
  lessons: z
    .number({ error: "Informe a quantidade de aulas." })
    .int("Informe um número inteiro de aulas.")
    .min(1, `Informe de 1 a ${MAX_PACKAGE_LESSONS} aulas.`)
    .max(MAX_PACKAGE_LESSONS, `Informe de 1 a ${MAX_PACKAGE_LESSONS} aulas.`),
  priceCents: z
    .number({ error: "Informe um valor válido." })
    .int("Informe um valor válido.")
    .min(1, "Informe um valor maior que zero."),
  validity: z.string(),
  classGroupIds: z.array(z.string()),
  absenceConsumes: z.boolean(),
});
type PackageFormValues = z.infer<typeof schema>;

/** Validade guardada que nao esta na lista (dado antigo) aparece como opcao propria. */
function validityOptions(current?: number) {
  if (!current || VALIDITY_OPTIONS.some((o) => o.value === String(current))) return VALIDITY_OPTIONS;
  return [...VALIDITY_OPTIONS, { value: String(current), label: `${current} dias` }];
}

/** Turmas que aceitam pacote: de pacote ou de mensalidade (curso e sem cobranca, nunca). */
function acceptsPackages(g: ClassGroupView): boolean {
  const mode = classBillingMode(g);
  return mode === "package" || mode === "membership";
}

/**
 * Turmas do pacote no formulario. Pacote antigo, por modalidade, vira as
 * turmas dessas modalidades (a escolha agora e por turma).
 */
function initialClassIds(pkg: LessonPackage | undefined, classes: ClassGroupView[]): string[] {
  if (!pkg) return [];
  if (pkg.classGroupIds?.length) return pkg.classGroupIds;
  if (pkg.modalityIds.length === 0) return [];
  return classes.filter((g) => g.modalityId && pkg.modalityIds.includes(g.modalityId)).map((g) => g.id);
}

function PackageForm({
  pkg,
  classes,
  onSuccess,
  onCancel,
}: {
  pkg?: LessonPackage;
  classes: ClassGroupView[];
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const createMut = useCreateLessonPackage();
  const updateMut = useUpdateLessonPackage();
  const isEdit = Boolean(pkg);
  const pending = createMut.isPending || updateMut.isPending;
  const classOptions: MultiSelectOption[] = classes.map((g) => ({ label: g.name, value: g.id }));

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: pkg
      ? {
          name: pkg.name,
          lessons: pkg.lessons,
          priceCents: pkg.priceCents,
          validity: pkg.validityDays ? String(pkg.validityDays) : "none",
          classGroupIds: initialClassIds(pkg, classes),
          absenceConsumes: pkg.absenceConsumes,
        }
      : {
          name: "",
          lessons: 10,
          priceCents: 0,
          validity: "none",
          classGroupIds: [],
          absenceConsumes: true,
        },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreateLessonPackage = {
      name: values.name.trim(),
      lessons: values.lessons,
      priceCents: values.priceCents,
      validityDays: values.validity === "none" ? undefined : Number(values.validity),
      classGroupIds: values.classGroupIds,
      // A escolha agora e por turma; modalidade fica so no dado antigo.
      modalityIds: [],
      absenceConsumes: values.absenceConsumes,
      status: pkg?.status ?? "active",
    };
    try {
      if (isEdit && pkg) {
        await updateMut.mutateAsync({ id: pkg.id, payload });
        toast.success("Pacote atualizado.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Pacote criado.");
      }
      onSuccess();
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar o pacote.");
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <InputText<PackageFormValues>
            name="name"
            label="Nome"
            placeholder="Informe o nome do pacote"
            required
            disabled={pending}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputNumber<PackageFormValues>
              name="lessons"
              label="Quantidade de aulas"
              min={1}
              max={MAX_PACKAGE_LESSONS}
              required
              disabled={pending}
            />
            <InputCurrency<PackageFormValues> name="priceCents" label="Valor" required disabled={pending} />
          </div>
          <SelectField<PackageFormValues>
            name="validity"
            label="Validade"
            options={validityOptions(pkg?.validityDays)}
            clearable={false}
            hint="Vencido, o saldo é perdido."
            disabled={pending}
          />
          <MultiSelectField<PackageFormValues>
            name="classGroupIds"
            label="Turmas"
            placeholder="Todas as turmas"
            searchPlaceholder="Buscar turma..."
            emptyMessage="Nenhuma turma de pacote ou mensalidade."
            hint="Sem escolha, vale em todas. Curso e turma sem cobrança, nunca."
            options={classOptions}
            disabled={pending}
          />
          <SwitchField<PackageFormValues>
            name="absenceConsumes"
            label="Falta sem justificativa gasta a aula"
            hint="Falta justificada nunca gasta."
            disabled={pending}
          />
        </DialogBody>
        <DialogFormFooter
          isPending={pending}
          isEdit={isEdit}
          onCancel={onCancel}
          className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
        />
      </form>
    </FormProvider>
  );
}

/** Novo pacote ou edicao (vale para as proximas vendas). */
export function PackageFormDialog({
  open,
  onOpenChange,
  pkg,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg?: LessonPackage | null;
}) {
  // Retem o pacote durante a animacao de saida; `session` recomeca o formulario a cada abertura.
  const [shown, setShown] = useState({ open, pkg, session: 0 });
  if (open && (!shown.open || pkg !== shown.pkg)) {
    setShown({ open, pkg, session: shown.open ? shown.session : shown.session + 1 });
  } else if (!open && shown.open) {
    setShown({ ...shown, open: false });
  }
  const editing = shown.pkg ?? undefined;
  const { data: allClasses, isPending: classesPending } = useClassGroups({ status: "active" });
  const classes = (allClasses ?? []).filter(acceptsPackages);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {editing ? "Editar pacote" : "Novo pacote"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {editing ? "Vale para as próximas vendas." : "Aulas vendidas juntas, usadas na chamada."}
          </SheetDescription>
        </SheetHeader>
        {classesPending ? null : (
          <PackageForm
            key={`${shown.session}-${editing?.id ?? "new"}`}
            pkg={editing}
            classes={classes}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
