"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, Check, ChevronDown, ListPlus, Search, UserPlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeText } from "@/lib/text";
import { formatPhone, plural } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { classBillingMode } from "@gestarahub/core/billing";
import { todayISO } from "@gestarahub/core/date";
import { pickPackageFor } from "@gestarahub/core/packages";
import type { ClassGroupView, Client, EnrollmentCourseChoice, Id, StudentPackageView } from "@gestarahub/contracts";
import { useClients } from "@/features/clients";
import { useAddToWaitlist, useEnroll } from "../hooks/use-turmas";
import { useStudentPackages } from "../hooks/use-packages";
import {
  applyCourseErrors,
  coursePaymentDefaults,
  CoursePaymentFields,
  readCourseChoice,
  useCoursePaymentForm,
} from "./course-payment-fields";

/** Teto de linhas renderizadas: com base grande, a busca e que filtra. */
const MAX_ROWS = 50;

type RowState = "available" | "enrolled" | "waitlisted";

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
  const { data: clients } = useClients({ status: "active" });
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
      if (pickPackageFor(owned, { modalityId: turma.modalityId, date: today })) ids.add(studentId);
    }
    return ids;
  }, [activePackages, turma.modalityId]);
  const [paymentChoice, setPaymentChoice] = useState<Map<Id, boolean>>(new Map());
  // Padrao: com pacote e sem plano, paga com pacote; com plano, mensalidade.
  const paysWithPackageOf = (c: Client) =>
    packageStudentIds.has(c.id) && (paymentChoice.get(c.id) ?? !c.planId);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<Id>>(new Set());
  const [pending, setPending] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [listContainer, setListContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    if (!listContainer) return;
    setCanScrollUp(listContainer.scrollTop > 6);
    setCanScrollDown(
      listContainer.scrollHeight -
        listContainer.scrollTop -
        listContainer.clientHeight >
        6,
    );
  }, [listContainer]);

  const rows = useMemo(() => {
    const term = normalizeText(search);
    // So compara telefone quando o termo TEM digitos: `includes("")` e sempre
    // verdadeiro e faria a busca por nome casar com a base inteira.
    const digits = term.replace(/\D/g, "");
    return (clients ?? [])
      .filter((c) => {
        if (!term) return true;
        if (normalizeText(c.name).includes(term)) return true;
        return (
          digits.length > 0 && (c.phone ?? "").replace(/\D/g, "").includes(digits)
        );
      })
      .map((c) => ({
        client: c,
        state: (enrolledIds.has(c.id)
          ? "enrolled"
          : waitlistedIds.has(c.id)
            ? "waitlisted"
            : "available") as RowState,
      }));
  }, [clients, search, enrolledIds, waitlistedIds]);

  const shown = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - shown.length;

  useEffect(() => {
    if (!listContainer) return;

    const resizeObserver = new ResizeObserver(() => checkScroll());
    resizeObserver.observe(listContainer);
    for (const child of Array.from(listContainer.children)) {
      resizeObserver.observe(child);
    }

    const mutationObserver = new MutationObserver(() => checkScroll());
    mutationObserver.observe(listContainer, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const rafId = requestAnimationFrame(() => checkScroll());
    const timer1 = setTimeout(() => checkScroll(), 60);
    const timer2 = setTimeout(() => checkScroll(), 220);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [listContainer, shown.length, checkScroll]);

  const scrollToMore = () => {
    listContainer?.scrollBy({ top: 180, behavior: "smooth" });
  };

  const selectedList = useMemo(
    () => (clients ?? []).filter((c) => selected.has(c.id)),
    [clients, selected],
  );

  const withPackage = isMembership ? selectedList.filter((c) => packageStudentIds.has(c.id)) : [];
  // Sem plano, sem pacote e sem bolsa: a matricula nao gera cobranca (so avisa).
  const withoutPayment = isMembership
    ? selectedList.filter((c) => !packageStudentIds.has(c.id) && !c.planId && !c.discount?.scholarship)
    : [];
  // Tem pacote, mas escolheu Mensalidade sem ter plano: tambem nao gera cobranca.
  const membershipWithoutPlan = withPackage.filter(
    (c) => !paysWithPackageOf(c) && !c.planId && !c.discount?.scholarship,
  );

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
    // Volta para a busca so com teclado fisico: no toque abriria o teclado.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });
  };

  const reset = () => {
    setSearch("");
    setSelected(new Set());
    setPaymentChoice(new Map());
    courseForm.reset(coursePaymentDefaults(turma));
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
        expandable
        storageKey="enroll-students"
      >
        <DialogHeader className="pr-14">
          <DialogTitle>Matricular alunos</DialogTitle>
          <DialogDescription>
            {turma.name} ·{" "}
            {isFull
              ? "turma lotada"
              : `${remaining} ${remaining === 1 ? "vaga livre" : "vagas livres"}`}
          </DialogDescription>
        </DialogHeader>

        {isFull ? (
          <p className="rounded-md border border-dashed border-amber-300/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-500">
            A turma atingiu a capacidade ({turma.capacity} vagas). Você pode pôr
            os selecionados na lista de espera ou matricular acima da
            capacidade.
          </p>
        ) : null}

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && search.trim()) {
                const availableMatches = shown.filter(
                  (r) => r.state === "available" && !selected.has(r.client.id),
                );
                if (availableMatches.length === 1) {
                  event.preventDefault();
                  toggle(availableMatches[0].client.id);
                }
              }
            }}
            placeholder="Buscar por nome ou telefone..."
            className="px-8"
            autoComplete="off"
            aria-label="Buscar aluno"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                searchInputRef.current?.focus();
              }}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {selectedList.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedList.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-foreground hover:bg-accent"
              >
                {c.name}
                <X className="size-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-md border">
          {/* Sombra superior quando houver itens rolados para cima */}
          <div
            className={cn(
              "pointer-events-none absolute top-0 right-0 left-0 z-10 h-4 bg-gradient-to-b from-black/10 to-transparent transition-opacity duration-200 dark:from-black/40",
              canScrollUp ? "opacity-100" : "opacity-0",
            )}
          />

          <div
            ref={setListContainer}
            onScroll={checkScroll}
            role="listbox"
            aria-multiselectable
            aria-label="Alunos"
            className="max-h-72 space-y-0.5 overflow-y-auto p-1"
          >
            {shown.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nenhum aluno encontrado{search ? ` para "${search}"` : ""}.
              </p>
            ) : (
              shown.map(({ client, state }) => {
                const disabled = state !== "available";
                const checked = selected.has(client.id);
                return (
                  <button
                    key={client.id}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    disabled={disabled}
                    onClick={() => toggle(client.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                      disabled
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-accent",
                    )}
                  >
                    {disabled ? (
                      <Ban className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      // Caixa decorativa: a propria linha e o alvo clicavel, entao
                      // um <Checkbox> aqui seria um <button> dentro de <button>.
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input",
                        )}
                      >
                        {checked ? <Check className="size-3" /> : null}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{client.name}</p>
                      {client.phone ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {formatPhone(client.phone)}
                        </p>
                      ) : null}
                    </div>
                    {disabled ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {state === "enrolled"
                          ? "já matriculado"
                          : "na lista de espera"}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
            {hidden > 0 ? (
              <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                +{hidden} não exibidos — refine a busca.
              </p>
            ) : null}
          </div>

          {/* Gradiente inferior quando houver mais alunos abaixo */}
          <div
            className={cn(
              "pointer-events-none absolute right-0 bottom-0 left-0 z-10 h-8 bg-gradient-to-t from-background/95 via-background/50 to-transparent transition-opacity duration-200",
              canScrollDown ? "opacity-100" : "opacity-0",
            )}
          />

          {/* Pill flutuante indicativo de rolagem */}
          <div
            className={cn(
              "pointer-events-auto absolute bottom-2 left-1/2 z-20 -translate-x-1/2 transition-all duration-300",
              canScrollDown
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-2 opacity-0",
            )}
          >
            <button
              type="button"
              onClick={scrollToMore}
              aria-label="Rolar para ver mais alunos"
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 py-1 text-xs font-medium text-muted-foreground shadow-md backdrop-blur-xs transition-all select-none hover:border-border hover:bg-accent hover:text-foreground active:scale-95"
              title="Clique para rolar e ver mais alunos"
            >
              <span>Mais alunos abaixo</span>
              <ChevronDown className="size-3.5 animate-bounce text-primary" />
            </button>
          </div>
        </div>

        {isCourse ? (
          <CoursePaymentFields
            form={courseForm}
            turma={turma}
            disabled={pending}
            appliesToMany={selected.size > 1}
          />
        ) : null}

        {withPackage.length > 0 ? (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Como paga esta turma</p>
            {withPackage.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm">{c.name}</span>
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
            {remaining === 1 ? "vaga" : "vagas"} — a turma vai ficar acima da
            capacidade.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {isFull
              ? plural(selected.size, "selecionado", "selecionados")
              : `${selected.size} de ${remaining} ${remaining === 1 ? "vaga" : "vagas"}`}
          </p>
        )}

        <DialogFooter>
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
      </DialogContent>
    </Dialog>
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
