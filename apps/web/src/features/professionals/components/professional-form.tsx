"use client";

import { useTeamWords } from "@/features/settings";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useForm,
  FormProvider,
  useWatch,
  type Path,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/toast";
import { Clock, Info, MailCheck, MapPin, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AddressFields,
  CollapsibleSection,
  ComboboxField,
  InputPhone,
  InputText,
} from "@/components/form";
import { SectionSpotlight } from "@/components/shared/section-spotlight";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { userProfileLabel } from "@/lib/labels";
import { normalizeText } from "@/lib/text";
import { cn } from "@/lib/utils";
import type {
  Address,
  CreateProfessional,
  Professional,
  ProfessionalView,
  Unit,
  Weekday,
} from "@gestarahub/contracts";
import { useCurrentUser, useModel } from "@/features/auth";
import { useUserPreferences } from "@/features/preferences";
import { useCreateRole, useRoles } from "@/features/roles";
import { useUnit } from "@/features/settings";
import { useCreateUser, useUsers } from "@/features/users";
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
    email: professional?.email ?? "",
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
  onCancel?: () => void;
  formId: string;
}

export function ProfessionalForm({
  professional,
  onSuccess,
  onCancel,
  formId,
}: ProfessionalFormProps) {
  const team = useTeamWords();
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
  const { data: users } = useUsers();
  const createUserMut = useCreateUser();
  const currentUser = useCurrentUser();
  const { preferences, updatePreferences } = useUserPreferences();
  const cardRef = useRef<HTMLDivElement | null>(null);

  const [inviteUser, setInviteUser] = useState(false);
  const SPOTLIGHT_ALERT_KEY = "professional_invite_access_spotlight";

  const isSpotlightDismissed = useMemo(() => {
    if (typeof window === "undefined") return true;
    const hasLocal =
      window.localStorage.getItem(`gestarahub_spotlight_invite_${currentUser.id}`) === "true";
    const hasRemote = (preferences?.dismissedAlertKeys ?? []).includes(SPOTLIGHT_ALERT_KEY);
    return hasLocal || hasRemote;
  }, [currentUser.id, preferences?.dismissedAlertKeys]);

  const pending = createMut.isPending || updateMut.isPending || createUserMut.isPending;

  // Cargo (Role) e OPCIONAL: gerenciado no CRUD de Cargos, aqui so seleciona um
  // existente (select com filtro), nao cria. Sugestoes = cargos ativos; inclui
  // o cargo atual do profissional mesmo se inativo, para nao perde-lo ao editar.
  const { data: roles } = useRoles();
  const createRoleMut = useCreateRole();
  const currentRoleName = professional?.role?.name ?? "";

  const schema = useMemo(() => getProfessionalFormSchema(isClasses, team.lower), [isClasses, team.lower]);

  const form = useForm<ProfessionalFormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(professional, currentRoleName, unit, isClasses),
  });

  const selectedRoleName = useWatch({
    control: form.control,
    name: "role",
  });

  const watchedEmail = useWatch({
    control: form.control,
    name: "email",
  });

  const normalizedWatchedEmail = (watchedEmail || "").trim().toLowerCase();
  // O vinculo e so o gravado no usuario (professionalId). O e-mail daqui e o
  // de contato: pode ser diferente do e-mail de acesso e muda-lo nao muda o login.
  // Usuario inativo ligado nao conta: pode liberar um acesso novo (no maximo um ativo).
  const linkedUser = professional?.id
    ? (users ?? []).find((u) => u.professionalId === professional.id && u.status === "active")
    : undefined;
  // E-mail digitado que ja e de outro usuario: avisa e nao oferece convite.
  const emailTakenBy = normalizedWatchedEmail
    ? (users ?? []).find((u) => u !== linkedUser && u.email.toLowerCase() === normalizedWatchedEmail)
    : undefined;

  // Ativa o spotlight na primeira vez que o usuário preenche um e-mail válido para um profissional sem acesso
  const isCandidateForSpotlight =
    !isSpotlightDismissed &&
    Boolean(normalizedWatchedEmail && normalizedWatchedEmail.includes("@") && !linkedUser && !emailTakenBy);

  const [spotlightDismissedThisSession, setSpotlightDismissedThisSession] = useState(false);
  const spotlightActive = isCandidateForSpotlight && !spotlightDismissedThisSession;

  const handleDismissSpotlight = useCallback(() => {
    setSpotlightDismissedThisSession(true);
    try {
      window.localStorage.setItem(
        `gestarahub_spotlight_invite_${currentUser.id}`,
        "true",
      );
    } catch {
      // ignore
    }
    if (!(preferences?.dismissedAlertKeys ?? []).includes(SPOTLIGHT_ALERT_KEY)) {
      updatePreferences({
        dismissedAlertKeys: [
          ...(preferences?.dismissedAlertKeys ?? []),
          SPOTLIGHT_ALERT_KEY,
        ],
      });
    }
  }, [currentUser.id, preferences?.dismissedAlertKeys, updatePreferences]);

  const handleToggleInvite = (checked: boolean) => {
    setInviteUser(checked);
    if (spotlightActive) {
      handleDismissSpotlight();
    }
  };

  const roleOptions = useMemo(() => {
    const activeRoleNames = (roles ?? [])
      .filter((r) => r.status === "active")
      .map((r) => r.name);
    const extraNames = [currentRoleName, selectedRoleName].filter(
      (n): n is string => Boolean(n && !activeRoleNames.includes(n)),
    );
    const uniqueNames = Array.from(new Set([...activeRoleNames, ...extraNames]));
    return uniqueNames.map((name) => ({ label: name, value: name }));
  }, [roles, currentRoleName, selectedRoleName]);

  const handleCreateRole = useCallback(
    async (roleName: string) => {
      try {
        const created = await createRoleMut.mutateAsync({ name: roleName });
        form.setValue("role", created.name, {
          shouldDirty: true,
          shouldValidate: true,
        });
        toast.success(`Cargo "${created.name}" criado.`);
      } catch (error) {
        toast.error(getErrorMessage(error, "Não foi possível criar o cargo."));
      }
    },
    [createRoleMut, form],
  );

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
    [setAddressOpen, setWorkingHoursOpen],
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
    const typedRole = values.role.trim();
    let selectedRole = typedRole
      ? (roles ?? []).find(
          (r) => normalizeText(r.name) === normalizeText(typedRole),
        )
      : undefined;
    if (typedRole && !selectedRole) {
      try {
        selectedRole = await createRoleMut.mutateAsync({ name: typedRole });
      } catch (error) {
        form.setError("role", {
          message: getErrorMessage(error, "Não foi possível criar o cargo."),
        });
        return;
      }
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
      email: values.email?.trim() || undefined,
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
        if (inviteUser && !linkedUser && !emailTakenBy && payload.email) {
          try {
            const invited = await createUserMut.mutateAsync({
              name: payload.name,
              email: payload.email,
              profile: "professional",
              professionalId: professional.id,
              status: "active",
            });
            if (invited.inviteSent) toast.success(`${team.title} atualizado e convite de acesso enviado por e-mail!`);
            else
              toast.warning(`${team.title} atualizado, mas o convite não foi enviado.`, {
                description: `${invited.inviteError ?? "O e-mail não saiu."} Use "Reenviar convite" em Usuários.`,
              });
          } catch (userErr) {
            // Profissional salvo; o acesso (usuario) nao foi criado: diz o motivo.
            toast.warning(`${team.title} atualizado, mas o acesso não foi criado.`, {
              description: getErrorMessage(userErr, "Tente de novo em Usuários."),
            });
          }
        } else {
          toast.success(`${team.title} atualizado com sucesso.`);
        }
      } else {
        const created = await createMut.mutateAsync({ ...payload, status: "active" });
        if (inviteUser && !emailTakenBy && payload.email) {
          try {
            const invited = await createUserMut.mutateAsync({
              name: payload.name,
              email: payload.email,
              profile: "professional",
              professionalId: created.id,
              status: "active",
            });
            if (invited.inviteSent) toast.success(`${team.title} criado e convite de acesso enviado por e-mail!`);
            else
              toast.warning(`${team.title} criado, mas o convite não foi enviado.`, {
                description: `${invited.inviteError ?? "O e-mail não saiu."} Use "Reenviar convite" em Usuários.`,
              });
          } catch (userErr) {
            // Profissional salvo; o acesso (usuario) nao foi criado: diz o motivo.
            toast.warning(`${team.title} criado, mas o acesso não foi criado.`, {
              description: getErrorMessage(userErr, "Tente de novo em Usuários."),
            });
          }
        } else {
          toast.success(`${team.title} criado com sucesso.`);
        }
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
          getErrorMessage(error, `Não foi possível salvar o ${team.lower}.`),
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
          placeholder="Informe o nome completo"
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

        <ComboboxField<ProfessionalFormValues>
          name="role"
          label="Cargo"
          placeholder="Selecione ou crie..."
          searchPlaceholder="Buscar ou digitar..."
          emptyMessage={"Nenhum cargo cadastrado.\nDigite acima para criar."}
          options={roleOptions}
          onCreateOption={handleCreateRole}
          createOptionLabel={(val) => `Criar cargo "${val}"`}
          clearable
          disabled={pending}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputPhone<ProfessionalFormValues>
            name="phone"
            label="Telefone"
            disabled={pending}
          />
          <InputText<ProfessionalFormValues>
            name="email"
            type="email"
            label="E-mail de contato"
            placeholder="profissional@email.com (opcional)"
            disabled={pending}
          />
        </div>

        {/* Bloco de Convite / Vinculação de Acesso */}
        {linkedUser ? (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 flex items-center gap-2.5 text-xs text-indigo-700 dark:text-indigo-300">
            <MailCheck className="size-4 shrink-0 text-indigo-500" />
            <span className="min-w-0 break-words">
              {linkedUser.pendingInvite
                ? `Convite enviado para ${linkedUser.email}, aguardando aceite.`
                : `Acessa o sistema como ${linkedUser.email} (${userProfileLabel(linkedUser.profile, team.title)}). Mudar o e-mail de contato não muda o acesso.`}
            </span>
          </div>
        ) : emailTakenBy ? (
          <div className="flex items-center gap-2.5 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0" />
            <span className="min-w-0 break-words">
              Este e-mail já é de acesso de {emailTakenBy.name}. Para liberar acesso a este {team.lower}, use outro
              e-mail.
            </span>
          </div>
        ) : normalizedWatchedEmail && normalizedWatchedEmail.includes("@") ? (
          <>
            <div
              ref={cardRef}
              className={cn(
                "rounded-xl border p-3.5 space-y-2 transition-all",
                spotlightActive
                  ? "border-primary/80 bg-primary/10 ring-2 ring-primary/50 shadow-lg"
                  : "border-primary/30 bg-primary/5",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="inviteUserSwitch"
                      className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5"
                    >
                      <UserPlus className="size-3.5 text-primary" />
                      <span>Liberar acesso ao sistema GestaraHub</span>
                    </Label>
                    {!isSpotlightDismissed && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.2 animate-pulse">
                        <Sparkles className="size-2.5" />
                        Novo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Enviar e-mail para <strong>{normalizedWatchedEmail}</strong> com convite para definir senha e acessar suas turmas, chamada e notas.
                  </p>
                </div>
                <Switch
                  id="inviteUserSwitch"
                  checked={inviteUser}
                  onCheckedChange={handleToggleInvite}
                  disabled={pending}
                />
              </div>
            </div>

            <SectionSpotlight
              active={spotlightActive}
              targetRefs={[cardRef]}
              onDismiss={handleDismissSpotlight}
              hint={`Dica: Você pode liberar o acesso deste ${team.lower} ao sistema por aqui!`}
              zIndex={60}
              allowModalTarget
            />
          </>
        ) : null}

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
          {onCancel ? (
            <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
              Cancelar
            </Button>
          ) : (
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
          )}
          <Button type="submit" disabled={pending}>
            {pending
              ? "Salvando..."
              : isEdit
                ? "Salvar"
                : "Adicionar"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
