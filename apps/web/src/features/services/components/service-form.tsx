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
import {
  CATEGORIAS_SERVICO,
  type CategoriaServico,
  type CreateServico,
  type Servico,
} from "@/types";
import { useCreateService, useUpdateService } from "../hooks/use-services";
import {
  serviceFormSchema,
  type ServiceFormValues,
} from "../service-schema";

const DURATION_PRESETS = [15, 30, 40, 45, 60, 75, 90];
const CATEGORY_OPTIONS = CATEGORIAS_SERVICO.map((c) => ({ label: c, value: c }));

function toDefaults(service?: Servico): ServiceFormValues {
  return {
    nome: service?.nome ?? "",
    categoria: service?.categoria ?? "",
    duracaoMinutos: service?.duracaoMinutos ?? 30,
    // undefined ate o usuario digitar (campo de preco vazio).
    precoCentavos: service?.precoCentavos ?? (undefined as unknown as number),
    descricao: service?.descricao ?? "",
    ativo: service ? service.status === "ativo" : true,
  };
}

interface ServiceFormProps {
  service?: Servico;
  onSuccess: () => void;
  formId: string;
}

export function ServiceForm({ service, onSuccess, formId }: ServiceFormProps) {
  const isEdit = Boolean(service);
  const createMut = useCreateService();
  const updateMut = useUpdateService();
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(service),
  });

  const duracaoAtual = useWatch({
    control: form.control,
    name: "duracaoMinutos",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreateServico = {
      organizacaoId: service?.organizacaoId ?? ORG_ID,
      nome: values.nome,
      categoria: values.categoria as CategoriaServico,
      duracaoMinutos: values.duracaoMinutos,
      precoCentavos: values.precoCentavos,
      descricao: values.descricao || undefined,
      status: values.ativo ? "ativo" : "inativo",
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
      // Erros de validacao do "servidor" caem no campo; demais viram toast.
      const campos = getFieldErrors(error);
      if (campos && campos.length > 0) {
        for (const c of campos) {
          form.setError(c.campo as Path<ServiceFormValues>, {
            message: c.mensagem,
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
          name="nome"
          label="Nome"
          placeholder="Ex.: Corte Masculino"
          required
          disabled={pending}
        />

        <SelectField<ServiceFormValues>
          name="categoria"
          label="Categoria"
          placeholder="Selecione uma categoria"
          options={CATEGORY_OPTIONS}
          required
          disabled={pending}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm">
              Duração
              <span className="ml-0.5 text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    form.setValue("duracaoMinutos", preset, {
                      shouldValidate: form.formState.isSubmitted,
                    })
                  }
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs transition-colors",
                    duracaoAtual === preset
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {preset}min
                </button>
              ))}
            </div>
            <InputNumber<ServiceFormValues>
              name="duracaoMinutos"
              min={1}
              max={1440}
              step={5}
              suffix="min"
              disabled={pending}
            />
          </div>

          <InputCurrency<ServiceFormValues>
            name="precoCentavos"
            label="Preço"
            required
            disabled={pending}
          />
        </div>

        <TextArea<ServiceFormValues>
          name="descricao"
          label="Descrição"
          placeholder="Detalhes do serviço (opcional)"
          disabled={pending}
        />

        <SwitchField<ServiceFormValues>
          name="ativo"
          label="Serviço ativo"
          hint="Serviços inativos não são sugeridos em novos agendamentos."
          disabled={pending}
        />

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
