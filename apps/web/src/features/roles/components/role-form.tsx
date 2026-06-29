"use client";

import { useForm, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { InputText } from "@/components/form";
import { Button } from "@/components/ui/button";
import { getErrorMessage, getFieldErrors } from "@/lib/api-error";
import { ORG_ID } from "@/config/tenant";
import { useCreateRole } from "../hooks/use-roles";
import { roleFormSchema, type RoleFormValues } from "../role-schema";

/** Formulario de criacao de cargo (a edicao acontece inline na listagem). */
export function RoleForm() {
  const createMut = useCreateRole();
  const pending = createMut.isPending;

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createMut.mutateAsync({ organizationId: ORG_ID, name: values.name });
      toast.success("Cargo criado com sucesso.");
      form.reset({ name: "" });
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<RoleFormValues>, { message: f.message });
        }
      } else {
        toast.error(getErrorMessage(error, "Não foi possível salvar o cargo."));
      }
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <InputText<RoleFormValues>
          name="name"
          label="Nome do cargo"
          placeholder="Ex.: Barbeiro"
          required
          disabled={pending}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Criar cargo"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
