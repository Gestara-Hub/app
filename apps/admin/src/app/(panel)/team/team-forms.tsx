"use client";

import { useActionState, useState } from "react";
import { FormProvider } from "react-hook-form";
import { InputText, SelectField, useActionForm } from "@/components/form";
import { inviteSchema } from "@/lib/form-schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_ROLES, ADMIN_ROLE_LABEL, type AdminRole } from "@/lib/permissions";
import { changeRoleAction, inviteAction, resendInviteAction, resetMfaAction, setActiveAction, type TeamFormState } from "./actions";

const NATIVE_SELECT = "h-9 rounded-md border bg-background px-3 text-base md:text-sm";

function Feedback({ state }: { state: TeamFormState }) {
  return (
    <>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
      {state.link ? <p className="rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all">{state.link}</p> : null}
    </>
  );
}

/** Convite de um novo administrador (so o proprietario ve). */
export function InviteForm({ enabled }: { enabled: boolean }) {
  const { form, state, pending, submit } = useActionForm<typeof inviteSchema, TeamFormState>({
    schema: inviteSchema,
    defaultValues: { name: "", email: "", role: "platform_support" },
    action: inviteAction,
    resetOnSuccess: true,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Convidar administrador</CardTitle>
        <CardDescription>
          {enabled ? "A pessoa recebe um link para criar a senha e configurar o aplicativo autenticador. Ela só acessa este painel." : "O convite está desligado neste ambiente (falta a chave do Auth no servidor)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={submit()} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-3">
              <InputText name="name" id="invite-name" label="Nome" required maxLength={80} />
              <InputText name="email" id="invite-email" label="E-mail" type="email" required />
              <SelectField name="role" id="invite-role" label="Papel" options={ADMIN_ROLES.map((role) => [role, ADMIN_ROLE_LABEL[role]] as const)} />
            </div>
            <Feedback state={state} />
            <Button type="submit" disabled={pending || !enabled}>
              {pending ? "Convidando..." : "Convidar"}
            </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}

function Mini({ action, id, label, extra, confirm, variant = "outline" }: { action: (prev: TeamFormState, formData: FormData) => Promise<TeamFormState>; id: string; label: string; extra?: Record<string, string>; confirm?: string; variant?: "outline" | "ghost" | "destructive" }) {
  const [state, formAction, pending] = useActionState(action, {} as TeamFormState);
  const [armed, setArmed] = useState(false);
  return (
    <form
      action={(formData) => {
        setArmed(false);
        formAction(formData);
      }}
      className="space-y-1"
    >
      <input type="hidden" name="id" value={id} />
      {Object.entries(extra ?? {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {armed ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{confirm}</span>
          <Button type="submit" size="sm" variant={variant === "ghost" ? "outline" : variant} disabled={pending}>
            {pending ? "Aplicando..." : "Confirmar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setArmed(false)}>
            Voltar
          </Button>
        </div>
      ) : confirm ? (
        <Button type="button" size="sm" variant={variant} onClick={() => setArmed(true)}>
          {label}
        </Button>
      ) : (
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {label}
        </Button>
      )}
      <Feedback state={state} />
    </form>
  );
}

/** Acoes de uma linha da equipe. Quem e o proprio usuario so ve o que pode fazer em si. */
export function MemberActions({ id, role, status, isSelf }: { id: string; role: AdminRole; status: "active" | "invited" | "disabled"; isSelf: boolean }) {
  const [state, roleAction, pending] = useActionState(changeRoleAction, {} as TeamFormState);
  if (isSelf) return <span className="text-xs text-muted-foreground">Você</span>;
  return (
    <div className="flex flex-col items-end gap-2">
      <form action={roleAction} className="flex items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <select name="role" defaultValue={role} aria-label="Papel" className={NATIVE_SELECT}>
          {ADMIN_ROLES.map((r) => (
            <option key={r} value={r}>
              {ADMIN_ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Salvar papel
        </Button>
      </form>
      <Feedback state={state} />
      <div className="flex flex-wrap justify-end gap-2">
        {status === "invited" ? <Mini action={resendInviteAction} id={id} label="Reenviar convite" /> : null}
        {status === "active" ? <Mini action={resetMfaAction} id={id} label="Reiniciar 2FA" confirm="A pessoa terá de configurar o aplicativo de novo." /> : null}
        {status === "disabled" ? (
          <Mini action={setActiveAction} id={id} extra={{ active: "1" }} label="Reativar" confirm="Devolver o acesso ao painel?" />
        ) : status === "active" ? (
          <Mini action={setActiveAction} id={id} extra={{ active: "0" }} label="Desativar" variant="destructive" confirm="Tirar o acesso desta pessoa agora?" />
        ) : null}
      </div>
    </div>
  );
}
