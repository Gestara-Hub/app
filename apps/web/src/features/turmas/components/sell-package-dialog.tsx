"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Info } from "lucide-react";
import type { Client, LessonPackage } from "@gestarahub/contracts";
import { getFieldErrors } from "@gestarahub/core/api-error";
import { MAX_INSTALLMENTS } from "@gestarahub/core/billing";
import { plural } from "@gestarahub/core/format";
import { carryOverSources, packageScopesOverlap, packageState } from "@gestarahub/core/packages";
import {
  ComboboxField,
  DateField,
  DialogFormFooter,
  InputCurrency,
  SelectField,
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
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { handleFormApiError } from "@/lib/form-errors";
import { withKind } from "@/lib/text";
import { useLessonPackages, useSellPackage, useStudentPackages } from "../hooks/use-packages";
import { pastDueHint, paymentSummary } from "../installments-summary";
import { dateInSpace } from "@gestarahub/core/date";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    packageId: z.string({ error: "Selecione o pacote." }).min(1, "Selecione o pacote."),
    priceCents: z.number({ error: "Informe o valor." }).int("Informe o valor.").min(1, "Informe o valor."),
    installments: z.string().min(1, "Escolha as parcelas."),
    firstDueDate: z.string().regex(DATE_RE, "Informe o 1º vencimento."),
  })
  // Parcela de R$ 0 nao e cobranca (mesma regra do servico).
  // Valor vazio ou 0 ja tem o erro do valor (nao repete aqui).
  .refine((v) => v.priceCents < 1 || v.priceCents >= Number(v.installments), {
    path: ["installments"],
    message: "Cada parcela precisa de pelo menos R$ 0,01.",
  });
type SellPackageValues = z.infer<typeof schema>;

const INSTALLMENT_OPTIONS = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? "À vista" : `${i + 1}x`,
}));

/** "10 aulas · vale 30 dias" (ou "sem validade"). */
function packageFacts(pkg: LessonPackage): string {
  const validity = !pkg.validityDays
    ? "sem validade"
    : pkg.validityDays === 365
      ? "vale 1 ano"
      : `vale ${pkg.validityDays} dias`;
  return `${plural(pkg.lessons, "aula", "aulas")} · ${validity}`;
}

function SellPackageForm({
  student,
  initialPackageId,
  onSuccess,
  onCancel,
}: {
  student: Pick<Client, "id" | "name">;
  initialPackageId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const sellMut = useSellPackage();
  const pending = sellMut.isPending;
  const { data: catalog, isPending: catalogPending } = useLessonPackages({ status: "active" });
  const { data: owned } = useStudentPackages({ studentId: student.id });
  const options = useMemo(
    () => (catalog ?? []).map((p) => ({ value: p.id, label: p.name })),
    [catalog],
  );

  const form = useForm<SellPackageValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      packageId: "",
      priceCents: 0,
      installments: "1",
      firstDueDate: dateInSpace(),
    },
  });

  const [packageId, priceCents, installments, firstDueDate] = useWatch({
    control: form.control,
    name: ["packageId", "priceCents", "installments", "firstDueDate"],
  });
  // Escolher o pacote preenche o valor dele (editavel: e o unico desconto).
  const pricedFor = useRef("");
  // Renovar: ja abre com o mesmo pacote, se ele ainda esta ativo no catalogo.
  // Vira o ponto de partida do formulario (fechar sem mexer nao pede descarte).
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !initialPackageId || !catalog) return;
    preselected.current = true;
    const pkg = catalog.find((p) => p.id === initialPackageId);
    if (pkg) {
      pricedFor.current = pkg.id;
      form.reset({ ...form.getValues(), packageId: pkg.id, priceCents: pkg.priceCents });
    }
  }, [catalog, initialPackageId, form]);
  const chosen = (catalog ?? []).find((p) => p.id === packageId);
  useEffect(() => {
    if (!chosen || pricedFor.current === chosen.id) return;
    pricedFor.current = chosen.id;
    form.setValue("priceCents", chosen.priceCents, { shouldDirty: true });
  }, [chosen, form]);
  const summary = paymentSummary(priceCents ?? 0, Number(installments), firstDueDate ?? "");
  const pastDue = pastDueHint(firstDueDate ?? "");
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  // Regra 6: comprar de novo o mesmo pacote traz o saldo dele; outro pacote da
  // mesma turma fica separado (avisa, para ninguem esperar a soma).
  const today = dateInSpace();
  const carried = chosen ? carryOverSources(owned ?? [], chosen.id, today).lessons : 0;
  const keptApart = chosen
    ? (owned ?? []).filter(
        (p) =>
          p.packageId !== chosen.id &&
          packageState(p, today).remaining > 0 &&
          packageScopesOverlap(p, chosen),
      )
    : [];

  const onSubmit = form.handleSubmit(async (values) => {
    // Data no passado costuma ser engano (ano errado): confirma antes de vender.
    if (pastDueHint(values.firstDueDate)) {
      const ok = await confirm({
        title: "Vencimento no passado?",
        description: `O 1º vencimento é ${format(parseISO(values.firstDueDate), "dd/MM/yyyy")} e já entra atrasado.`,
        confirmLabel: "Vender assim",
        variant: "default",
      });
      if (!ok) return;
    }
    try {
      await sellMut.mutateAsync({
        studentId: student.id,
        packageId: values.packageId,
        priceCents: values.priceCents,
        installments: Number(values.installments),
        firstDueDate: values.firstDueDate,
      });
      toast.success("Pacote vendido.");
      onSuccess();
    } catch (error) {
      // Aluno fixo: o campo nao aparece, o erro vira aviso.
      const studentError = getFieldErrors(error)?.find((f) => f.field === "studentId");
      if (studentError) toast.error(studentError.message);
      else handleFormApiError(error, form, "Não foi possível vender o pacote.");
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <ComboboxField<SellPackageValues>
            name="packageId"
            label="Pacote"
            placeholder={catalogPending ? "Carregando..." : "Selecione o pacote"}
            searchPlaceholder="Buscar pacote..."
            emptyMessage="Nenhum pacote ativo. Cadastre em Planos."
            hint={chosen ? packageFacts(chosen) : undefined}
            options={options}
            required
            disabled={pending}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <InputCurrency<SellPackageValues> name="priceCents" label="Valor" required disabled={pending} />
            <SelectField<SellPackageValues>
              name="installments"
              label="Parcelas"
              options={INSTALLMENT_OPTIONS}
              clearable={false}
              disabled={pending}
            />
            <DateField<SellPackageValues> name="firstDueDate" label="1º vencimento" required disabled={pending} />
          </div>
          {pastDue ? (
            <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="past-due-hint">
              {pastDue}
            </p>
          ) : null}

          {summary ? (
            <p className="text-xs text-muted-foreground" data-testid="package-installments-summary">
              {summary}
            </p>
          ) : null}

          {carried > 0 && chosen ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-0.5">
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Atenção: renovação de pacote em andamento
                </p>
                <p className="leading-relaxed">
                  O {withKind("pacote", chosen.name)} atual será encerrado como <strong>Renovado</strong> e o saldo de{" "}
                  <strong>{plural(carried, "aula", "aulas")}</strong> será somado a este novo pacote (total de{" "}
                  <strong>{plural(carried + chosen.lessons, "aula", "aulas")}</strong>).
                </p>
              </div>
            </div>
          ) : null}
          {keptApart.length > 0 ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3.5 py-2.5 text-xs text-sky-900 dark:border-sky-500/25 dark:bg-sky-950/30 dark:text-sky-200">
              <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <p className="leading-relaxed">
                {keptApart.length === 1
                  ? `O ${withKind("pacote", keptApart[0].name)} atual continua ativo separadamente.`
                  : `Os pacotes ${keptApart.map((p) => p.name).join(" e ")} atuais continuam ativos separadamente.`}{" "}
                Na chamada, o sistema desconta primeiro do pacote que vence antes.
              </p>
            </div>
          ) : null}
        </DialogBody>
        <DialogFormFooter
          isPending={pending}
          onCancel={onCancel}
          className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
        />
      </form>
      {confirmDialog}
    </FormProvider>
  );
}

/** Venda de um pacote de aulas ao aluno (menu do aluno em Alunos e ficha do aluno). */
export function SellPackageDialog({
  open,
  onOpenChange,
  student,
  initialPackageId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Pick<Client, "id" | "name"> | null;
  /** Renovar: o pacote do catalogo ja escolhido. */
  initialPackageId?: string;
}) {
  // Retem o aluno durante a animacao de saida; `session` recomeca o formulario a cada abertura.
  const [shown, setShown] = useState({ open, student, session: 0 });
  if (open && (!shown.open || student !== shown.student)) {
    setShown({ open, student, session: shown.open ? shown.session : shown.session + 1 });
  } else if (!open && shown.open) {
    setShown({ ...shown, open: false });
  }
  const fixed = shown.student;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">Vender pacote</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {fixed ? `Pacote de aulas para ${fixed.name}.` : "Pacote de aulas para o aluno."}
          </SheetDescription>
        </SheetHeader>
        {fixed ? (
          <SellPackageForm
            key={`${shown.session}-${fixed.id}`}
            student={fixed}
            initialPackageId={initialPackageId}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export const SellPackageDrawer = SellPackageDialog;
