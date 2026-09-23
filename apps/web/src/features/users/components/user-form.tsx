"use client";

import {
  useForm,
  useWatch,
  FormProvider,
  Controller,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check } from "lucide-react";
import {
  FieldShell,
  InputText,
  SelectField,
  SwitchField,
  fieldAria,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Combobox } from "@/components/shared/combobox";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { userProfileLabel } from "@/lib/labels";
import type { CreateUser, UserProfile, UserView } from "@gestarahub/contracts";
import { manageableProfiles } from "@/lib/permissions";
import { useProfessionals } from "@/features/professionals";
import { useCurrentUser } from "@/features/auth";
import { useCreateUser, useUpdateUser } from "../hooks/use-users";
import { userFormSchema, type UserFormValues } from "../user-schema";

const PROFILE_ORDER: UserProfile[] = [
  "owner",
  "manager",
  "attendant",
  "professional",
];

function toDefaults(user?: UserView): UserFormValues {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    profile: user?.profile ?? "",
    professionalId: user?.professionalId ?? "",
    active: user ? user.status === "active" : true,
  };
}

interface UserFormProps {
  user?: UserView;
  onSuccess: () => void;
  formId: string;
}

export function UserForm({ user, onSuccess, formId }: UserFormProps) {
  const isEdit = Boolean(user);
  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const pending = createMut.isPending || updateMut.isPending;

  const { data: professionals } = useProfessionals({ status: "active" });

  // Um usuario so pode atribuir perfis que ele mesmo pode gerenciar (Gerente:
  // Atendente/Profissional). Ao editar, preserva o perfil atual do usuario mesmo
  // que fora do conjunto, para nao perde-lo no select.
  const currentUser = useCurrentUser();
  const isSelf = Boolean(user && user.id === currentUser.id);
  const allowedProfiles = new Set<UserProfile>(manageableProfiles(currentUser));
  if (user) allowedProfiles.add(user.profile);
  const profileOptions = PROFILE_ORDER.filter((p) => allowedProfiles.has(p)).map(
    (value) => ({ value, label: userProfileLabel(value) }),
  );

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(user),
  });

  // Opcoes do vinculo: profissionais ativos + o vinculado atual (mesmo inativo),
  // para nao sumir do combobox ao editar.
  const professionalOptions: { id: string; name: string; roleName?: string }[] =
    (professionals ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      roleName: p.role?.name,
    }));
  if (
    user?.professional &&
    !professionalOptions.some((p) => p.id === user.professional?.id)
  ) {
    professionalOptions.push({
      id: user.professional.id,
      name: user.professional.name,
    });
  }

  const linkedId = useWatch({ control: form.control, name: "professionalId" });
  const linked = linkedId
    ? professionalOptions.find((p) => p.id === linkedId)
    : undefined;
  const profile = useWatch({ control: form.control, name: "profile" });
  const isProfessionalProfile = profile === "professional";

  const onSubmit = form.handleSubmit(async (values) => {
    // Editando a si mesmo: perfil e status ficam travados (sem auto-rebaixar
    // ou se inativar e seguir com os poderes do cookie).
    const payload: CreateUser = {
      name: values.name,
      email: values.email,
      profile: isSelf && user ? user.profile : (values.profile as UserProfile),
      professionalId: values.professionalId || undefined,
      status:
        isSelf && user ? user.status : values.active ? "active" : "inactive",
    };

    try {
      if (isEdit && user) {
        await updateMut.mutateAsync({ id: user.id, payload });
        toast.success("Usuário atualizado com sucesso.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Usuário criado com sucesso.");
      }
      onSuccess();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<UserFormValues>, { message: f.message });
        }
      } else {
        toast.error(getErrorMessage(error, "Não foi possível salvar o usuário."));
      }
    }
  });

  return (
    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col min-h-0 flex-1 overflow-hidden"
      >
        <DialogBody className="space-y-4">
          <InputText<UserFormValues>
            name="name"
            label="Nome"
            placeholder="Ex.: Maria Souza"
            required
            disabled={pending}
          />

        <InputText<UserFormValues>
          name="email"
          type="email"
          label="E-mail"
          placeholder="maria@empresa.com"
          required
          disabled={pending}
        />

        <SelectField<UserFormValues>
          name="profile"
          label="Perfil de acesso"
          placeholder="Selecione o perfil"
          options={profileOptions}
          required
          disabled={pending || isSelf}
          hint={
            isSelf
              ? "Você não pode alterar o próprio perfil de acesso."
              : undefined
          }
        />

        <Controller
          control={form.control}
          name="professionalId"
          render={({ field, fieldState }) => {
            const hint = isProfessionalProfile
              ? "Obrigatório no perfil Profissional: define a agenda que ele vê."
              : "Opcional. Vincula o usuário a um membro da equipe.";
            const error = fieldState.error?.message;
            return (
              <FieldShell
                id="user-professional"
                label="Profissional da equipe"
                required={isProfessionalProfile}
                error={error}
                hint={hint}
              >
                <Combobox
                  id="user-professional"
                  triggerRef={field.ref}
                  value={field.value ?? ""}
                  onChange={(id) => {
                    field.onChange(id);
                    // Preenche o nome com o do profissional quando o campo esta
                    // vazio ou ainda tem o nome do vinculo anterior.
                    const picked = professionalOptions.find((p) => p.id === id);
                    const currentName = form.getValues("name").trim();
                    const previous = professionalOptions.find(
                      (p) => p.id === linkedId,
                    );
                    if (picked && (!currentName || currentName === previous?.name)) {
                      form.setValue("name", picked.name, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }
                  }}
                  onBlur={field.onBlur}
                  options={professionalOptions.map((p) => ({
                    value: p.id,
                    label: p.roleName ? `${p.name} · ${p.roleName}` : p.name,
                  }))}
                  placeholder="Selecione o profissional"
                  searchPlaceholder="Buscar profissional..."
                  emptyMessage="Nenhum profissional encontrado."
                  ariaLabel="Profissional da equipe"
                  ariaDescribedBy={
                    fieldAria("user-professional", error, hint)["aria-describedby"]
                  }
                  invalid={fieldState.invalid}
                  disabled={pending}
                  clearable
                />
              </FieldShell>
            );
          }}
        />

        {linked ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 text-emerald-600" />
            Vinculado ao profissional <strong>{linked.name}</strong> — aparece na
            agenda dele.
          </p>
        ) : null}

        {isEdit ? (
          <SwitchField<UserFormValues>
            name="active"
            label="Usuário ativo"
            hint={
              isSelf
                ? "Você não pode inativar o próprio usuário."
                : "Usuários inativos não podem acessar o sistema."
            }
            disabled={pending || isSelf}
          />
        ) : null}
        </DialogBody>

        <DialogFooter className="p-6 pt-4 border-t border-border/40 shrink-0 bg-background">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar usuário"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
