"use client";

import { useForm, useWatch, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  InputCurrency,
  InputNumber,
  InputText,
  SelectField,
  SwitchField,
  TextArea,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getErrorMessage, getFieldErrors } from "@/lib/api-error";
import { ORG_ID } from "@/config/tenant";
import type { CreateService, Service } from "@gestarahub/contracts";
import { useCategories } from "@/features/categories/hooks/use-categories";
import { useCreateService, useUpdateService } from "../hooks/use-services";
import {
  serviceFormSchema,
  type ServiceFormValues,
} from "../service-schema";

const DURATION_PRESETS = [15, 30, 40, 45, 60, 75, 90];

function toDefaults(service?: Service): ServiceFormValues {
  return {
    name: service?.name ?? "",
    categoryId: service?.categoryId ?? "",
    durationMinutes: service?.durationMinutes ?? 30,
    // undefined ate o usuario digitar (campo de preco vazio).
    priceCents: service?.priceCents ?? (undefined as unknown as number),
    description: service?.description ?? "",
    active: service ? service.status === "active" : true,
  };
}

interface ServiceFormProps {
  service?: Service;
  onSuccess: () => void;
  formId: string;
}

export function ServiceForm({ service, onSuccess, formId }: ServiceFormProps) {
  const isEdit = Boolean(service);
  const createMut = useCreateService();
  const updateMut = useUpdateService();
  const pending = createMut.isPending || updateMut.isPending;

  const { data: categories } = useCategories({ status: "active" });
  const categoryOptions = (categories ?? []).map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(service),
  });

  const currentDuration = useWatch({
    control: form.control,
    name: "durationMinutes",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreateService = {
      organizationId: service?.organizationId ?? ORG_ID,
      name: values.name,
      categoryId: values.categoryId,
      durationMinutes: values.durationMinutes,
      priceCents: values.priceCents,
      description: values.description || undefined,
      status: values.active ? "active" : "inactive",
    };

    try {
      if (isEdit && service) {
        await updateMut.mutateAsync({ id: service.id, payload });
        toast.success("Serviço atualizado com sucesso.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Serviço criado com sucesso.");
      }
      onSuccess();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<ServiceFormValues>, {
            message: f.message,
          });
        }
      } else {
        toast.error(getErrorMessage(error, "Não foi possível salvar o serviço."));
      }
    }
  });

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <InputText<ServiceFormValues>
          name="name"
          label="Nome"
          placeholder="Ex.: Corte Masculino"
          required
          disabled={pending}
        />

        <SelectField<ServiceFormValues>
          name="categoryId"
          label="Categoria"
          placeholder="Selecione uma categoria"
          options={categoryOptions}
          required
          disabled={pending}
        />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">
              <span>
                Duração
                <span className="ml-0.5 text-destructive" aria-hidden>
                  *
                </span>
              </span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    form.setValue("durationMinutes", preset, {
                      shouldValidate: form.formState.isSubmitted,
                    })
                  }
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs transition-colors",
                    currentDuration === preset
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {preset}min
                </button>
              ))}
            </div>
            <InputNumber<ServiceFormValues>
              name="durationMinutes"
              min={1}
              max={1440}
              step={5}
              suffix="min"
              disabled={pending}
            />
          </div>

          <InputCurrency<ServiceFormValues>
            name="priceCents"
            label="Preço"
            required
            disabled={pending}
          />
        </div>

        <TextArea<ServiceFormValues>
          name="description"
          label="Descrição"
          placeholder="Detalhes do serviço (opcional)"
          disabled={pending}
        />

        {isEdit ? (
          <SwitchField<ServiceFormValues>
            name="active"
            label="Serviço ativo"
            hint="Serviços inativos não são sugeridos em novos agendamentos."
            disabled={pending}
          />
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar serviço"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
