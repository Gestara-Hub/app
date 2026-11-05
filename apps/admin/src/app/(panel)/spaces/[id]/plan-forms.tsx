"use client";

import { useState } from "react";
import { FormProvider, type DefaultValues, type FieldValues } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { CheckboxField, FormFeedback, InputText, SelectField, TextArea, useActionForm, type ServerAction } from "@/components/form";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { DrawerBody, DrawerFooter, FormDrawer, useDrawerClose } from "@/components/shared/form-drawer";
import { ListRow } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import { courtesySchema, forceFreeSchema, graceSchema, reasonOnlySchema, userTwoFactorSchema } from "@/lib/form-schemas";
import { inactivateSpaceAction, reactivateSpaceAction, resetUserTwoFactorAction } from "./privacy-actions";
import { extendGraceAction, forceFreeAction, grantCourtesyAction, revokeCourtesyAction, type PlanFormState } from "./plan-actions";

/**
 * Cada ação do espaço é uma linha com um botão que abre a gaveta do formulário. O motivo fica
 * registrado e, como mexe em dinheiro ou no acesso do cliente, o envio sempre passa por uma
 * confirmação. Os campos validam no navegador (React Hook Form + Zod) antes da confirmação;
 * a action valida de novo.
 */
export function ActionRow<S extends z.ZodType<FieldValues, FieldValues>>({
  title,
  description,
  buttonLabel,
  spaceId,
  action,
  schema,
  defaultValues,
  confirmText,
  submitLabel,
  destructive,
  children,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  spaceId: string;
  action: ServerAction<PlanFormState>;
  schema: S;
  defaultValues?: Record<string, unknown>;
  confirmText: string;
  submitLabel: string;
  destructive?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <ListRow
      actions={
        <FormDrawer
          title={title}
          description={description}
          trigger={
            <Button variant="outline" className={destructive ? "text-destructive hover:text-destructive" : undefined}>
              {buttonLabel}
            </Button>
          }
        >
          <ActionDrawerForm
            spaceId={spaceId}
            action={action}
            schema={schema}
            defaultValues={defaultValues}
            confirmText={confirmText}
            confirmTitle={title}
            submitLabel={submitLabel}
            destructive={destructive}
          >
            {children}
          </ActionDrawerForm>
        </FormDrawer>
      }
    >
      <p className="font-medium">{title}</p>
      <p className="min-w-0 break-words text-sm text-muted-foreground">{description}</p>
    </ListRow>
  );
}

function ActionDrawerForm<S extends z.ZodType<FieldValues, FieldValues>>({
  spaceId,
  action,
  schema,
  defaultValues,
  confirmText,
  confirmTitle,
  submitLabel,
  destructive,
  children,
}: {
  spaceId: string;
  action: ServerAction<PlanFormState>;
  schema: S;
  defaultValues?: Record<string, unknown>;
  confirmText: string;
  confirmTitle: string;
  submitLabel: string;
  destructive?: boolean;
  children?: React.ReactNode;
}) {
  const close = useDrawerClose();
  const [confirming, setConfirming] = useState(false);
  const { form, state, pending, submit } = useActionForm<S, PlanFormState>({
    schema,
    defaultValues: { spaceId, reason: "", ...defaultValues } as DefaultValues<z.input<S>>,
    action,
    onSuccess: (result) => {
      toast.success(result.message ?? "Pronto.");
      close();
    },
  });
  const send = submit();
  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          // Valida os campos e só então pede a confirmação.
          void form.handleSubmit(() => setConfirming(true))(event);
        }}
        className="flex min-h-0 flex-1 flex-col"
        noValidate
      >
        <DrawerBody>
          {children}
          <TextArea name="reason" label="Motivo (fica registrado)" required rows={3} maxLength={300} />
          <FormFeedback state={state} />
        </DrawerBody>
        <DrawerFooter submitLabel={submitLabel} pendingLabel="Aplicando..." pending={pending} />
      </form>
      <ConfirmActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={confirmTitle}
        description={confirmText}
        confirmLabel={submitLabel}
        variant={destructive ? "destructive" : "default"}
        isPending={pending}
        onConfirm={async () => {
          setConfirming(false);
          await send();
        }}
      />
    </FormProvider>
  );
}

export function CourtesyForm({ spaceId }: { spaceId: string }) {
  return (
    <ActionRow
      title="Dar cortesia"
      buttonLabel="Dar cortesia"
      description="Plano pago de graça por um tempo. No fim, volta ao Grátis sozinho e o dono é avisado no histórico do plano."
      spaceId={spaceId}
      action={grantCourtesyAction}
      schema={courtesySchema}
      defaultValues={{ tier: "pro", days: 30 }}
      confirmText="O espaço ganha o plano escolhido sem cobrança e volta ao Grátis no dia seguinte ao fim. O dono vê isso no histórico do plano."
      submitLabel="Confirmar cortesia"
    >
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="tier"
          label="Plano"
          options={[
            ["pro", "Profissional"],
            ["scale", "Expansão"],
          ]}
        />
        <InputText name="days" label="Dias" required type="number" min={1} max={365} />
      </div>
    </ActionRow>
  );
}

export function RevokeCourtesyForm({ spaceId }: { spaceId: string }) {
  return (
    <ActionRow
      title="Encerrar a cortesia agora"
      buttonLabel="Encerrar cortesia"
      description="O espaço volta ao Grátis na hora."
      spaceId={spaceId}
      action={revokeCourtesyAction}
      schema={reasonOnlySchema}
      confirmText="O espaço perde o plano pago agora. Os dados ficam guardados."
      submitLabel="Encerrar cortesia"
      destructive
    />
  );
}

export function GraceForm({ spaceId }: { spaceId: string }) {
  return (
    <ActionRow
      title="Dar mais dias para pagar"
      buttonLabel="Dar mais dias"
      description="Para renovação atrasada por problema nosso (Pix fora do ar, por exemplo). A nova data vale a partir de hoje."
      spaceId={spaceId}
      action={extendGraceAction}
      schema={graceSchema}
      defaultValues={{ days: 5 }}
      confirmText="A data da renovação passa a ser hoje mais os dias escolhidos, e o espaço segue com o plano até lá."
      submitLabel="Confirmar"
    >
      <InputText name="days" label="Dias (1 a 30)" required type="number" min={1} max={30} inputClassName="w-28" />
    </ActionRow>
  );
}

export function ForceFreeForm({ spaceId, needsPartnerCheck }: { spaceId: string; needsPartnerCheck: boolean }) {
  return (
    <ActionRow
      title="Voltar ao Grátis agora"
      buttonLabel="Voltar ao Grátis"
      description="Para abuso ou pedido do cliente fora do aplicativo. Não cancela a cobrança no parceiro de pagamentos."
      spaceId={spaceId}
      action={forceFreeAction}
      schema={forceFreeSchema(needsPartnerCheck)}
      defaultValues={{ partnerCanceled: false }}
      confirmText="O espaço perde o plano pago agora. Os dados ficam guardados."
      submitLabel="Voltar ao Grátis"
      destructive
    >
      {needsPartnerCheck ? <CheckboxField name="partnerCanceled" label="Já cancelei a assinatura deste espaço no parceiro de pagamentos." /> : null}
    </ActionRow>
  );
}

export function InactivateSpaceForm({ spaceId }: { spaceId: string }) {
  return (
    <ActionRow
      title="Inativar o espaço"
      buttonLabel="Inativar"
      description="Ninguém do espaço entra mais e as rotinas diárias pulam o espaço. Nada é apagado; dá para reativar."
      spaceId={spaceId}
      action={inactivateSpaceAction}
      schema={reasonOnlySchema}
      confirmText="Todas as pessoas deste espaço perdem o acesso agora, inclusive quem está logado. Os dados ficam guardados."
      submitLabel="Inativar espaço"
      destructive
    />
  );
}

export function ReactivateSpaceForm({ spaceId }: { spaceId: string }) {
  return (
    <ActionRow
      title="Reativar o espaço"
      buttonLabel="Reativar"
      description="Devolve o acesso a todos do espaço. Nada foi apagado."
      spaceId={spaceId}
      action={reactivateSpaceAction}
      schema={reasonOnlySchema}
      confirmText="As pessoas do espaço voltam a entrar e as rotinas diárias voltam a rodar."
      submitLabel="Reativar espaço"
    />
  );
}

/** Reiniciar o 2FA de uma pessoa do espaco: escolhe a pessoa, diz o motivo e confirma. */
export function ResetUserTwoFactorForm({ spaceId, users }: { spaceId: string; users: { id: string; label: string }[] }) {
  return (
    <ActionRow
      title="Reiniciar a verificação em duas etapas de uma pessoa"
      buttonLabel="Reiniciar"
      description="Para quem perdeu o aplicativo e não guardou os códigos de recuperação. Confirme quem é a pessoa por fora do sistema antes (por exemplo, pela conversa do Fale com a gente)."
      spaceId={spaceId}
      action={resetUserTwoFactorAction}
      schema={userTwoFactorSchema}
      defaultValues={{ userId: "" }}
      confirmText="Remove o aplicativo e o código por e-mail da pessoa, os dispositivos lembrados e os códigos de recuperação. No próximo acesso ela entra só com a senha e a pessoa recebe um aviso por e-mail."
      submitLabel="Reiniciar verificação"
      destructive
    >
      <SelectField name="userId" label="Pessoa" required options={[["", "Escolha a pessoa..."], ...users.map((u) => [u.id, u.label] as const)]} />
    </ActionRow>
  );
}
