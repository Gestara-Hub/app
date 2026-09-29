"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import type {
  FinancialEntry,
  FinancialEntryType,
  FinancialEntryUpdateScope,
  PaymentMethod,
  UpdateFinancialEntry,
} from "@gestarahub/contracts";
import {
  DateField,
  DialogFormFooter,
  InputCurrency,
  InputText,
  SegmentedChoiceField,
  SelectField,
  SwitchField,
  TextArea,
} from "@/components/form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { handleFormApiError } from "@/lib/form-errors";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/labels";
import {
  useCreateFinanceEntry,
  useFinancialCategories,
  useUpdateFinanceEntry,
} from "../hooks/use-finance";
import { FinancialCategoryManagerDialog } from "./financial-category-manager-dialog";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    type: z.enum(["income", "expense"], { error: "Escolha entre entrada e saída." }),
    categoryId: z.string({ error: "Selecione a categoria." }).min(1, "Selecione a categoria."),
    description: z
      .string()
      .trim()
      .min(1, "Informe a descrição.")
      .max(120, "Use no máximo 120 caracteres."),
    amountCents: z
      .number({ error: "Informe um valor válido." })
      .int("Informe um valor válido.")
      .min(1, "Informe um valor maior que zero."),
    dueDate: z.string().regex(DATE_RE, "Informe a data de vencimento."),
    paidNow: z.boolean(),
    method: z.string().optional(),
    repeatMonthly: z.boolean(),
    notes: z.string().max(500, "Use no máximo 500 caracteres.").optional(),
  })
  .superRefine((values, ctx) => {
    if (values.paidNow && !values.method) {
      ctx.addIssue({ code: "custom", path: ["method"], message: "Selecione a forma de pagamento." });
    }
    if (values.repeatMonthly && DATE_RE.test(values.dueDate) && Number(values.dueDate.slice(8, 10)) > 28) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Para repetir todo mês, escolha um vencimento entre os dias 1 e 28.",
      });
    }
  });
type EntryFormValues = z.infer<typeof schema>;

const TYPE_OPTIONS = [
  { value: "income", label: "Entrada", description: "Dinheiro que entra" },
  { value: "expense", label: "Saída", description: "Conta ou despesa" },
];

const METHOD_OPTIONS = PAYMENT_METHODS.map((m) => ({ value: m, label: paymentMethodLabel(m) }));

/** Pergunta o escopo da edicao de um lancamento de serie (promessa). */
function useScopeQuestion() {
  const [resolver, setResolver] = useState<((scope: FinancialEntryUpdateScope | null) => void) | null>(null);

  const ask = useCallback(
    () => new Promise<FinancialEntryUpdateScope | null>((resolve) => setResolver(() => resolve)),
    [],
  );
  const settle = (scope: FinancialEntryUpdateScope | null) => {
    resolver?.(scope);
    setResolver(null);
  };

  const dialog = (
    <AlertDialog open={resolver !== null} onOpenChange={(open) => (!open ? settle(null) : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Alterar lançamento que se repete</AlertDialogTitle>
          <AlertDialogDescription>
            Este lançamento faz parte de uma repetição mensal. &quot;Este e os próximos&quot; também atualiza a
            repetição e os lançamentos pendentes dos meses seguintes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <Button variant="outline" onClick={() => settle("single")}>
            Só este
          </Button>
          <Button onClick={() => settle("following")}>Este e os próximos</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, dialog };
}

function EntryForm({
  entry,
  defaultType,
  defaultDueDate,
  onSuccess,
}: {
  entry?: FinancialEntry;
  defaultType: FinancialEntryType;
  defaultDueDate: string;
  onSuccess: () => void;
}) {
  const isEdit = Boolean(entry);
  const createMut = useCreateFinanceEntry();
  const updateMut = useUpdateFinanceEntry();
  const pending = createMut.isPending || updateMut.isPending;
  const scopeQuestion = useScopeQuestion();
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: entry
      ? {
          type: entry.type,
          categoryId: entry.categoryId,
          description: entry.description,
          amountCents: entry.amountCents,
          dueDate: entry.dueDate,
          paidNow: false,
          method: undefined,
          repeatMonthly: false,
          notes: entry.notes ?? "",
        }
      : {
          type: defaultType,
          categoryId: "",
          description: "",
          amountCents: undefined as unknown as number,
          dueDate: defaultDueDate,
          paidNow: false,
          method: undefined,
          repeatMonthly: false,
          notes: "",
        },
  });

  const type = useWatch({ control: form.control, name: "type" });
  const paidNow = useWatch({ control: form.control, name: "paidNow" });
  const { data: categories, isPending: categoriesPending } = useFinancialCategories({
    type,
    status: "active",
    includeSystem: false,
  });

  // Trocar Entrada/Saida limpa a categoria (as opcoes sao filtradas pelo tipo).
  const lastType = useRef(type);
  useEffect(() => {
    if (lastType.current !== type) {
      lastType.current = type;
      form.setValue("categoryId", "", { shouldDirty: true });
    }
  }, [type, form]);

  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name }));
  if (entry && !categoryOptions.some((o) => o.value === entry.categoryId)) {
    // Categoria atual inativa: continua visivel na edicao.
    categoryOptions.unshift({ value: entry.categoryId, label: "Categoria atual (inativa)" });
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (entry) {
        const payload: UpdateFinancialEntry = {
          categoryId: values.categoryId,
          description: values.description,
          amountCents: values.amountCents,
          dueDate: values.dueDate,
          notes: values.notes ?? "",
        };
        let scope: FinancialEntryUpdateScope = "single";
        if (entry.recurrenceId) {
          const answer = await scopeQuestion.ask();
          if (!answer) return;
          scope = answer;
        }
        await updateMut.mutateAsync({ id: entry.id, payload, scope });
        toast.success(scope === "following" ? "Lançamento e próximos atualizados." : "Lançamento atualizado.");
      } else {
        await createMut.mutateAsync({
          type: values.type,
          categoryId: values.categoryId,
          description: values.description,
          amountCents: values.amountCents,
          dueDate: values.dueDate,
          ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
          ...(values.paidNow && values.method ? { paidNow: { method: values.method as PaymentMethod } } : {}),
          ...(values.repeatMonthly ? { repeatMonthly: true } : {}),
        });
        toast.success(
          values.repeatMonthly ? "Lançamento criado. Ele vai se repetir todo mês." : "Lançamento criado.",
        );
      }
      onSuccess();
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar o lançamento.");
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <SegmentedChoiceField<EntryFormValues>
              name="type"
              options={TYPE_OPTIONS}
              ariaLabel="Tipo do lançamento"
              disabled={pending || isEdit}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="categoryId">
                Categoria <span className="text-destructive">*</span>
              </Label>
              <button
                type="button"
                onClick={() => setCategoriesOpen(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Gerenciar categorias
              </button>
            </div>
            <SelectField<EntryFormValues>
              name="categoryId"
              placeholder={categoriesPending ? "Carregando..." : "Selecione a categoria"}
              options={categoryOptions}
              clearable={false}
              disabled={pending}
              hint={
                categoryOptions.length === 0 && !categoriesPending
                  ? "Nenhuma categoria ativa deste tipo. Clique em \"+ Gerenciar categorias\" acima para criar."
                  : undefined
              }
            />
          </div>

          <InputText<EntryFormValues>
            name="description"
            label="Descrição"
            placeholder="Informe a descrição do lançamento"
            required
            disabled={pending}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputCurrency<EntryFormValues> name="amountCents" label="Valor" required disabled={pending} />
            <DateField<EntryFormValues> name="dueDate" label="Vencimento" required disabled={pending} />
          </div>

          {!isEdit ? (
            <>
              <SwitchField<EntryFormValues>
                name="paidNow"
                label="Já foi pago"
                hint="Registra o pagamento agora, com a data de hoje."
                disabled={pending}
              />
              {paidNow ? (
                <SelectField<EntryFormValues>
                  name="method"
                  label="Forma de pagamento"
                  placeholder="Selecione a forma"
                  options={METHOD_OPTIONS}
                  clearable={false}
                  required
                  disabled={pending}
                />
              ) : null}
              <SwitchField<EntryFormValues>
                name="repeatMonthly"
                label="Repetir todo mês"
                hint="Para contas fixas (aluguel, internet). Cria o lançamento de cada mês no mesmo dia."
                disabled={pending}
              />
            </>
          ) : null}

          <TextArea<EntryFormValues>
            name="notes"
            label="Observações"
            placeholder="Informe observações adicionais (opcional)"
            rows={2}
            disabled={pending}
          />
        </DialogBody>
        <DialogFormFooter
          isPending={pending}
          isEdit={isEdit}
          createLabel="Lançar"
          editLabel="Salvar"
          className="shrink-0 border-t border-border/40 px-6 py-4"
        />
      </form>
      {scopeQuestion.dialog}
      <FinancialCategoryManagerDialog
        type={type}
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
      />
    </FormProvider>
  );
}

/** Novo lancamento / editar lancamento manual. */
export function FinanceEntryFormDialog({
  open,
  onOpenChange,
  entry,
  defaultType = "expense",
  competence,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: FinancialEntry;
  defaultType?: FinancialEntryType;
  /** Mes aberto na tela: o vencimento padrao cai nele. */
  competence: string;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const defaultDueDate = today.startsWith(competence) ? today : `${competence}-10`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-14">
          <DialogTitle>{entry ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            {entry
              ? "Altere os dados do lançamento. O tipo não muda depois de criado."
              : "Registre uma receita ou despesa que não vem das mensalidades."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <EntryForm
            key={entry?.id ?? "new"}
            entry={entry}
            defaultType={defaultType}
            defaultDueDate={defaultDueDate}
            onSuccess={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
