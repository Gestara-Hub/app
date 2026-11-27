"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type {
  CancelEnrollmentChargeItem,
  CancelEnrollmentChoices,
  CancelEnrollmentPreview,
  ChargeView,
  EnrollmentView,
  Id,
} from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { cancelEnrollmentQuestions } from "@gestarahub/core/billing";
import { formatCents, plural, pluralWord } from "@gestarahub/core/format";
import { SegmentedChoiceField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody, useReportDialogSaving } from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCan } from "@/features/auth";
import { toast } from "@/lib/toast";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useRetainedValue } from "@/lib/use-retained-value";
import { useCharges } from "../hooks/use-billing";
import { useCancelEnrollment, useCancelEnrollmentPreview } from "../hooks/use-turmas";
import { RefundChargeDialog } from "./refund-charge-dialog";

/**
 * Cancelar matricula com o dinheiro (27/11/2026, doc product/11 "Cancelar
 * matrícula: plano e cobranças"). Quem cuida das cobranças responde, sem nada
 * marcado: o plano (aluno sem outra turma), as cobrancas futuras e as vencidas
 * e o que ja foi pago (manter ou estornar; o estorno abre depois, um por vez).
 * Quem nao cuida das cobranças ve o aviso de sempre e o dinheiro nao muda.
 */

/** Pagamento a estornar depois do cancelamento (a tela abre a janela de estorno). */
export interface RefundTarget {
  chargeId: Id;
  studentId: Id;
}

const PLAN_OPTIONS = [
  { value: "end", label: "Encerrar o plano", description: "Para de gerar mensalidades." },
  { value: "keep", label: "Manter o plano", description: "Continua cobrando, mesmo sem turma." },
];
const FUTURE_OPTIONS = [
  { value: "cancel", label: "Cancelar", description: "Saem das cobranças." },
  { value: "keep", label: "Manter", description: "O aluno continua devendo." },
];
const OVERDUE_OPTIONS = [
  { value: "cancel", label: "Cancelar", description: "O aluno não deve mais." },
  { value: "keep", label: "Manter como dívida", description: "O aluno continua devendo." },
];
const PAID_OPTIONS = [
  { value: "keep", label: "Manter, sem estorno", description: "O pagamento fica como está." },
  { value: "refund", label: "Estornar", description: "Abre o estorno de cada pagamento." },
];

const schema = z.object({
  plan: z.enum(["end", "keep"]).optional(),
  futureCharges: z.enum(["cancel", "keep"]).optional(),
  overdueCharges: z.enum(["cancel", "keep"]).optional(),
  paid: z.enum(["keep", "refund"]).optional(),
});
type FormValues = z.infer<typeof schema>;

/** Texto de sempre (sem as perguntas): no curso, explica as parcelas (decisao 1). */
export function cancelEnrollmentText(e: EnrollmentView): string {
  if (!e.course) {
    return `${e.studentName} sai da turma e deixa de aparecer na lista de chamada. As cobranças do aluno não mudam.`;
  }
  if (e.isCompleted) {
    return `${e.studentName} sai da turma. O curso já terminou: as parcelas continuam como estão.`;
  }
  const future = e.courseInstallments?.future ?? 0;
  const due = e.courseInstallments?.due ?? 0;
  return [
    `${e.studentName} sai do curso.`,
    "As parcelas pagas ficam.",
    future === 0
      ? "Não há parcelas futuras para cancelar."
      : future === 1
        ? "A parcela futura será cancelada."
        : `As ${future} parcelas futuras serão canceladas.`,
    // "Vencida" errava para a que vence hoje.
    due > 0
      ? due === 1
        ? "A parcela que vence até hoje continua para receber."
        : `As ${due} parcelas que vencem até hoje continuam para receber.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

interface Listed extends CancelEnrollmentChargeItem {
  studentId: Id;
  studentName: string;
}

/** Cobrancas de cada aluno numa pergunta (o plano so entra encerrado). */
function collect(
  previews: CancelEnrollmentPreview[],
  plan: CancelEnrollmentChoices["plan"],
  bucket: "future" | "overdue" | "paid",
): Listed[] {
  return previews.flatMap((p) => {
    const items = [...p.course[bucket], ...(p.plan && plan === "end" ? p.membership[bucket] : [])];
    return items.map((item) => ({ ...item, studentId: p.studentId, studentName: p.studentName }));
  });
}

function ChargeList({ items, showName, extra }: { items: Listed[]; showName: boolean; extra?: string }) {
  return (
    <ul className="space-y-1 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
      {items.map((item) => (
        <li key={item.chargeId} className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="min-w-0 break-words text-foreground">
            {showName ? `${item.studentName}: ` : ""}
            {item.label}
            <span className="text-muted-foreground"> · vence {ddmm(item.dueDate)}</span>
          </span>
          <span className="shrink-0 tabular-nums text-foreground">{formatCents(item.amountCents)}</span>
        </li>
      ))}
      {extra ? <li className="text-muted-foreground">{extra}</li> : null}
    </ul>
  );
}

interface FormProps {
  rows: EnrollmentView[];
  className: string;
  onClose: () => void;
  onDone: (result: { done: Id[]; refunds: RefundTarget[] }) => void;
}

function CancelEnrollmentForm({ rows, className, onClose, onDone }: FormProps) {
  const can = useCan();
  const manageMoney = can("billing:manage");
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const preview = useCancelEnrollmentPreview(ids, manageMoney);
  const previews = useMemo(() => preview.data ?? [], [preview.data]);
  const cancelMut = useCancelEnrollment();
  const [running, setRunning] = useState(false);
  const isPending = running || cancelMut.isPending;
  useReportDialogSaving(isPending);

  const single = rows.length === 1;
  const showName = !single;

  // A validacao olha a previa carregada: so a pergunta feita e obrigatoria.
  const previewsRef = useRef(previews);
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);
  const resolver: Resolver<FormValues> = (values, context, options) =>
    zodResolver(
      schema.superRefine((v, ctx) => {
        const list = previewsRef.current;
        const asked = list.map((p) => cancelEnrollmentQuestions(p, v.plan));
        if (asked.some((a) => a.plan) && !v.plan) {
          ctx.addIssue({ code: "custom", path: ["plan"], message: "Escolha o que fazer com o plano." });
        }
        if (asked.some((a) => a.future) && !v.futureCharges) {
          ctx.addIssue({ code: "custom", path: ["futureCharges"], message: "Escolha o que fazer com as cobranças futuras." });
        }
        if (asked.some((a) => a.overdue) && !v.overdueCharges) {
          ctx.addIssue({ code: "custom", path: ["overdueCharges"], message: "Escolha o que fazer com as cobranças vencidas." });
        }
        if (collect(list, v.plan, "paid").length > 0 && !v.paid) {
          ctx.addIssue({ code: "custom", path: ["paid"], message: "Escolha o que fazer com o que já foi pago." });
        }
      }),
    )(values, context, options);
  const form = useForm<FormValues>({ resolver, defaultValues: {} });
  const plan = useWatch({ control: form.control, name: "plan" });

  const withPlan = previews.filter((p) => p.plan);
  const future = collect(previews, plan, "future");
  const overdue = collect(previews, plan, "overdue");
  const paid = collect(previews, plan, "paid");
  const usedPeriodPending = plan === "end" && withPlan.some((p) => p.plan?.chargesUsedPeriod);
  const asksOverdue = overdue.length > 0 || usedPeriodPending;
  const asksSomething = withPlan.length > 0 || future.length > 0 || asksOverdue || paid.length > 0;
  const loading = manageMoney && preview.isPending;
  const continuing = previews.filter((p) => !p.plan && p.otherClassNames.length > 0);

  const submit = form.handleSubmit(async (values) => {
    const choices: CancelEnrollmentChoices | undefined = manageMoney
      ? { plan: values.plan, futureCharges: values.futureCharges, overdueCharges: values.overdueCharges }
      : undefined;
    setRunning(true);
    const done: Id[] = [];
    let lastError: unknown;
    for (const row of rows) {
      try {
        await cancelMut.mutateAsync({ id: row.id, choices });
        done.push(row.id);
      } catch (err) {
        // Um aluno com erro nao para o lote; o resumo conta o que passou.
        lastError = err;
      }
    }
    setRunning(false);
    const refunds: RefundTarget[] =
      values.paid === "refund"
        ? paid.filter((p) => done.some((id) => previews.find((x) => x.enrollmentId === id)?.studentId === p.studentId))
            .map((p) => ({ chargeId: p.chargeId, studentId: p.studentId }))
        : [];
    if (done.length > 0) {
      const what = single ? "Matrícula cancelada." : `${plural(done.length, "matrícula cancelada", "matrículas canceladas")}.`;
      toast.success(refunds.length > 0 ? `${what} Agora, o estorno.` : what);
    }
    const failed = rows.length - done.length;
    if (failed > 0) {
      toast.error(
        single
          ? getErrorMessage(lastError, "Não foi possível cancelar a matrícula.")
          : `${plural(failed, "matrícula não foi cancelada", "matrículas não foram canceladas")}. ${getErrorMessage(lastError, "Tente novamente.")}`,
      );
    }
    if (done.length > 0) onDone({ done, refunds });
    if (failed === 0) onClose();
  });

  // O nome fica so no cabecalho (27/11/2026: repetia em cada frase).
  const intro = single ? "Sai da turma e da chamada." : "Saem da turma e da chamada.";

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
        <SheetTitle className="text-lg font-semibold text-foreground">
          {single ? "Cancelar matrícula" : `Cancelar ${plural(rows.length, "matrícula", "matrículas")}`}
        </SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground">
          {single ? `${rows[0].studentName} · ${className}` : className}
        </SheetDescription>
      </SheetHeader>

      <FormProvider {...form}>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogBody className="space-y-5">
            {!single ? (
              <p className="min-w-0 break-words rounded-lg border bg-muted/40 px-3 py-2 text-sm text-foreground">
                {rows.map((r) => r.studentName).join(", ")}
              </p>
            ) : null}

            {!manageMoney ? (
              <p className="text-sm text-muted-foreground">
                {single
                  ? cancelEnrollmentText(rows[0])
                  : "Os alunos saem da turma e deixam de contar nas vagas. O histórico de presença é mantido. As cobranças não mudam."}
              </p>
            ) : loading ? (
              <p className="text-sm text-muted-foreground" role="status">
                Conferindo as cobranças...
              </p>
            ) : preview.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {getErrorMessage(preview.error, "Não foi possível conferir as cobranças.")}
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {intro} O histórico de presença fica.
                  {asksSomething || continuing.length > 0 ? "" : " Nada muda nas cobranças."}
                </p>

                {continuing.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {single
                      ? `${asksSomething ? "O plano" : "Nada muda nas cobranças: o plano"} continua pela${
                          continuing[0].otherClassNames.length > 1 ? "s turmas" : " turma"
                        } ${continuing[0].otherClassNames.join(", ")}.`
                      : `O plano de quem segue em outra turma continua (${continuing.map((p) => p.studentName).join(", ")}).`}
                  </p>
                ) : null}

                {withPlan.length > 0 ? (
                  <div className="space-y-2">
                    <SegmentedChoiceField<FormValues>
                      name="plan"
                      label={
                        single
                          ? `E o plano ${withPlan[0].plan?.planName}?`
                          : `E o plano de quem não fica em outra turma (${withPlan.map((p) => p.studentName).join(", ")})?`
                      }
                      required
                      allowEmpty
                      options={PLAN_OPTIONS}
                      ariaLabel="O que fazer com o plano"
                      variant="cards"
                      disabled={isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      {single
                        ? "Não fica em nenhuma outra turma."
                        : "Esses alunos não ficam em nenhuma outra turma."}
                    </p>
                  </div>
                ) : null}

                {future.length > 0 ? (
                  <div className="space-y-2">
                    <ChargeList items={future} showName={showName} />
                    <SegmentedChoiceField<FormValues>
                      name="futureCharges"
                      label={`${plural(future.length, "cobrança futura", "cobranças futuras")}: o que fazer?`}
                      required
                      allowEmpty
                      options={FUTURE_OPTIONS}
                      ariaLabel="O que fazer com as cobranças futuras"
                      variant="cards"
                      disabled={isPending}
                    />
                  </div>
                ) : null}

                {asksOverdue ? (
                  <div className="space-y-2">
                    <ChargeList
                      items={overdue}
                      showName={showName}
                      extra={usedPeriodPending ? "+ a mensalidade do período em uso, gerada agora (pagamento depois do uso)." : undefined}
                    />
                    <SegmentedChoiceField<FormValues>
                      name="overdueCharges"
                      label={
                        overdue.length > 0
                          ? `${plural(overdue.length, "cobrança vencida ou em uso", "cobranças vencidas ou em uso")}: o que fazer?`
                          : "Mensalidade do período em uso: o que fazer?"
                      }
                      required
                      allowEmpty
                      options={OVERDUE_OPTIONS}
                      ariaLabel="O que fazer com as cobranças vencidas"
                      variant="cards"
                      disabled={isPending}
                    />
                  </div>
                ) : null}

                {paid.length > 0 ? (
                  <div className="space-y-2">
                    <ChargeList items={paid} showName={showName} />
                    <SegmentedChoiceField<FormValues>
                      name="paid"
                      label={`Já ${pluralWord(paid.length, "pago", "pagos")}: ${formatCents(paid.reduce((s, p) => s + p.amountCents, 0))}`}
                      required
                      allowEmpty
                      options={PAID_OPTIONS}
                      ariaLabel="O que fazer com o que já foi pago"
                      variant="cards"
                      disabled={isPending}
                    />
                  </div>
                ) : null}
              </>
            )}
          </DialogBody>

          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border/40 bg-background p-6 pt-4 sm:flex sm:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Voltar
              </Button>
            </SheetClose>
            <Button type="submit" variant="destructive" disabled={isPending || loading || preview.isError}>
              {isPending ? "Cancelando..." : single ? "Cancelar matrícula" : `Cancelar ${pluralWord(rows.length, "matrícula", "matrículas")}`}
            </Button>
          </div>
        </form>
      </FormProvider>
    </>
  );
}

interface CancelEnrollmentDrawerProps {
  /** Matriculas a cancelar; vazio fecha. */
  rows: EnrollmentView[];
  className: string;
  onOpenChange: (open: boolean) => void;
  onDone: (result: { done: Id[]; refunds: RefundTarget[] }) => void;
}

export function CancelEnrollmentDrawer({ rows, className, onOpenChange, onDone }: CancelEnrollmentDrawerProps) {
  const open = rows.length > 0;
  const present = useDialogPresence(open);
  // Fechando, a lista some antes da animacao: guarda a ultima para o conteudo nao piscar.
  const shown = useRetainedValue(open ? rows : null) ?? [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {present && shown.length > 0 ? (
          <CancelEnrollmentForm
            key={shown.map((r) => r.id).join(",")}
            rows={shown}
            className={className}
            onClose={() => onOpenChange(false)}
            onDone={onDone}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Estornos escolhidos no cancelamento: abre a janela de estorno da fase 1 para
 * cada pagamento, um por vez (saldo, custo do Pix e "E a cobrança?" ficam la).
 */
export function RefundQueue({ queue, onDone }: { queue: RefundTarget[]; onDone: (chargeId: Id) => void }) {
  const current = queue[0];
  const { data: charges } = useCharges(current ? { studentId: current.studentId } : undefined, Boolean(current));
  // A cobranca entra na janela ainda paga e fica nela ate fechar (o estorno muda a situacao no meio).
  const [held, setHeld] = useState<ChargeView | null>(null);
  const paidNow = current ? (charges ?? []).find((c) => c.id === current.chargeId && c.status === "paid") : undefined;
  if (paidNow && held?.id !== paidNow.id) setHeld(paidNow);
  const charge = current && held?.id === current.chargeId ? held : null;
  // Ja nao estava paga ao chegar a vez dela (estornada no parceiro ou desfeita): segue.
  useEffect(() => {
    if (!current || !charges || held?.id === current.chargeId) return;
    if (!charges.some((c) => c.id === current.chargeId && c.status === "paid")) onDone(current.chargeId);
  }, [current, charges, held, onDone]);
  return (
    <RefundChargeDialog
      charge={charge}
      onOpenChange={(open) => {
        if (!open && current) onDone(current.chargeId);
      }}
    />
  );
}
