"use client";

import { useState } from "react";
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
import { FieldShell, InputText, SelectField, SwitchField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { userProfileLabel } from "@/lib/labels";
import { normalizeText } from "@/lib/text";
import { ORG_ID } from "@/config/tenant";
import type { CreateUser, UserProfile, UserView } from "@gestarahub/contracts";
import { manageableProfiles } from "@/lib/permissions";
import { useProfessionals } from "@/features/professionals/hooks/use-professionals";
import { useCurrentUser } from "@/features/auth/session-provider";
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
  const [nameOpen, setNameOpen] = useState(false);

  // Um usuario so pode atribuir perfis que ele mesmo pode gerenciar (Gerente:
  // Atendente/Profissional). Ao editar, preserva o perfil atual do usuario mesmo
  // que fora do conjunto, para nao perde-lo no select.
  const currentUser = useCurrentUser();
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

  // Vinculo ativo: o Nome foi escolhido a partir da equipe (autocomplete).
  const linkedId = useWatch({ control: form.control, name: "professionalId" });
  const linked = linkedId
    ? (professionals ?? []).find((p) => p.id === linkedId)
    : undefined;

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreateUser = {
      organizationId: user?.organizationId ?? ORG_ID,
      name: values.name,
      email: values.email,
      profile: values.profile as UserProfile,
      professionalId: values.professionalId || undefined,
      status: values.active ? "active" : "inactive",
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
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => {
            const query = normalizeText(field.value ?? "");
            const matches =
              query === ""
                ? []
                : (professionals ?? [])
                    .filter((p) => {
                      const n = normalizeText(p.name);
                      return n !== query && n.includes(query);
                    })
                    .slice(0, 6);
            const showList = nameOpen && matches.length > 0;

            return (
              <FieldShell
                id="user-name"
                label="Nome"
                required
                error={fieldState.error?.message}
                hint={
                  linked
                    ? `Vinculado a ${linked.name} (equipe).`
                    : "Digite para sugerir um membro da equipe; selecionar cria o vínculo."
                }
              >
                <div className="relative">
                  <Input
                    id="user-name"
                    ref={field.ref}
                    name={field.name}
                    value={field.value ?? ""}
                    placeholder="Ex.: Maria Souza"
                    autoComplete="off"
                    disabled={pending}
                    aria-invalid={fieldState.invalid}
                    onChange={(event) => {
                      field.onChange(event.target.value);
                      // Digitacao manual desfaz o vinculo — so selecionar da
                      // lista vincula a um profissional.
                      if (form.getValues("professionalId")) {
                        form.setValue("professionalId", "", { shouldDirty: true });
                      }
                      setNameOpen(true);
                    }}
                    onFocus={() => setNameOpen(true)}
                    onBlur={() => {
                      field.onBlur();
                      setNameOpen(false);
                    }}
                  />
                  {showList ? (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded-md border bg-popover py-1 text-popover-foreground shadow-md">
                      {matches.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          // mousedown preventDefault mantem o foco (sem blur antes do click)
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            form.setValue("name", p.name, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                            form.setValue("professionalId", p.id, {
                              shouldDirty: true,
                            });
                            setNameOpen(false);
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        >
                          <span className="truncate">{p.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {p.role.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </FieldShell>
            );
          }}
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
          disabled={pending}
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
            hint="Usuários inativos não podem acessar o sistema."
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
            {pending ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar usuário"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
