"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  FlaskConical,
  Loader2,
  QrCode,
  Save,
} from "lucide-react";
import type { OnlinePaymentSettings } from "@gestarahub/contracts";
import { InputText, SelectField, SwitchField } from "@/components/form";
import { Button } from "@/components/ui/button";
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
});
type Values = z.infer<typeof schema>;

function toValues(s?: OnlinePaymentSettings): Values {
  const minutes = String(s?.defaultExpiresInMinutes ?? DEFAULT_EXPIRES);
  return {
    enabled: Boolean(s?.enabled),
    pixKey: s?.pixKey ?? "",
    // Valor gravado fora da lista (ex.: pela API) cai no padrao.
    defaultExpiresInMinutes: EXPIRES_OPTIONS.some((o) => o.value === minutes)
      ? minutes
      : String(DEFAULT_EXPIRES),
  };
}

const BENEFITS = [
  "Pix copia e cola e QR Code direto das Mensalidades",
  "Link de pagamento para enviar pelo WhatsApp",
  "Pix Automático: a mensalidade é paga sozinha no vencimento",
] as const;

/**
 * Configuracoes → "Pagamento online" (simulado): liga/desliga, chave Pix de
 * demonstracao e validade padrao do Pix. Edita quem tem `finance:manage`;
 * sem o recurso do plano mostra o upsell.
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
            size="sm"
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
      key={orgQuery.data.id}
      settings={orgQuery.data.settings?.onlinePayments}
      canEdit={can("finance:manage")}
      onDirtyChange={onDirtyChange}
    />
  );
}

function OnlinePaymentsForm({
  settings,
  canEdit,
  onDirtyChange,
}: {
  settings?: OnlinePaymentSettings;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const update = useUpdateOnlinePaymentSettings();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toValues(settings),
  });
  const dirty = form.formState.isDirty;
  useReportDirty(dirty, onDirtyChange);
  const pending = update.isPending;
  const disabled = pending || !canEdit;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({
        enabled: values.enabled,
        pixKey: values.pixKey,
        defaultExpiresInMinutes: Number(values.defaultExpiresInMinutes),
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
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="size-4 text-primary" aria-hidden />
              Cobrança online
            </CardTitle>
            <CardDescription>
              Com a opção ligada, as Mensalidades ganham a ação &quot;Cobrar
              online&quot; (Pix ou link) e os alunos podem autorizar o Pix
              Automático.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="flex items-start gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              <FlaskConical
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden
              />
              Demonstração: nenhum banco é chamado e nenhum dinheiro é
              movimentado. Os códigos gerados são fictícios.
            </p>

            <SwitchField<Values>
              name="enabled"
              label="Cobrar online"
              hint="Liga o Pix, o link de pagamento e o Pix Automático para esta academia."
              disabled={disabled}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputText<Values>
                name="pixKey"
                label="Chave Pix (simulada)"
                placeholder="E-mail, telefone ou chave aleatória"
                hint="Aparece no código de demonstração. Sem chave, usamos uma de exemplo."
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

            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
              <AlertTriangle
                className="mt-0.5 size-3.5 shrink-0 text-warning"
                aria-hidden
              />
              <p>
                No Pix Automático de verdade, o banco exige{" "}
                <strong>CNPJ ativo há pelo menos 6 meses</strong>. Nesta
                demonstração não há essa checagem.
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
  );
}
