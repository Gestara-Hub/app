"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Client } from "@gestarahub/contracts";
import { isPossiblePhone } from "@gestarahub/core/phone";
import { todayISO } from "@gestarahub/core/date";
import { DateField, DialogFormFooter, InputPhone, InputText } from "@/components/form";
import { DialogBody } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { handleFormApiError } from "@/lib/form-errors";
import { toast } from "@/lib/toast";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useCreateClient } from "../hooks/use-clients";

/**
 * Cadastro rapido do aluno (09/11/2026): so o nome e obrigatorio. Abre por
 * cima de "Adicionar aluno nesta aula" para inscrever quem chegou para a aula
 * experimental sem parar a recepcao. O resto do cadastro fica para depois
 * (a ficha mostra "Falta telefone · Completar cadastro").
 */

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || isPossiblePhone(v), { message: "Informe um telefone válido." }),
  birthDate: z.string().refine((v) => !v || v <= todayISO(), { message: "A data de nascimento não pode ser futura." }),
});

type Values = z.infer<typeof schema>;

function QuickClientForm({ onCreated, onCancel }: { onCreated: (client: Client) => void; onCancel: () => void }) {
  const createMut = useCreateClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: "", phone: "", birthDate: "" },
  });
  const pending = createMut.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await createMut.mutateAsync({
        name: values.name.trim(),
        phone: values.phone.trim() || undefined,
        birthDate: values.birthDate || undefined,
        status: "active",
      });
      toast.success("Aluno cadastrado.");
      onCreated(created);
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível cadastrar o aluno.");
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <InputText<Values> name="name" label="Nome" required placeholder="Informe o nome do aluno" disabled={pending} />
          <InputPhone<Values>
            name="phone"
            label="Telefone (WhatsApp)"
            hint="Opcional agora. Com ele, dá para chamar de volta pelo WhatsApp."
            disabled={pending}
          />
          <div className="w-48">
            <DateField<Values> name="birthDate" label="Nascimento (opcional)" max={todayISO()} disabled={pending} />
          </div>
          <p className="text-xs text-muted-foreground">O restante do cadastro pode ser completado depois, na ficha.</p>
        </DialogBody>
        <DialogFormFooter
          isPending={pending}
          isEdit={false}
          onCancel={onCancel}
          className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
        />
      </form>
    </FormProvider>
  );
}

export function QuickClientDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Aluno criado: quem abriu decide o que fazer (ex.: ja selecionar na aula). */
  onCreated: (client: Client) => void;
}) {
  const present = useDialogPresence(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">Cadastro rápido</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Só o nome é obrigatório. O aluno já fica salvo em Alunos.
          </SheetDescription>
        </SheetHeader>
        {present ? (
          <QuickClientForm
            onCreated={(client) => {
              onCreated(client);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
