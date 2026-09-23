"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useForm,
  FormProvider,
  useWatch,
  type Path,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import {
  AddressFields,
  CollapsibleSection,
  ComboboxField,
  InputPhone,
  InputText,
} from "@/components/form";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { normalizeText } from "@/lib/text";
import type {
  Address,
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
import { plural } from "@gestarahub/core/format";

/**
 * Ao cadastrar um novo profissional, os dias e horários padrão são pré-preenchidos
 * a partir do expediente da unidade (ou Segunda a Sexta das 09:00 às 18:00 se a unidade ainda não tiver horário).
 * Na edição, preserva rigorosamente o que o profissional já tem salvo.
 */
function toDefaults(
  professional: Professional | undefined,
  roleName: string,
  unit?: Unit,
  isClasses?: boolean,
): ProfessionalFormValues {
  return {
    name: professional?.name ?? "",
    role: roleName,
    phone: professional?.phone ?? "",
    address: professional?.address
      ? {
          postalCode: professional.address.postalCode ?? "",
          street: professional.address.street ?? "",
          number: professional.address.number ?? "",
          complement: professional.address.complement ?? "",
          neighborhood: professional.address.neighborhood ?? "",
          city: professional.address.city ?? "",
          state: professional.address.state ?? "",
        }
      : undefined,
    serviceIds: professional?.serviceIds ?? [],
    modalityIds: professional?.modalityIds ?? [],
    workingHours: professional
      ? professional.workingHours
      : isClasses
        ? []
        : getDefaultWorkingHours(unit),
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
  const [addressOpen, setAddressOpen] = useState(
    Boolean(
      professional?.address?.postalCode ||
        professional?.address?.street ||
        professional?.address?.city,
    ),
  );
  const { data: unit } = useUnit();
  const createMut = useCreateProfessional();
  const updateMut = useUpdateProfessional();
  const pending = createMut.isPending || updateMut.isPending;

  // Cargo (Role) e OPCIONAL: gerenciado no CRUD de Cargos, aqui so seleciona um
  // existente (select com filtro), nao cria. Sugestoes = cargos ativos; inclui
  // o cargo atual do profissional mesmo se inativo, para nao perde-lo ao editar.
  const { data: roles } = useRoles();
  const currentRoleName = professional?.role?.name ?? "";
  const roleOptions = useMemo(() => {
    const activeRoleNames = (roles ?? [])
      .filter((r) => r.status === "active")
      .map((r) => r.name);
    const suggestions =
      currentRoleName && !activeRoleNames.includes(currentRoleName)
        ? [...activeRoleNames, currentRoleName]
        : activeRoleNames;
    return suggestions.map((name) => ({ label: name, value: name }));
  }, [roles, currentRoleName]);

  const schema = useMemo(() => getProfessionalFormSchema(isClasses), [isClasses]);

  const form = useForm<ProfessionalFormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(professional, currentRoleName, unit, isClasses),
  });

  const [workingHoursOpen, setWorkingHoursOpen] = useState(false);

  const addressValues = useWatch({
    control: form.control,
    name: "address",
  });
  const workingHours = useWatch({
    control: form.control,
    name: "workingHours",
  });

  const hasAddressData = Boolean(
    addressValues?.street?.trim() ||
      addressValues?.postalCode?.trim() ||
      addressValues?.city?.trim(),
  );
  const addressBadge = hasAddressData
    ? addressValues?.city?.trim()
      ? `${addressValues.city.trim()}${addressValues.state ? `/${addressValues.state}` : ""}`
      : "Preenchido"
    : undefined;

  const activeDaysCount = (workingHours ?? []).length;
  const workingHoursBadge =
    activeDaysCount > 0
      ? plural(activeDaysCount, "dia configurado", "dias configurados")
      : "Nenhum dia ativo";

  const onInvalid = useCallback(
    (errors: FieldErrors<ProfessionalFormValues>) => {
      if (errors.address) {
        setAddressOpen(true);
      }
      if (errors.workingHours) {
        setWorkingHoursOpen(true);
      }
    },
    [],
  );

  // Se os dados da unidade carregarem após o primeiro render e o usuário ainda não
  // tiver alterado a disponibilidade, sincroniza com os dias abertos da unidade (apenas para M1 - agendamento individual).
  useEffect(() => {
    if (!isClasses && !isEdit && unit && !form.formState.isDirty) {
      const openDays = (unit.businessHours ?? []).filter((d) => !d.closed);
      if (openDays.length > 0) {
        form.setValue("workingHours", getDefaultWorkingHours(unit), {
          shouldDirty: false,
        });
      }
    }
  }, [unit, isEdit, form, isClasses]);

  const onSubmit = async (values: ProfessionalFormValues) => {
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

    const hasAddress =
      values.address &&
      (Boolean(values.address.street) ||
        Boolean(values.address.postalCode) ||
        Boolean(values.address.city));

    const addressPayload: Address | undefined = hasAddress
      ? {
          postalCode: values.address?.postalCode || "",
          street: values.address?.street || "",
          number: values.address?.number || "",
          complement: values.address?.complement || undefined,
          neighborhood: values.address?.neighborhood || "",
          city: values.address?.city || "",
          state: values.address?.state || "",
        }
      : undefined;

    // Sem status: ativar/inativar so pelo menu da linha (com confirmacao).
    const payload: Omit<CreateProfessional, "status"> = {
      name: values.name,
      roleId,
      phone: values.phone || undefined,
      address: addressPayload,
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
        await createMut.mutateAsync({ ...payload, status: "active" });
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
          if (f.field.startsWith("address")) {
            setAddressOpen(true);
          }
          if (f.field.startsWith("workingHours")) {
            setWorkingHoursOpen(true);
          }
        }
      } else {
        toast.error(
          getErrorMessage(error, "Não foi possível salvar o profissional."),
        );
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="flex flex-col min-h-0 flex-1 overflow-hidden"
      >
        <DialogBody className="space-y-4">
          <InputText<ProfessionalFormValues>
          name="name"
          label="Nome"
          placeholder="Ex.: Marcelo Andrade"
          required
          disabled={pending}
        />

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ComboboxField<ProfessionalFormValues>
            name="role"
            label="Cargo"
            placeholder="Selecione um cargo (opcional)"
            searchPlaceholder="Buscar cargo..."
            emptyMessage="Nenhum cargo encontrado."
            options={roleOptions}
            clearable
            disabled={pending}
          />
          <InputPhone<ProfessionalFormValues>
            name="phone"
            label="Telefone"
            disabled={pending}
          />
        </div>

        {/* Bloco: Endereço Estruturado (Opcional) */}
        <CollapsibleSection
          title="Endereço (opcional)"
          icon={<MapPin className="h-4 w-4" />}
          badge={addressBadge}
          open={addressOpen}
          onOpenChange={setAddressOpen}
        >
          <AddressFields<ProfessionalFormValues>
            prefix="address"
            disabled={pending}
          />
        </CollapsibleSection>

        {!isClasses ? (
          <CollapsibleSection
            title="Horários de trabalho & Disponibilidade"
            icon={<Clock className="h-4 w-4" />}
            badge={workingHoursBadge}
            open={workingHoursOpen}
            onOpenChange={setWorkingHoursOpen}
          >
            <WorkingHoursField<ProfessionalFormValues>
              name="workingHours"
              label=""
              borderless
              disabled={pending}
            />
          </CollapsibleSection>
        ) : null}

        </DialogBody>

        <DialogFooter className="p-6 pt-4 border-t border-border/40 shrink-0 bg-background">
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
