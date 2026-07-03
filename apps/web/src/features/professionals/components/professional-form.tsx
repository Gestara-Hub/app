"use client";

import { useForm, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AutocompleteField,
  InputPhone,
  InputText,
  SwitchField,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { normalizeText } from "@/lib/text";
import { ORG_ID, UNIT_ID } from "@/config/tenant";
import type {
  BusinessHoursDay,
  CreateProfessional,
  Professional,
  ProfessionalView,
  Weekday,
  WorkingHours,
} from "@gestarahub/contracts";
import { useRoles } from "@/features/roles";
import { useUnit } from "@/features/settings";
import {
  useCreateProfessional,
  useUpdateProfessional,
} from "../hooks/use-professionals";
import {
  professionalFormSchema,
  type ProfessionalFormValues,
} from "../professional-schema";
import { ServiceSelectionField } from "./service-selection-field";
import { WorkingHoursField } from "./working-hours-field";

/**
 * Deriva a disponibilidade inicial de um novo profissional a partir do horario
 * de funcionamento da unidade: pre-seleciona os dias abertos e aplica um unico
 * horario (o mais frequente entre eles) a todos — coerente com o campo, que usa
 * um horario para todos os dias marcados. Sem almoco por padrao (o horario de
 * funcionamento nao modela intervalo).
 */
function defaultWorkingHours(
  businessHours: BusinessHoursDay[],
): WorkingHours[] {
  const open = businessHours.filter((d) => !d.closed && d.start && d.end);
  if (open.length === 0) return [];

  // Horario representativo = par (start,end) mais frequente entre os dias
  // abertos; empate resolvido pelo dia de menor indice (ordem da semana).
  const counts = new Map<string, number>();
  for (const d of open) counts.set(keyOf(d), (counts.get(keyOf(d)) ?? 0) + 1);
  let best = open[0];
  let bestCount = 0;
  for (const d of open) {
    const c = counts.get(keyOf(d)) ?? 0;
    if (c > bestCount) {
      bestCount = c;
      best = d;
    }
  }

  return open.map((d) => ({
    weekday: d.weekday,
    start: best.start!,
    end: best.end!,
  }));
}

function keyOf(d: BusinessHoursDay): string {
  return `${d.start}-${d.end}`;
}

function toDefaults(
  professional: Professional | undefined,
  roleName: string,
  businessHours: BusinessHoursDay[],
): ProfessionalFormValues {
  return {
    name: professional?.name ?? "",
    role: roleName,
    phone: professional?.phone ?? "",
    serviceIds: professional?.serviceIds ?? [],
    // Novo profissional herda a disponibilidade do horario de funcionamento;
    // na edicao mantem a que ja tem.
    workingHours:
      professional?.workingHours ?? defaultWorkingHours(businessHours),
    active: professional ? professional.status === "active" : true,
  };
}

interface ProfessionalFormProps {
  professional?: ProfessionalView;
  onSuccess: () => void;
  formId: string;
}

/**
 * Wrapper que carrega a unidade antes de montar o formulario. Ao criar, os
 * defaults de disponibilidade dependem do `businessHours` — montar so com ele
 * pronto garante que o campo ja inicialize com o horario certo (o
 * WorkingHoursField deriva seu estado local uma unica vez, no mount).
 */
export function ProfessionalForm(props: ProfessionalFormProps) {
  const isEdit = Boolean(props.professional);
  const unitQuery = useUnit();

  // So a criacao precisa do horario de funcionamento; na edicao a
  // disponibilidade vem do proprio profissional.
  if (!isEdit && unitQuery.isLoading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Carregando disponibilidade…
      </div>
    );
  }

  return (
    <ProfessionalFormBody
      {...props}
      businessHours={unitQuery.data?.businessHours ?? []}
    />
  );
}

function ProfessionalFormBody({
  professional,
  onSuccess,
  formId,
  businessHours,
}: ProfessionalFormProps & { businessHours: BusinessHoursDay[] }) {
  const isEdit = Boolean(professional);
  const createMut = useCreateProfessional();
  const updateMut = useUpdateProfessional();
  const pending = createMut.isPending || updateMut.isPending;

  // Cargo e entidade (Role) gerenciada no CRUD de Cargos: aqui so SELECIONA um
  // existente (select com filtro), nao cria. Sugestoes = cargos ativos; inclui
  // o cargo atual do profissional mesmo se inativo, para nao perde-lo ao editar.
  const { data: roles } = useRoles();
  const activeRoleNames = (roles ?? [])
    .filter((r) => r.status === "active")
    .map((r) => r.name);
  const currentRoleName = professional?.role.name ?? "";
  const roleSuggestions =
    currentRoleName && !activeRoleNames.includes(currentRoleName)
      ? [...activeRoleNames, currentRoleName]
      : activeRoleNames;

  const form = useForm<ProfessionalFormValues>({
    resolver: zodResolver(professionalFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(professional, currentRoleName, businessHours),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const organizationId = professional?.organizationId ?? ORG_ID;

    // Resolve o cargo selecionado para um Role (FK). So seleciona um existente —
    // novos cargos sao criados no CRUD de Cargos, nao aqui.
    const selectedRole = (roles ?? []).find(
      (r) => normalizeText(r.name) === normalizeText(values.role),
    );
    if (!selectedRole) {
      form.setError("role", { message: "Selecione um cargo da lista." });
      return;
    }
    const roleId = selectedRole.id;

    const payload: CreateProfessional = {
      organizationId,
      unitId: professional?.unitId ?? UNIT_ID,
      name: values.name,
      roleId,
      phone: values.phone || undefined,
      status: values.active ? "active" : "inactive",
      serviceIds: values.serviceIds,
      workingHours: values.workingHours.map((h) => ({
        weekday: h.weekday as Weekday,
        start: h.start,
        end: h.end,
        ...(h.breakStart && h.breakEnd
          ? { breakStart: h.breakStart, breakEnd: h.breakEnd }
          : {}),
      })),
    };

    try {
      if (isEdit && professional) {
        await updateMut.mutateAsync({ id: professional.id, payload });
        toast.success("Profissional atualizado com sucesso.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Profissional criado com sucesso.");
      }
      onSuccess();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<ProfessionalFormValues>, {
            message: f.message,
          });
        }
      } else {
        toast.error(
          getErrorMessage(error, "Não foi possível salvar o profissional."),
        );
      }
    }
  });

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <InputText<ProfessionalFormValues>
          name="name"
          label="Nome"
          placeholder="Ex.: Marcelo Andrade"
          required
          disabled={pending}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AutocompleteField<ProfessionalFormValues>
            name="role"
            label="Cargo"
            placeholder="Selecione um cargo"
            suggestions={roleSuggestions}
            strict
            emptyMessage="Nenhum cargo encontrado."
            required
            disabled={pending}
          />
          <InputPhone<ProfessionalFormValues>
            name="phone"
            label="Telefone"
            disabled={pending}
          />
        </div>

        <ServiceSelectionField<ProfessionalFormValues>
          name="serviceIds"
          required
          disabled={pending}
        />

        <WorkingHoursField<ProfessionalFormValues>
          name="workingHours"
          disabled={pending}
        />

        {isEdit ? (
          <SwitchField<ProfessionalFormValues>
            name="active"
            label="Profissional ativo"
            hint="Profissionais inativos não são sugeridos em novos agendamentos."
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
            {pending
              ? "Salvando..."
              : isEdit
                ? "Salvar alterações"
                : "Criar profissional"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
