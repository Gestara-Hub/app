"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, FormProvider, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  QrCode,
  Save,
  Sparkles,
} from "lucide-react";
import type { OnlinePaymentSettings, Organization } from "@gestarahub/contracts";
import { InputText, SelectField, SwitchField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { handleFormApiError } from "@/lib/form-errors";
import { useCan, useHasFeature } from "@/features/auth";
import { useOrganization } from "../hooks/use-settings";
import { useUpdateOnlinePaymentSettings } from "../hooks/use-online-payment-settings";
import { UnsavedChangesStatus, useReportDirty } from "./unsaved-changes";
import { ActivateSubaccountDialog } from "@/features/online-payments";

const DEFAULT_EXPIRES = 1440;

const EXPIRES_OPTIONS = [
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "240", label: "4 horas" },
  { value: "1440", label: "24 horas (recomendado)" },
  { value: "2880", label: "2 dias" },
  { value: "4320", label: "3 dias" },
  { value: "10080", label: "7 dias" },
];

const schema = z.object({
  enabled: z.boolean(),
  pixKey: z.string().trim().max(77, "A chave Pix tem no máximo 77 caracteres."),
  defaultExpiresInMinutes: z.string().min(1, "Escolha a validade."),
  passFeeToCustomer: z.boolean(),
  passFeePix: z.boolean(),
  passFeeCard: z.boolean(),
});
type Values = z.infer<typeof schema>;

function toValues(s?: OnlinePaymentSettings): Values {
  const minutes = String(s?.defaultExpiresInMinutes ?? DEFAULT_EXPIRES);
  return {
    enabled: Boolean(s?.enabled),
    pixKey: s?.pixKey ?? "",
    defaultExpiresInMinutes: EXPIRES_OPTIONS.some((o) => o.value === minutes)
      ? minutes
      : String(DEFAULT_EXPIRES),
    passFeeToCustomer: Boolean(s?.passFeeToCustomer),
    passFeePix: Boolean(s?.passFeePix ?? s?.passFeeToCustomer),
    passFeeCard: Boolean(s?.passFeeCard ?? s?.passFeeToCustomer),
  };
}

const BENEFITS = [
  "Pix copia e cola e QR Code direto em Cobranças",
  "Link de pagamento para enviar pelo WhatsApp",
  "Pix Automático: a mensalidade é paga sozinha no vencimento",
] as const;

/**
 * Configurações → "Pagamento online": liga/desliga, subconta de recebimento
 * com split automático e validade padrão do Pix. Edita quem tem `finance:manage`.
 */
export function OnlinePaymentsSettingsCard({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const hasFeature = useHasFeature();
  const can = useCan();
  const orgQuery = useOrganization();

  if (!hasFeature("online_payments")) {
    return (
      <FeatureLocked
        title="Pagamento online"
        description="Cobre as mensalidades por Pix, link de pagamento e Pix Automático."
        benefits={BENEFITS}
        icon={<QrCode className="size-7" aria-hidden />}
        canManagePlan={can("subscription:manage")}
      />
    );
  }

  if (orgQuery.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (orgQuery.isError || !orgQuery.data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a configuração.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void orgQuery.refetch()}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <OnlinePaymentsForm
      key={`${orgQuery.data.id}-${orgQuery.data.settings?.onlinePayments?.gatewayStatus}`}
      organization={orgQuery.data}
      settings={orgQuery.data.settings?.onlinePayments}
      canEdit={can("finance:manage")}
      onDirtyChange={onDirtyChange}
    />
  );
}

function OnlinePaymentsForm({
  organization,
  settings,
  canEdit,
  onDirtyChange,
}: {
  organization: Organization;
  settings?: OnlinePaymentSettings;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [subaccountDialogOpen, setSubaccountDialogOpen] = useState(false);
  const update = useUpdateOnlinePaymentSettings();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toValues(settings),
  });
  const passFeeToCustomerWatched = useWatch({
    control: form.control,
    name: "passFeeToCustomer",
  });
  const dirty = form.formState.isDirty;
  useReportDirty(dirty, onDirtyChange);
  const pending = update.isPending;
  const disabled = pending || !canEdit;

  const isSubaccountActive = settings?.gatewayStatus === "approved";

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({
        enabled: values.enabled,
        pixKey: values.pixKey,
        defaultExpiresInMinutes: Number(values.defaultExpiresInMinutes),
        passFeeToCustomer: values.passFeeToCustomer,
        passFeePix: values.passFeePix,
        passFeeCard: values.passFeeCard,
      });
      toast.success(
        saved.enabled
          ? "Pagamento online salvo e ligado."
          : "Pagamento online salvo (desligado).",
      );
      form.reset(toValues(saved));
    } catch (error) {
      handleFormApiError(
        error,
        form,
        "Não foi possível salvar o pagamento online.",
      );
    }
  });

  return (
    <>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="size-4 text-primary" aria-hidden />
                Cobrança online & Recebimento
              </CardTitle>
              <CardDescription>
                Com a opção ligada, as cobranças ganham a ação &quot;Cobrar
                online&quot; (Pix ou link) e os alunos podem pagar com baixa automática.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Box de Subconta / Marketplace */}
              {isSubaccountActive ? (
                <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100">
                        Conta de recebimentos ativa
                      </p>
                      <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                        Taxa por transação ativa • R$ 1,29 no Pro ou R$ 1,99 no Free por pagamento recebido
                      </p>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300 shrink-0"
                  >
                    <Link href="/online-payments">
                      Abrir carteira e saques
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                      <Sparkles className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Ativar recebimentos online
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Receba por Pix e link com desconto automático da taxa (R$ 1,99 no Free ou R$ 1,29 no Pro).
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSubaccountDialogOpen(true)}
                    disabled={!canEdit}
                    className="shrink-0"
                  >
                    Ativar conta
                  </Button>
                </div>
              )}

              <SwitchField<Values>
                name="enabled"
                label="Cobrar online"
                hint="Habilita a geração de Pix, link de pagamento e Pix Automático neste espaço."
                disabled={disabled}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputText<Values>
                  name="pixKey"
                  label="Chave Pix para saque/identificação"
                  placeholder="E-mail, telefone ou chave aleatória"
                  hint="Chave Pix para onde seus valores serão transferidos."
                  disabled={disabled}
                />
                <SelectField<Values>
                  name="defaultExpiresInMinutes"
                  label="Validade padrão do Pix"
                  options={EXPIRES_OPTIONS}
                  clearable={false}
                  hint="Depois disso o código expira e é preciso gerar outro."
                  disabled={disabled}
                />
              </div>

              {/* Repasse de Taxas ao Aluno */}
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-start justify-between gap-4 py-1.5">
                  <div className="space-y-1">
                    <Label
                      htmlFor="passFeeToCustomer"
                      className="text-sm font-semibold text-foreground cursor-pointer"
                    >
                      Repassar taxas de cobrança ao aluno
                    </Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Emite os códigos Pix e links de cartão com a tarifa acrescida, garantindo que a sua academia receba <strong>100% do valor da mensalidade</strong> (custo zero).
                    </p>
                  </div>
                  <Controller
                    control={form.control}
                    name="passFeeToCustomer"
                    render={({ field }) => (
                      <Switch
                        id="passFeeToCustomer"
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                        disabled={disabled}
                        className="mt-0.5 shrink-0"
                      />
                    )}
                  />
                </div>

                {passFeeToCustomerWatched ? (
                  <div className="mt-3 ml-1 space-y-3 border-l-2 border-primary/30 pl-4 py-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="passFeePix"
                          className="text-xs font-medium text-foreground cursor-pointer"
                        >
                          Repassar no Pix (+ R$ 1,99 no Free ou R$ 1,29 no Pro)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Exemplo: mensalidade de R$ 150,00 → aluno paga R$ 151,99 e você recebe R$ 150,00 líquido.
                        </p>
                      </div>
                      <Controller
                        control={form.control}
                        name="passFeePix"
                        render={({ field }) => (
                          <Switch
                            id="passFeePix"
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                            disabled={disabled}
                            className="shrink-0"
                          />
                        )}
                      />
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="passFeeCard"
                          className="text-xs font-medium text-foreground cursor-pointer"
                        >
                          Repassar no Cartão (+ 2,99% + taxa por gross-up)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Exemplo: mensalidade de R$ 150,00 → link sai por R$ 156,67 e você recebe R$ 150,00 líquido.
                        </p>
                      </div>
                      <Controller
                        control={form.control}
                        name="passFeeCard"
                        render={({ field }) => (
                          <Switch
                            id="passFeeCard"
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                            disabled={disabled}
                            className="shrink-0"
                          />
                        )}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0 text-warning"
                  aria-hidden
                />
                <p>
                  No Pix Automático de verdade, o Banco Central exige{" "}
                  <strong>CNPJ ativo há pelo menos 6 meses</strong>.
                </p>
              </div>

              {!canEdit ? (
                <p className="text-xs text-muted-foreground">
                  Só o proprietário e o gerente alteram esta configuração.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {canEdit ? (
            <div className="flex items-center justify-between pt-2">
              <UnsavedChangesStatus dirty={dirty} />
              <Button type="submit" disabled={pending} className="min-w-36">
                {pending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 size-4" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </form>
      </FormProvider>

      <ActivateSubaccountDialog
        open={subaccountDialogOpen}
        onOpenChange={setSubaccountDialogOpen}
        organization={organization}
      />
    </>
  );
}
