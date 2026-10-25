"use client";

import { acceptedMethodsOf, defaultPassFeeFor } from "@gestarahub/core/payment-fees";
import { useState } from "react";
import { useForm, FormProvider, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import {
  FileText,
  Info,
  Loader2,
  Save,
  ShieldCheck,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { handleFormApiError } from "@/lib/form-errors";
import { useUpdateOnlinePaymentSettings } from "../hooks/use-online-payments";
import { ActivateSubaccountDialog } from "./activate-subaccount-dialog";

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
  acceptPix: z.boolean(),
  acceptCard: z.boolean(),
  acceptBoleto: z.boolean(),
  passFeeToCustomer: z.boolean(),
  passFeePix: z.boolean(),
  passFeeCard: z.boolean(),
  passFeeBoleto: z.boolean(),
  passFeeChoice: z.boolean(),
}).refine((v) => v.acceptPix || v.acceptCard || v.acceptBoleto, {
  path: ["acceptPix"],
  message: "Deixe ao menos uma forma de pagamento ligada.",
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
    acceptPix: acceptedMethodsOf(s).pix,
    acceptCard: acceptedMethodsOf(s).card,
    acceptBoleto: acceptedMethodsOf(s).boleto,
    passFeeToCustomer: Boolean(s?.passFeeToCustomer),
    passFeePix: defaultPassFeeFor(s, "pix"),
    passFeeCard: defaultPassFeeFor(s, "link"),
    passFeeBoleto: defaultPassFeeFor(s, "boleto"),
    passFeeChoice: defaultPassFeeFor(s, "choice"),
  };
}

interface OnlinePaymentsSettingsTabProps {
  organization: Organization;
  settings?: OnlinePaymentSettings;
  canManage: boolean;
}

export function OnlinePaymentsSettingsTab({
  organization,
  settings,
  canManage,
}: OnlinePaymentsSettingsTabProps) {
  const [termsOpen, setTermsOpen] = useState(false);
  const update = useUpdateOnlinePaymentSettings();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(settings),
  });

  const passFeeToCustomerWatched = useWatch({
    control: form.control,
    name: "passFeeToCustomer",
  });
  const [acceptPix, acceptCard, acceptBoleto] = useWatch({
    control: form.control,
    name: ["acceptPix", "acceptCard", "acceptBoleto"],
  });

  const dirty = form.formState.isDirty;
  const pending = update.isPending;
  const disabled = pending || !canManage;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({
        enabled: values.enabled,
        pixKey: values.pixKey,
        defaultExpiresInMinutes: Number(values.defaultExpiresInMinutes),
        acceptedMethods: { pix: values.acceptPix, card: values.acceptCard, boleto: values.acceptBoleto },
        passFeeToCustomer: values.passFeeToCustomer,
        passFeePix: values.passFeePix,
        passFeeCard: values.passFeeCard,
        passFeeBoleto: values.passFeeBoleto,
        passFeeChoice: values.passFeeChoice,
      });
      toast.success(
        saved.enabled
          ? "Configurações salvas e cobrança online ativada."
          : "Configurações salvas (cobrança online desativada).",
      );
      form.reset(toValues(saved));
    } catch (error) {
      handleFormApiError(
        error,
        form,
        "Não foi possível salvar as configurações de pagamento.",
      );
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-4">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Parâmetros de Cobrança Online
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Defina como os códigos Pix e links de pagamento funcionam para seus alunos.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-4 shrink-0" />
                <span className="font-medium">Conta ativa</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-0">
            {/* Toggle de Ativação Geral */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5">
              <SwitchField<Values>
                name="enabled"
                label="Habilitar cobranças online"
                hint="Permite que as cobranças ganhem o botão 'Cobrar online' para gerar Pix ou link de cartão."
                disabled={disabled}
              />
            </div>

            {/* Campos Principais sem poluição */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputText<Values>
                name="pixKey"
                label="Chave Pix para saque"
                hint="Chave para onde seus valores serão transferidos."
                disabled={disabled}
              />
              <SelectField<Values>
                name="defaultExpiresInMinutes"
                label="Validade padrão do Pix"
                options={EXPIRES_OPTIONS}
                clearable={false}
                hint="Tempo para expiração do QR Code gerado."
                disabled={disabled}
              />
            </div>

            {/* Formas de pagamento aceitas */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Formas de pagamento</p>
                <p className="text-xs text-muted-foreground">
                  O que aparece em Cobrar online. Com as três ligadas, surge também &quot;O aluno escolhe&quot;.
                </p>
              </div>
              {(
                [
                  { name: "acceptPix", label: "Pix", hint: "QR Code e copia e cola. Cai na hora." },
                  { name: "acceptCard", label: "Cartão", hint: "Link com cartão de crédito ou débito." },
                  { name: "acceptBoleto", label: "Boleto", hint: "Compensa em 1 dia útil." },
                ] as const
              ).map((opt) => (
                <div key={opt.name} className="flex items-start justify-between gap-4 py-1">
                  <div className="space-y-0.5">
                    <Label htmlFor={opt.name} className="text-xs font-medium text-foreground cursor-pointer">
                      {opt.label}
                    </Label>
                    <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
                  </div>
                  <Controller
                    control={form.control}
                    name={opt.name}
                    render={({ field }) => (
                      <Switch
                        id={opt.name}
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                        disabled={disabled}
                        className="shrink-0"
                      />
                    )}
                  />
                </div>
              ))}
              {form.formState.errors.acceptPix ? (
                <p className="text-xs text-destructive">{form.formState.errors.acceptPix.message}</p>
              ) : null}
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
                    O aluno paga as taxas (Asaas e GestaraHub) e você recebe o valor da cobrança. Dá para mudar em cada cobrança.
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
                  {(
                    [
                      { name: "passFeePix", label: "No Pix", hint: "Acréscimo fixo das taxas.", show: acceptPix },
                      { name: "passFeeCard", label: "No cartão", hint: "Cobre as taxas do crédito, as maiores.", show: acceptCard },
                      { name: "passFeeBoleto", label: "No boleto", hint: "Cobre a maior taxa entre boleto e Pix.", show: acceptBoleto },
                      {
                        name: "passFeeChoice",
                        label: "Quando o aluno escolhe",
                        hint: "Cobre a maior taxa entre as formas.",
                        show: acceptPix && acceptCard && acceptBoleto,
                      },
                    ] as const
                  )
                    .filter((opt) => opt.show)
                    .map((opt) => (
                      <div key={opt.name} className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <Label htmlFor={opt.name} className="text-xs font-medium text-foreground cursor-pointer">
                            {opt.label}
                          </Label>
                          <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
                        </div>
                        <Controller
                          control={form.control}
                          name={opt.name}
                          render={({ field }) => (
                            <Switch
                              id={opt.name}
                              checked={Boolean(field.value)}
                              onCheckedChange={field.onChange}
                              disabled={disabled}
                              className="shrink-0"
                            />
                          )}
                        />
                      </div>
                    ))}
                </div>
              ) : null}
            </div>

            {/* Aviso Discreto sobre Pix Automático */}
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0 text-muted-foreground" />
              <span>
                Para o Pix Automático no vencimento, o Banco Central exige CNPJ ativo há pelo menos 6 meses.
              </span>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border/50 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setTermsOpen(true)}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground -ml-2 sm:ml-0"
            >
              <FileText className="size-3.5" />
              Ver termos e taxas contratadas
            </Button>

            {canManage ? (
              <Button
                type="submit"
                disabled={pending || !dirty}
                className="gap-2 w-full sm:w-auto"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    Salvar alterações
                  </>
                )}
              </Button>
            ) : null}
          </CardFooter>
        </Card>

        <ActivateSubaccountDialog
          open={termsOpen}
          onOpenChange={setTermsOpen}
          organization={organization}
        />
      </form>
    </FormProvider>
  );
}
