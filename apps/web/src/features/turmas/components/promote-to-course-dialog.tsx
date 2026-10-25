"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import type { ClassGroupView, WaitlistEntryView } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
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
import { usePromoteWaitlist } from "../hooks/use-turmas";
import {
  applyCourseErrors,
  coursePaymentDefaults,
  CoursePaymentFields,
  readCourseChoice,
  useCoursePaymentForm,
} from "./course-payment-fields";

/**
 * Promover da lista de espera para um curso: pede o pagamento (valor, parcelas
 * e 1o vencimento), como a matricula. Abre em drawer; o proprio drawer e a confirmacao.
 */
export function PromoteToCourseDialog({
  turma,
  entry,
  onOpenChange,
}: {
  turma: ClassGroupView;
  entry: WaitlistEntryView | null;
  onOpenChange: (open: boolean) => void;
}) {
  const promoteMut = usePromoteWaitlist();
  const form = useCoursePaymentForm(turma);
  // Retem o aluno durante a animacao de saida.
  const [shown, setShown] = useState(entry);
  if (entry && entry !== shown) setShown(entry);

  const close = () => {
    onOpenChange(false);
    form.reset(coursePaymentDefaults(turma));
  };

  const submit = async () => {
    if (!entry || promoteMut.isPending) return;
    const course = await readCourseChoice(form);
    if (!course) return;
    try {
      await promoteMut.mutateAsync({ id: entry.id, course });
      toast.success("Aluno matriculado no curso.");
      close();
    } catch (error) {
      if (!applyCourseErrors(form, error)) {
        toast.error(getErrorMessage(error, "Não foi possível promover o aluno."));
      }
    }
  };

  return (
    <Sheet open={entry !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}>
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">Matricular da lista de espera</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {shown?.studentName} entra no curso {turma.name}, mesmo que ele esteja lotado.
          </SheetDescription>
        </SheetHeader>
        <DialogBody className="space-y-4">
          <CoursePaymentFields form={form} turma={turma} disabled={promoteMut.isPending} />
        </DialogBody>
        <DialogFooter className="shrink-0 border-t border-border/40 bg-background p-6 pt-4">
          <Button type="button" variant="outline" disabled={promoteMut.isPending} onClick={close}>
            Cancelar
          </Button>
          <Button type="button" disabled={promoteMut.isPending} onClick={() => void submit()}>
            {promoteMut.isPending ? "Salvando..." : "Matricular"}
          </Button>
        </DialogFooter>
      </SheetContent>
    </Sheet>
  );
}
