"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useRetainedValue } from "@/lib/use-retained-value";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { todayISO } from "@gestarahub/core/date";
import { formatCents, plural } from "@gestarahub/core/format";
import type { Client } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useCharges } from "@/features/turmas";
import { useInactivateClient } from "../hooks/use-clients";

interface InactivateClientDialogProps {
  client: Client | null;
  onOpenChange: (open: boolean) => void;
}

type OpenChargesChoice = "keep" | "cancel";

const CHOICES: { value: OpenChargesChoice; title: string; desc: string }[] = [
  {
    value: "keep",
    title: "Manter para receber",
    desc: "Continuam em Mensalidades como pendentes ou atrasadas.",
  },
  {
    value: "cancel",
    title: "Cancelar a cobrança",
    desc: "Não serão cobradas. Ficam em Canceladas e podem ser reabertas.",
  },
];

export function InactivateClientDialog({
  client,
  onOpenChange,
}: InactivateClientDialogProps) {
  // Conteudo com o ultimo registro: nao some durante a animacao de saida.
  const shown = useRetainedValue(client);
  const isClasses = useModel() === "classes";
  const inactivateMut = useInactivateClient();
  const [choice, setChoice] = useState<OpenChargesChoice>("keep");

  // Mensalidades em aberto de periodos ja iniciados: as futuras saem sempre;
  // estas o usuario decide se continua cobrando.
  const { data: charges } = useCharges(
    isClasses && shown ? { studentId: shown.id, kind: "membership" } : { studentId: "" },
  );
  const today = todayISO();
  const openCharges = (charges ?? []).filter(
    (c) =>
      c.studentId === shown?.id &&
      (c.status === "pending" || c.status === "overdue") &&
      (c.periodStart ?? c.dueDate) <= today,
  );
  const openTotal = openCharges.reduce((sum, c) => sum + c.amountCents, 0);

  async function handleConfirm() {
    if (!client) return;
    try {
      await inactivateMut.mutateAsync({
        id: client.id,
        cancelOpenCharges: openCharges.length > 0 && choice === "cancel",
      });
      toast.success(isClasses ? "Aluno inativado." : "Cliente inativado.");
      onOpenChange(false);
      setChoice("keep");
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          isClasses
            ? "Não foi possível inativar o aluno."
            : "Não foi possível inativar o cliente.",
        ),
      );
    }
  }

  return (
    <ConfirmActionDialog
      open={client !== null}
      onOpenChange={(open) => {
        if (!open) {
          onOpenChange(false);
          setChoice("keep");
        }
      }}
      title={isClasses ? "Inativar aluno?" : "Inativar cliente?"}
      description={
        shown ? (
          <>
            “{shown.name}” deixará de ser sugerido em{" "}
            {isClasses ? "novas matrículas" : "novos agendamentos"}. O histórico
            é mantido e você pode reativá-lo depois.
            {isClasses && shown.planId ? (
              <> Mensalidades de períodos que ainda não começaram serão canceladas.</>
            ) : null}
          </>
        ) : null
      }
      cancelLabel="Voltar"
      confirmLabel="Inativar"
      isPending={inactivateMut.isPending}
      onConfirm={handleConfirm}
    >
      {openCharges.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {plural(openCharges.length, "mensalidade em aberto", "mensalidades em aberto")} ·{" "}
            {formatCents(openTotal)}. O que fazer com {openCharges.length === 1 ? "ela" : "elas"}?
          </p>
          <div role="radiogroup" aria-label="Mensalidades em aberto" className="grid gap-2">
            {CHOICES.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={choice === o.value}
                onClick={() => setChoice(o.value)}
                disabled={inactivateMut.isPending}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  choice === o.value
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:bg-accent/50",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    choice === o.value ? "border-primary" : "border-muted-foreground/40",
                  )}
                >
                  {choice === o.value ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">{o.title}</span>
                  <span className="block text-xs text-muted-foreground">{o.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </ConfirmActionDialog>
  );
}
