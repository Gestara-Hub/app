"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ClassGroupView, WaitlistEntryView } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
 * e 1o vencimento), como a matricula. O proprio dialogo e a confirmacao.
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
    <Dialog open={entry !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 p-6 pb-2 pr-14">
          <DialogTitle>Matricular da lista de espera</DialogTitle>
          <DialogDescription>
            {shown?.studentName} entra no curso {turma.name}, mesmo que ele esteja lotado.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
