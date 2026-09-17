"use client";

import { useEffect, useMemo } from "react";
import { useForm, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import {
  AutocompleteField,
  InputPhone,
  InputText,
  SwitchField,
} from "@/components/form";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { normalizeText } from "@/lib/text";
import { ORG_ID, UNIT_ID } from "@/config/tenant";
import type {
  CreateProfessional,
  Professional,
  ProfessionalView,
  Unit,
  Weekday,
} from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useRoles } from "@/features/roles";
import { useUnit } from "@/features/settings";
import {
  useCreateProfessional,
  useUpdateProfessional,
} from "../hooks/use-professionals";
import {
  getProfessionalFormSchema,
  type ProfessionalFormValues,
} from "../professional-schema";
import { ServiceSelectionField } from "./service-selection-field";
import { ModalitySelectionField } from "./modality-selection-field";
import { getDefaultWorkingHours, WorkingHoursField } from "./working-hours-field";

/**
 * Ao cadastrar um novo profissional, os dias e horários padrão são pré-preenchidos
 * a partir do expediente da unidade (ou Segunda a Sexta das 09:00 às 18:00 se a unidade ainda não tiver horário).
 * Na edição, preserva rigorosamente o que o profissional já tem salvo.
 */
function toDefaults(
  professional: Professional | undefined,
  roleName: string,
  unit?: Unit,
): ProfessionalFormValues {
  return {
    name: professional?.name ?? "",
    role: roleName,
    phone: professional?.phone ?? "",
    serviceIds: professional?.serviceIds ?? [],
    modalityIds: professional?.modalityIds ?? [],
    workingHours: professional
      ? professional.workingHours
      : getDefaultWorkingHours(unit),
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
  const isClasses = useModel() === "classes";
  const { data: unit } = useUnit();
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

  const schema = useMemo(() => getProfessionalFormSchema(isClasses), [isClasses]);

  const form = useForm<ProfessionalFormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(professional, currentRoleName, unit),
  });

  // Se os dados da unidade carregarem após o primeiro render e o usuário ainda não
  // tiver alterado a disponibilidade, sincroniza com os dias abertos da unidade.
  useEffect(() => {
    if (!isEdit && unit && !form.formState.isDirty) {
      const openDays = (unit.businessHours ?? []).filter((d) => !d.closed);
      if (openDays.length > 0) {
        form.setValue("workingHours", getDefaultWorkingHours(unit), {
          shouldDirty: false,
        });
      }
    }
  }, [unit, isEdit, form]);

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
      // O modelo do tenant decide qual associação é relevante: M1 grava
      // serviços; M3 grava modalidades (a outra fica vazia e é ignorada).
      serviceIds: isClasses ? [] : values.serviceIds,
      modalityIds: isClasses ? values.modalityIds : [],
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

        {isClasses ? (
          <ModalitySelectionField<ProfessionalFormValues>
            name="modalityIds"
            required={isClasses}
            disabled={pending}
          />
        ) : (
          <ServiceSelectionField<ProfessionalFormValues>
            name="serviceIds"
            disabled={pending}
          />
        )}

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
