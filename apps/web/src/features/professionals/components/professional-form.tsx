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
  CreateProfessional,
  Professional,
  ProfessionalView,
  Weekday,
} from "@gestarahub/contracts";
import { useRoles } from "@/features/roles";
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
 * Disponibilidade e OPCIONAL no cadastro: um profissional novo comeca sem
 * horario (campos limpos) e o usuario define se/quando quiser; na edicao mantem
 * o que ja tem. Quando fica vazio, a agenda apenas pede confirmacao ao agendar
 * (o horario do profissional e regra "mole").
 */
function toDefaults(
  professional: Professional | undefined,
  roleName: string,
): ProfessionalFormValues {
  return {
    name: professional?.name ?? "",
    role: roleName,
    phone: professional?.phone ?? "",
    serviceIds: professional?.serviceIds ?? [],
    workingHours: professional?.workingHours ?? [],
    active: professional ? professional.status === "active" : true,
  };
}

interface ProfessionalFormProps {
  professional?: ProfessionalView;
  onSuccess: () => void;
  formId: string;
}

export function ProfessionalForm({
  professional,
  onSuccess,
  formId,
}: ProfessionalFormProps) {
  const isEdit = Boolean(professional);
  const createMut = useCreateProfessional();
  const updateMut = useUpdateProfessional();
  const pending = createMut.isPending || updateMut.isPending;

  // Cargo (Role) e OPCIONAL: gerenciado no CRUD de Cargos, aqui so seleciona um
  // existente (select com filtro), nao cria. Sugestoes = cargos ativos; inclui
  // o cargo atual do profissional mesmo se inativo, para nao perde-lo ao editar.
  const { data: roles } = useRoles();
  const activeRoleNames = (roles ?? [])
    .filter((r) => r.status === "active")
    .map((r) => r.name);
  const currentRoleName = professional?.role?.name ?? "";
  const roleSuggestions =
    currentRoleName && !activeRoleNames.includes(currentRoleName)
      ? [...activeRoleNames, currentRoleName]
      : activeRoleNames;

  const form = useForm<ProfessionalFormValues>({
    resolver: zodResolver(professionalFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(professional, currentRoleName),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const organizationId = professional?.organizationId ?? ORG_ID;

    // Cargo e opcional: se preenchido, resolve para um Role (FK) existente; se um
    // texto sem correspondencia for digitado, avisa. Vazio -> sem cargo.
    const typedRole = values.role.trim();
    const selectedRole = typedRole
      ? (roles ?? []).find(
          (r) => normalizeText(r.name) === normalizeText(typedRole),
        )
      : undefined;
    if (typedRole && !selectedRole) {
      form.setError("role", { message: "Selecione um cargo da lista." });
      return;
    }
    const roleId = selectedRole?.id;

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
            placeholder="Selecione um cargo (opcional)"
            suggestions={roleSuggestions}
            strict
            emptyMessage="Nenhum cargo encontrado."
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
