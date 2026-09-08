"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, Check, ListPlus, Search, UserPlus, X } from "lucide-react";
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
import { formatPhone } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { ClassGroupView, Id } from "@gestarahub/contracts";
import { useClients } from "@/features/clients";
import { useAddToWaitlist, useEnroll } from "../hooks/use-turmas";

/** Teto de linhas renderizadas: com base grande, a busca e que filtra. */
const MAX_ROWS = 50;

type RowState = "available" | "enrolled" | "waitlisted";

interface EnrollStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turma: ClassGroupView;
  enrolledIds: Set<Id>;
  waitlistedIds: Set<Id>;
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
}: EnrollStudentsDialogProps) {
  const { data: clients } = useClients({ status: "active" });
  const enrollMut = useEnroll();
  const waitMut = useAddToWaitlist();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<Id>>(new Set());
  const [pending, setPending] = useState(false);

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

  const selectedList = useMemo(
    () => (clients ?? []).filter((c) => selected.has(c.id)),
    [clients, selected],
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
  };

  const reset = () => {
    setSearch("");
    setSelected(new Set());
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  // Sequencial (nao Promise.all): cada matricula reavalia a capacidade no
  // "servidor", e o resumo precisa contar quantas de fato entraram.
  const submitEnroll = async () => {
    setPending(true);
    let ok = 0;
    let lastError: unknown = null;
    for (const student of selectedList) {
      try {
        await enrollMut.mutateAsync({
          payload: { classGroupId: turma.id, studentId: student.id },
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
    }
    if (lastError && ok === 0) {
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
    if (lastError && ok === 0) {
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
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
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="px-8"
            autoComplete="off"
            aria-label="Buscar aluno"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
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

        <div
          role="listbox"
          aria-multiselectable
          aria-label="Alunos"
          className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border p-1"
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

        <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
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
              ? `${selected.size} selecionado(s)`
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
