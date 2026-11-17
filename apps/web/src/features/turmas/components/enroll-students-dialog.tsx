"use client";

import { useAfterDialogClose } from "@/lib/use-dialog-presence";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "@/lib/toast";
import { ListPlus, UserPlus } from "lucide-react";
import {
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StudentMultiSelect, type StudentPickRow } from "@/components/shared/student-multi-select";
import { cn } from "@/lib/utils";
import { formatCents, plural } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { classBillingMode } from "@gestarahub/core/billing";
import { todayISO } from "@gestarahub/core/date";
import { pickPackageFor } from "@gestarahub/core/packages";
import type { ClassGroupView, ClientOption, EnrollmentCourseChoice, Id, StudentPackageView } from "@gestarahub/contracts";
import { useClientOptions } from "@/features/clients";
import { useAddToWaitlist, useEnroll } from "../hooks/use-turmas";
import { useCharges } from "../hooks/use-billing";
import { useStudentPackages } from "../hooks/use-packages";
import {
  applyCourseErrors,
  coursePaymentDefaults,
  CoursePaymentFields,
  readCourseChoice,
  useCoursePaymentForm,
} from "./course-payment-fields";


interface EnrollStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turma: ClassGroupView;
  enrolledIds: Set<Id>;
  waitlistedIds: Set<Id>;
  /** Chamado com quantos entraram, depois de pelo menos uma matricula. */
  onEnrolled?: (count: number) => void;
}

/**
 * Matricula em lote: busca por nome/telefone, selecao multipla e ciencia de
 * capacidade. Alunos ja matriculados / na espera aparecem DESABILITADOS com o
 * motivo (em vez de sumirem da busca) — some da lista faz o atendente achar que
 * o aluno nao existe e cadastrar duplicado.
 */
export function EnrollStudentsDialog({
  open,
  onOpenChange,
  turma,
  enrolledIds,
  waitlistedIds,
  onEnrolled,
}: EnrollStudentsDialogProps) {
  const { data: clients } = useClientOptions({ status: "active" });
  const enrollMut = useEnroll();
  const waitMut = useAddToWaitlist();
  // Curso: o pagamento escolhido vale para cada aluno selecionado.
  const isCourse = classBillingMode(turma) === "course";
  const courseForm = useCoursePaymentForm(turma);
  // Mensalidade: quem tem pacote da modalidade escolhe como paga esta turma.
  const isMembership = classBillingMode(turma) === "membership";
  const { data: activePackages } = useStudentPackages({ status: "active" }, open && isMembership);
  const packageStudentIds = useMemo(() => {
    const byStudent = new Map<Id, StudentPackageView[]>();
    for (const p of activePackages ?? []) {
      byStudent.set(p.studentId, [...(byStudent.get(p.studentId) ?? []), p]);
    }
    const today = todayISO();
    const ids = new Set<Id>();
    for (const [studentId, owned] of byStudent) {
      if (pickPackageFor(owned, { classGroupId: turma.id, modalityId: turma.modalityId, date: today })) {
        ids.add(studentId);
      }
    }
    return ids;
  }, [activePackages, turma.id, turma.modalityId]);
  // Rematricula: parcelas em aberto de matriculas anteriores neste curso.
  const { data: courseCharges } = useCharges({ kind: "course" }, open && isCourse);
  const [cancelPrevious, setCancelPrevious] = useState(true);
  const [paymentChoice, setPaymentChoice] = useState<Map<Id, boolean>>(new Map());
  // Padrao: com pacote e sem plano, paga com pacote; com plano, mensalidade.
  const paysWithPackageOf = (c: ClientOption) =>
    packageStudentIds.has(c.id) && (paymentChoice.get(c.id) ?? !c.planId);
  const [selected, setSelected] = useState<Set<Id>>(new Set());
  const [pending, setPending] = useState(false);
  const rows = useMemo<StudentPickRow[]>(
    () =>
      (clients ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        disabledReason: enrolledIds.has(c.id) ? "já matriculado" : waitlistedIds.has(c.id) ? "na lista de espera" : undefined,
      })),
    [clients, enrolledIds, waitlistedIds],
  );

  const selectedList = useMemo(
    () => (clients ?? []).filter((c) => selected.has(c.id)),
    [clients, selected],
  );

  const withPackage = isMembership ? selectedList.filter((c) => packageStudentIds.has(c.id)) : [];
  // Sem plano, sem pacote e sem bolsa: a matricula nao gera cobranca (so avisa).
  const withoutPayment = isMembership
    ? selectedList.filter((c) => !packageStudentIds.has(c.id) && !c.planId && !c.scholarship)
    : [];
  // Tem pacote, mas escolheu Mensalidade sem ter plano: tambem nao gera cobranca.
  const membershipWithoutPlan = withPackage.filter(
    (c) => !paysWithPackageOf(c) && !c.planId && !c.scholarship,
  );

  const previousDebts = isCourse
    ? selectedList.flatMap((c) => {
        const unpaid = (courseCharges ?? []).filter(
          (charge) =>
            charge.studentId === c.id &&
            charge.classGroupId === turma.id &&
            (charge.status === "pending" || charge.status === "overdue"),
        );
        const cents = unpaid.reduce((sum, charge) => sum + charge.amountCents, 0);
        return unpaid.length > 0 ? [{ name: c.name, cents }] : [];
      })
    : [];

  const remaining = Math.max(turma.availableSpots, 0);
  const isFull = remaining <= 0;
  const overCapacity = selected.size > remaining;

  const toggle = (id: Id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setSelected(new Set());
    setPaymentChoice(new Map());
    setCancelPrevious(true);
    courseForm.reset(coursePaymentDefaults(turma));
  };

  // Busca, selecao e parcelas voltam ao inicio depois da animacao de saida.
  useAfterDialogClose(open, reset);

  const close = () => onOpenChange(false);

  // Sequencial (nao Promise.all): cada matricula reavalia a capacidade no
  // "servidor", e o resumo precisa contar quantas de fato entraram.
  const submitEnroll = async () => {
    let course: EnrollmentCourseChoice | undefined;
    if (isCourse) {
      const choice = await readCourseChoice(courseForm);
      if (!choice) return;
      course = choice;
    }
    setPending(true);
    let ok = 0;
    let lastError: unknown = null;
    for (const student of selectedList) {
      try {
        await enrollMut.mutateAsync({
          payload: {
            classGroupId: turma.id,
            studentId: student.id,
            course,
            paysWithPackage: isMembership ? paysWithPackageOf(student) : undefined,
            cancelOpenCourseCharges: isCourse && previousDebts.length > 0 ? cancelPrevious : undefined,
          },
          allowOverCapacity: true,
        });
        ok += 1;
      } catch (error) {
        lastError = error;
      }
    }
    setPending(false);
    if (ok > 0) {
      toast.success(
        ok === 1 ? "Aluno matriculado." : `${ok} alunos matriculados.`,
      );
      close();
      onEnrolled?.(ok);
    }
    // Erro do pagamento do curso volta para o campo (nenhum entrou).
    if (lastError && !(ok === 0 && applyCourseErrors(courseForm, lastError))) {
      toast.error(getErrorMessage(lastError, "Não foi possível matricular."));
    }
  };

  const submitWaitlist = async () => {
    setPending(true);
    let ok = 0;
    let lastError: unknown = null;
    for (const student of selectedList) {
      try {
        await waitMut.mutateAsync({
          classGroupId: turma.id,
          studentId: student.id,
        });
        ok += 1;
      } catch (error) {
        lastError = error;
      }
    }
    setPending(false);
    if (ok > 0) {
      toast.success(
        ok === 1
          ? "Adicionado à lista de espera."
          : `${ok} alunos na lista de espera.`,
      );
      close();
    }
    // Como na matricula: quem nao entrou tambem avisa quando outros entraram.
    if (lastError) {
      toast.error(
        getErrorMessage(lastError, "Não foi possível adicionar à lista."),
      );
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">Matricular alunos</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {turma.name} ·{" "}
            {isFull
              ? "turma lotada"
              : `${remaining} ${remaining === 1 ? "vaga livre" : "vagas livres"}`}
          </SheetDescription>
        </SheetHeader>

        <DialogBody className="space-y-4">
        {isFull ? (
          <p className="rounded-md border border-dashed border-amber-300/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-500">
            A turma atingiu a capacidade ({plural(turma.capacity, "vaga", "vagas")}). Você pode pôr
            os selecionados na lista de espera ou matricular acima da
            capacidade.
          </p>
        ) : null}

        <StudentMultiSelect rows={rows} selected={selected} onToggle={toggle} disabled={pending} />

        {isCourse ? (
          <CoursePaymentFields
            form={courseForm}
            turma={turma}
            disabled={pending}
            appliesToMany={selected.size > 1}
          />
        ) : null}

        {previousDebts.length > 0 ? (
          <div className="space-y-2 rounded-md border border-amber-300/70 bg-amber-50/60 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
            <p className="text-sm text-amber-800 dark:text-amber-400">
              {previousDebts.length === 1
                ? `${previousDebts[0].name} tem ${formatCents(previousDebts[0].cents)} em aberto da matrícula anterior neste curso.`
                : `Em aberto de matrículas anteriores neste curso: ${previousDebts
                    .map((d) => `${d.name} (${formatCents(d.cents)})`)
                    .join(", ")}.`}
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={cancelPrevious}
                onCheckedChange={(checked) => setCancelPrevious(checked === true)}
                disabled={pending}
              />
              Cancelar as parcelas anteriores
            </label>
          </div>
        ) : null}

        {withPackage.length > 0 ? (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Como paga esta turma</p>
            {withPackage.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 break-words text-sm">{c.name}</span>
                <PaymentToggle
                  name={c.name}
                  withPackage={paysWithPackageOf(c)}
                  disabled={pending}
                  onChange={(next) =>
                    setPaymentChoice((prev) => new Map(prev).set(c.id, next))
                  }
                />
              </div>
            ))}
          </div>
        ) : null}

        {withoutPayment.length > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-500">
            {withoutPayment.length === 1
              ? `${withoutPayment[0].name} não tem plano nem pacote.`
              : `Sem plano nem pacote: ${withoutPayment.map((c) => c.name).join(", ")}.`}{" "}
            A matrícula não gera cobrança.
          </p>
        ) : null}

        {membershipWithoutPlan.length > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-500">
            {membershipWithoutPlan.length === 1
              ? `${membershipWithoutPlan[0].name} não tem plano.`
              : `Sem plano: ${membershipWithoutPlan.map((c) => c.name).join(", ")}.`}{" "}
            Com Mensalidade, não gera cobrança nem gasta o pacote.
          </p>
        ) : null}

        <Button asChild variant="ghost" className="-ml-2 self-start">
          <Link href="/clients">
            <UserPlus className="size-4" />
            Cadastrar novo aluno
          </Link>
        </Button>

        {overCapacity && !isFull ? (
          <p className="text-xs text-amber-700 dark:text-amber-500">
            Você selecionou {selected.size} para {remaining}{" "}
            {remaining === 1 ? "vaga" : "vagas"}. A turma vai passar da capacidade.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {isFull
              ? plural(selected.size, "selecionado", "selecionados")
              : `${selected.size} de ${remaining} ${remaining === 1 ? "vaga" : "vagas"}`}
          </p>
        )}

        </DialogBody>

        {/* Lotada: dois botoes de texto longo, empilhados no celular. */}
        <DialogFooter saving={pending} className={cn("p-6 pt-4 border-t border-border/40 shrink-0 bg-background", isFull && "max-sm:grid-cols-1")}>
          <Button variant="outline" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          {isFull ? (
            <Button
              variant="outline"
              disabled={selected.size === 0 || pending}
              onClick={submitWaitlist}
            >
              <ListPlus className="size-4" />
              Pôr na lista de espera
            </Button>
          ) : null}
          <Button
            disabled={selected.size === 0 || pending}
            onClick={submitEnroll}
          >
            {pending
              ? "Matriculando..."
              : selected.size === 0
                ? "Matricular"
                : isFull || overCapacity
                  ? `Matricular mesmo assim (${selected.size})`
                  : selected.size === 1
                    ? "Matricular 1 aluno"
                    : `Matricular ${selected.size} alunos`}
          </Button>
        </DialogFooter>
      </SheetContent>
    </Sheet>
  );
}


/** Mensalidade ou Pacote, por aluno (so quem tem pacote da modalidade). */
function PaymentToggle({
  name,
  withPackage,
  disabled,
  onChange,
}: {
  name: string;
  withPackage: boolean;
  disabled?: boolean;
  onChange: (withPackage: boolean) => void;
}) {
  const option = (label: string, value: boolean) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(value)}
      aria-pressed={withPackage === value}
      className={cn(
        "inline-flex h-full items-center rounded-xs px-2.5 text-xs font-medium transition-colors",
        withPackage === value
          ? "bg-muted text-foreground shadow-2xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <div
      role="group"
      aria-label={`Como ${name} paga`}
      className="inline-flex h-8 shrink-0 items-center rounded-md border border-input bg-background p-0.5 shadow-2xs"
    >
      {option("Mensalidade", false)}
      {option("Pacote", true)}
    </div>
  );
}
