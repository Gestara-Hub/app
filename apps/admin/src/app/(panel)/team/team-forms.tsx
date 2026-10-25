"use client";

import { useState, useTransition } from "react";
import { FormProvider } from "react-hook-form";
import { Check, Copy, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { InputText, SelectField, useActionForm } from "@/components/form";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { DrawerBody, DrawerFooter, useDrawerClose } from "@/components/shared/form-drawer";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteSchema } from "@/lib/form-schemas";
import { ADMIN_ROLES, ADMIN_ROLE_LABEL, type AdminRole } from "@/lib/permissions";
import { changeRoleAction, inviteAction, resendInviteAction, resetMfaAction, setActiveAction, type TeamFormState } from "./actions";

/** Link do convite (quando o e-mail não está configurado): aparece uma vez, com botão de copiar. */
function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2 rounded-md border bg-muted/50 p-3">
      <p className="break-all font-mono text-xs">{link}</p>
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          } catch {
            toast.error("Não foi possível copiar. Selecione o link e copie.");
          }
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copiado" : "Copiar link"}
      </Button>
    </div>
  );
}

/** Conteúdo da gaveta "Convidar" (só o proprietário vê o botão). */
export function InviteForm({ enabled }: { enabled: boolean }) {
  const close = useDrawerClose();
  const [done, setDone] = useState<TeamFormState | null>(null);
  const { form, state, pending, submit } = useActionForm<typeof inviteSchema, TeamFormState>({
    schema: inviteSchema,
    defaultValues: { name: "", email: "", role: "platform_support" },
    action: inviteAction,
    resetOnSuccess: true,
    onSuccess: (result) => {
      // Sem e-mail configurado o link só aparece agora: a gaveta fica aberta até copiar.
      if (result.link) setDone(result);
      else {
        toast.success(result.message ?? "Convite enviado.");
        close();
      }
    },
  });
  if (done) {
    return (
      <>
        <DrawerBody>
          <p role="status" className="text-sm">{done.message}</p>
          {done.link ? <InviteLink link={done.link} /> : null}
        </DrawerBody>
        <div className="flex shrink-0 justify-end gap-2 border-t bg-background p-4">
          <Button type="button" onClick={close}>
            Fechar
          </Button>
        </div>
      </>
    );
  }
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="flex min-h-0 flex-1 flex-col" noValidate>
        <DrawerBody>
          <p className="text-sm text-muted-foreground">
            {enabled ? "A pessoa recebe um link para criar a senha e configurar o aplicativo autenticador. Ela só acessa este painel." : "O convite está desligado neste ambiente (falta a chave do Auth no servidor)."}
          </p>
          <InputText name="name" id="invite-name" label="Nome" required maxLength={80} />
          <InputText name="email" id="invite-email" label="E-mail" type="email" required />
          <SelectField name="role" id="invite-role" label="Papel" options={ADMIN_ROLES.map((role) => [role, ADMIN_ROLE_LABEL[role]] as const)} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
        </DrawerBody>
        <DrawerFooter submitLabel="Convidar" pendingLabel="Convidando..." pending={pending} disabled={!enabled} />
      </form>
    </FormProvider>
  );
}

type Dialog = "role" | "resend" | "mfa" | "disable" | "enable" | null;

/** Menu ⋮ de uma linha da equipe: cada ação pede confirmação. Quem é o próprio usuário não tem menu. */
export function MemberMenu({ id, name, role, status }: { id: string; name: string; role: AdminRole; status: "active" | "invited" | "disabled" }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [nextRole, setNextRole] = useState<AdminRole>(role);
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: (prev: TeamFormState, formData: FormData) => Promise<TeamFormState>, extra: Record<string, string> = {}) => {
    const data = new FormData();
    data.set("id", id);
    for (const [key, value] of Object.entries(extra)) data.set(key, value);
    startTransition(async () => {
      const result = await action({}, data);
      setDialog(null);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.message ?? "Pronto.");
        if (result.link) setLink(result.link);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações de ${name}`}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setNextRole(role);
              setDialog("role");
            }}
          >
            Mudar papel
          </DropdownMenuItem>
          {status === "invited" ? <DropdownMenuItem onSelect={() => setDialog("resend")}>Reenviar convite</DropdownMenuItem> : null}
          {status === "active" ? <DropdownMenuItem onSelect={() => setDialog("mfa")}>Reiniciar 2FA</DropdownMenuItem> : null}
          <DropdownMenuSeparator />
          {status === "disabled" ? (
            <DropdownMenuItem onSelect={() => setDialog("enable")}>Reativar</DropdownMenuItem>
          ) : status === "active" ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("disable")}>
              Desativar
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmActionDialog
        open={dialog === "role"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Mudar papel"
        description={`Escolha o novo papel de ${name}. A mudança vale na próxima ação da pessoa no painel.`}
        confirmLabel="Salvar papel"
        variant="default"
        isPending={pending}
        onConfirm={() => run(changeRoleAction, { role: nextRole })}
      >
        <Select value={nextRole} onValueChange={(value) => setNextRole(value as AdminRole)}>
          <SelectTrigger className="w-full" aria-label="Papel">
            <SelectValue>{ADMIN_ROLE_LABEL[nextRole]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ADMIN_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ADMIN_ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={dialog === "resend"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Reenviar convite"
        description={`Enviar um novo link de convite para ${name}? O link anterior deixa de valer.`}
        confirmLabel="Reenviar"
        variant="default"
        isPending={pending}
        onConfirm={() => run(resendInviteAction)}
      />
      <ConfirmActionDialog
        open={dialog === "mfa"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Reiniciar 2FA"
        description={`${name} terá de configurar o aplicativo autenticador de novo no próximo acesso.`}
        confirmLabel="Reiniciar"
        isPending={pending}
        onConfirm={() => run(resetMfaAction)}
      />
      <ConfirmActionDialog
        open={dialog === "disable"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Desativar acesso"
        description={`Tirar o acesso de ${name} ao painel agora?`}
        confirmLabel="Desativar"
        isPending={pending}
        onConfirm={() => run(setActiveAction, { active: "0" })}
      />
      <ConfirmActionDialog
        open={dialog === "enable"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Reativar acesso"
        description={`Devolver o acesso de ${name} ao painel?`}
        confirmLabel="Reativar"
        variant="default"
        isPending={pending}
        onConfirm={() => run(setActiveAction, { active: "1" })}
      />
      <ConfirmActionDialog
        open={link !== null}
        onOpenChange={(open) => !open && setLink(null)}
        title="Link do convite"
        description="O e-mail não está configurado. Repasse este link à pessoa (vale por pouco tempo)."
        confirmLabel="Fechar"
        cancelLabel="Voltar"
        variant="default"
        onConfirm={() => setLink(null)}
      >
        {link ? <InviteLink link={link} /> : null}
      </ConfirmActionDialog>
    </>
  );
}
