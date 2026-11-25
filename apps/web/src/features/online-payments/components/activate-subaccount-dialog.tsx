"use client";

import { COMPANY_CNPJ, COMPANY_NAME } from "@/config/site";

import { useEffect, useState } from "react";
import { useForm, useWatch, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import {
  CreditCard,
  FileText,
  Info,
  QrCode,
  Receipt,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { Organization } from "@gestarahub/contracts";
import {
  AddressFields,
  DateField,
  InputCurrency,
  InputText,
  InputPhone,
  SelectField,
  DialogFormFooter,
  FieldShell,
  fieldAria,
} from "@/components/form";
import { useUnit } from "@/features/settings";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ASAAS_FEES, PLATFORM_SPLIT_CENTS, pixWithdrawalRuleText, platformSplitCents } from "@gestarahub/core/payment-fees";
import { formatCents } from "@gestarahub/core/format";
import { isValidCpfOrCnpj } from "@gestarahub/core/payer";
import { PERSON_ACCOUNT_NOTICE, showsPersonAccountNotice } from "../account-notice";
import { useSetupGatewaySubaccount } from "../hooks/use-online-payments";
import { useSubscriptionTier } from "@/features/auth";
import { FINANCE_EMAIL_HINT, NEW_ASAAS_ACCOUNT_NOTICE, announceAsaasAccess } from "./asaas-access-guide";
import { todayISO } from "@gestarahub/core/date";

function maskCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

const isCpf = (value: string) => value.replace(/\D/g, "").length === 11;

// O Asaas exige (POST /v3/accounts): nome, e-mail, CPF/CNPJ, celular, renda ou
// faturamento mensal e endereco (rua, numero, bairro, CEP); data de nascimento
// so para CPF e tipo de empresa so para CNPJ.
const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Informe a razão social ou nome do responsável."),
    email: z.string().trim().email("Informe um e-mail financeiro válido."),
    cpfCnpj: z
      .string()
      .trim()
      .refine((val) => isValidCpfOrCnpj(val), "Informe um CPF ou CNPJ válido. Confira os números."),
    birthDate: z.string().optional(),
    companyType: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]).optional(),
    mobilePhone: z.string().trim().min(8, "Informe o telefone com DDD."),
    incomeValueCents: z.number().int().min(100, "Informe o valor mensal aproximado."),
    address: z.object({
      postalCode: z
        .string()
        .trim()
        .refine((v) => v.replace(/\D/g, "").length === 8, "Informe o CEP."),
      street: z.string().trim().min(1, "Informe a rua."),
      number: z.string().trim().min(1, "Informe o número."),
      complement: z.string().trim().optional(),
      neighborhood: z.string().trim().min(1, "Informe o bairro."),
      city: z.string().trim().optional(),
      state: z.string().trim().optional(),
    }),
    termsAccepted: z.boolean().refine((val) => val === true, {
      message:
        "Você deve ler e aceitar os termos de intermediação e tarifas para continuar.",
    }),
  })
  .superRefine((data, ctx) => {
    if (isCpf(data.cpfCnpj)) {
      const birth = data.birthDate ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
        ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Informe a data de nascimento." });
      } else if (birth > todayISO()) {
        ctx.addIssue({ code: "custom", path: ["birthDate"], message: "A data não pode ser no futuro." });
      }
    } else if (data.cpfCnpj.replace(/\D/g, "").length === 14 && !data.companyType) {
      ctx.addIssue({ code: "custom", path: ["companyType"], message: "Selecione o tipo de empresa." });
    }
  });

type FormValues = z.infer<typeof schema>;

/** Campos do endereco do cadastro (o `AddressFields` com prefixo "address"). */
const ADDRESS_FIELDS = ["postalCode", "street", "number", "complement", "neighborhood", "city", "state"] as const;

interface ActivateSubaccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization;
}

export function ActivateSubaccountDialog({
  open,
  onOpenChange,
  organization,
}: ActivateSubaccountDialogProps) {
  const [showLegalTerms, setShowLegalTerms] = useState(false);
  const setup = useSetupGatewaySubaccount();
  const { data: unit } = useUnit();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: organization.name || "",
      email: "",
      cpfCnpj: "",
      birthDate: "",
      companyType: "LIMITED",
      mobilePhone: "",
      incomeValueCents: 0,
      address: {
        postalCode: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
      },
      termsAccepted: false,
    },
  });

  // Endereco da unidade (Configuracoes) ja preenche o do cadastro, se a pessoa
  // ainda nao mexeu nele.
  // Endereco antigo em texto livre nao serve: so o estruturado preenche.
  const unitAddress = typeof unit?.address === "object" ? unit.address : undefined;
  useEffect(() => {
    if (!unitAddress || form.getFieldState("address").isDirty) return;
    // O formulario existe antes da gaveta abrir (campos nao montados) e o
    // resetField so age em campo registrado: registra cada campo antes
    // (13/11/2026; sem isso o endereco quase nunca vinha preenchido).
    for (const field of ADDRESS_FIELDS) form.register(`address.${field}`);
    form.resetField("address", {
      defaultValue: {
        postalCode: unitAddress.postalCode ?? "",
        street: unitAddress.street ?? "",
        number: unitAddress.number ?? "",
        complement: unitAddress.complement ?? "",
        neighborhood: unitAddress.neighborhood ?? "",
        city: unitAddress.city ?? "",
        state: unitAddress.state ?? "",
      },
    });
  }, [unitAddress, form]);

  const cpfCnpjValue = useWatch({ control: form.control, name: "cpfCnpj" });
  const personKind =
    cpfCnpjValue.replace(/\D/g, "").length === 14 ? "company" : isCpf(cpfCnpjValue) ? "person" : null;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await setup.mutateAsync({
        organizationId: organization.id,
        name: values.name,
        email: values.email,
        cpfCnpj: values.cpfCnpj,
        birthDate: isCpf(values.cpfCnpj) ? values.birthDate : undefined,
        companyType: isCpf(values.cpfCnpj) ? undefined : values.companyType,
        mobilePhone: values.mobilePhone,
        incomeValue: values.incomeValueCents / 100,
        address: values.address.street,
        addressNumber: values.address.number,
        complement: values.address.complement || undefined,
        province: values.address.neighborhood,
        postalCode: values.address.postalCode,
      });

      if (!res.success) {
        const message = res.error || "Não foi possível ativar a conta.";
        // Erro que fala de um campo vai para o campo, com foco (o servidor ja devolve uma mensagem neutra).
        const field = res.field;
        if (field) {
          form.setError(field, { type: "server", message });
          requestAnimationFrame(() => form.setFocus(field));
        } else {
          toast.error(message);
        }
        return;
      }

      toast.success("Conta de recebimentos ativada com sucesso!");
      onOpenChange(false);
      // Passos de acesso ao Asaas (o pedido de proteger o acesso vem ao fechar).
      announceAsaasAccess(values.email.trim());
    } catch {
      toast.error("Erro inesperado ao ativar a conta de recebimentos.");
    }
  });

  // Aceite pendente ao enviar: caixa e cartao em vermelho, como no aviso dos termos.
  const termsError = Boolean(form.formState.errors.termsAccepted);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-lg"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold text-foreground">Ativar conta de recebimento</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Receba pagamentos com Pix e links, com baixa automática e repasse direto na sua conta.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <FormProvider {...form}>
            <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <DialogBody className="space-y-4">
                <p className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{NEW_ASAAS_ACCOUNT_NOTICE}</span>
                </p>
                <InputText<FormValues>
                  name="name"
                  label="Razão Social ou Nome do Titular"
                  required
                  disabled={setup.isPending}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Controller
                    control={form.control}
                    name="cpfCnpj"
                    render={({ field, fieldState }) => (
                      <FieldShell
                        id="cpfCnpj"
                        label="CPF ou CNPJ"
                        error={fieldState.error?.message}
                        required
                      >
                        <Input
                          id="cpfCnpj"
                          // ref e onBlur do RHF: erro ao enviar leva o foco para ca, como nos outros campos.
                          ref={field.ref}
                          name={field.name}
                          onBlur={field.onBlur}
                          inputMode="numeric"
                          autoComplete="off"
                          value={field.value}
                          onChange={(e) => {
                            field.onChange(maskCpfCnpj(e.target.value));
                          }}
                          disabled={setup.isPending}
                          {...fieldAria("cpfCnpj", fieldState.error?.message)}
                        />
                      </FieldShell>
                    )}
                  />
                  {/* CPF pede a data de nascimento; CNPJ, o tipo de empresa (regra do parceiro). */}
                  {personKind === "company" ? (
                    <SelectField<FormValues>
                      name="companyType"
                      label="Tipo de empresa"
                      options={[
                        { value: "MEI", label: "MEI" },
                        { value: "LIMITED", label: "LTDA (Sociedade Limitada)" },
                        { value: "INDIVIDUAL", label: "Empresário Individual" },
                        { value: "ASSOCIATION", label: "Associação" },
                      ]}
                      clearable={false}
                      required
                      disabled={setup.isPending}
                    />
                  ) : (
                    <DateField<FormValues>
                      name="birthDate"
                      label="Data de nascimento"
                      max={todayISO()}
                      required={personKind === "person"}
                      disabled={setup.isPending}
                    />
                  )}
                </div>
                {showsPersonAccountNotice(cpfCnpjValue) ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="person-account-notice">
                    {PERSON_ACCOUNT_NOTICE}
                  </p>
                ) : null}

                {/* Um por linha (25/11/2026): no drawer, o celular com o seletor de pais ficava espremido. */}
                <div className="space-y-4">
                  <InputText<FormValues>
                    name="email"
                    type="email"
                    label="E-mail financeiro"
                    hint={FINANCE_EMAIL_HINT}
                    required
                    disabled={setup.isPending}
                  />
                  <InputPhone<FormValues>
                    name="mobilePhone"
                    label="Celular / WhatsApp de contato"
                    placeholder=""
                    required
                    disabled={setup.isPending}
                  />
                </div>

                <InputCurrency<FormValues>
                  name="incomeValueCents"
                  label={personKind === "company" ? "Faturamento mensal" : "Renda mensal"}
                  hint="Valor aproximado. O parceiro de pagamentos usa para validar a conta."
                  required
                  disabled={setup.isPending}
                />

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Endereço</p>
                  {/* Cidade e UF saem do CEP; o cadastro do recebimento nao as envia. */}
                  <AddressFields<FormValues> prefix="address" required cityStateRequired={false} disabled={setup.isPending} />
                </div>

                {/* Taxas por forma de pagamento (01/11/2026): uma linha por forma, a taxa do plano atual, e quando o dinheiro chega. */}
                <FeeTable />

                {/* Termo de Aceite Jurídico Obrigatório */}
                <div
                  className={cn(
                    "space-y-2 rounded-lg border p-3 transition-colors",
                    termsError
                      ? "border-destructive bg-destructive/5 ring-1 ring-destructive/40"
                      : "border-border/90 bg-muted/30",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <Controller
                      control={form.control}
                      name="termsAccepted"
                      render={({ field }) => (
                        <Checkbox
                          id="termsAccepted"
                          checked={Boolean(field.value)}
                          onCheckedChange={field.onChange}
                          disabled={setup.isPending}
                          aria-invalid={termsError}
                          className={cn("mt-0.5", termsError && "border-destructive")}
                        />
                      )}
                    />
                    <div className="space-y-1 text-xs">
                      <label
                        htmlFor="termsAccepted"
                        className="cursor-pointer font-medium leading-tight text-foreground"
                      >
                        Declaro que li e concordo com os Termos de Intermediação e Pagamentos do GestaraHub
                      </label>
                      <p className="text-[11px] leading-normal text-muted-foreground">
                        Autorizo expressamente o GestaraHub a abrir a conta de recebimento na instituição parceira (Asaas I.P. S.A.) e a descontar automaticamente, de cada cobrança paga, a tarifa da instituição parceira e a taxa do GestaraHub (R$ 1,99 no plano grátis ou R$ 1,29 nos pagos).
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowLegalTerms(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <FileText className="size-3" />
                        Ler cláusulas contratuais completas (10 cláusulas)
                      </button>
                      {form.formState.errors.termsAccepted ? (
                        <p className="pt-1 text-[11px] font-medium text-destructive">
                          {form.formState.errors.termsAccepted.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </DialogBody>

              <DialogFormFooter
                isPending={setup.isPending}
                createLabel="Ativar recebimentos"
                className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
              />
            </form>
          </FormProvider>
        </SheetContent>
      </Sheet>

      {/* Modal de Detalhes dos Termos Jurídicos Completos */}
      <Dialog open={showLegalTerms} onOpenChange={setShowLegalTerms}>
        <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-14 text-left">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Scale className="size-5" />
              </div>
              <div>
                <DialogTitle>Termos de Intermediação e Tarifas de Pagamento</DialogTitle>
                <DialogDescription>
                  Condições contratuais para uso da infraestrutura de pagamentos online.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Cabecalho e rodape fixos; so as clausulas rolam, como no aviso dos termos de uso. */}
          <DialogBody className="text-xs leading-relaxed text-muted-foreground">
            {/* Box resumo de segurança */}
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-[11px] text-foreground">
              <p className="flex items-center gap-1.5 font-semibold text-primary">
                <Info className="size-4" />
                Resumo da Parceria Tecnológica
              </p>
              <p className="mt-1">
                O GestaraHub fornece exclusivamente a plataforma de software de gestão e intermediação tecnológica. Os serviços financeiros de custódia, processamento bancário e emissão de moeda eletrônica são executados pelo Asaas Gestão Financeira Instituição de Pagamento S.A., devidamente autorizado e regulamentado pelo Banco Central do Brasil.
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground">
                1. Mandato e Abertura de Conta de Recebimento
              </p>
              <p className="mt-0.5">
                O CONTRATANTE nomeia a {COMPANY_NAME}, inscrita no CNPJ {COMPANY_CNPJ}, titular da plataforma GestaraHub (&ldquo;GestaraHub&rdquo;), como procuradora tecnológica exclusiva para solicitar a abertura, configuração e integração da conta de recebimento em seu nome perante a instituição parceira (Asaas I.P. S.A.), com o propósito restrito de processar os pagamentos e mensalidades de seus alunos.
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground">
                2. Como Funciona a Tarifa (Divisão Automática de Valores)
              </p>
              <p className="mt-0.5">
                O CONTRATANTE autoriza expressamente que, no exato instante em que o pagamento for confirmado pela rede bancária, sejam retidas do valor recebido: (a) a tarifa da instituição parceira, conforme o meio de pagamento e a tabela vigente da sua conta (inclusive valores promocionais, quando houver); e (b) a taxa da plataforma GestaraHub, de R$ 1,99 por cobrança liquidada no plano grátis ou R$ 1,29 nos planos pagos. Ao gerar cada cobrança, o CONTRATANTE pode optar por repassar essas taxas ao aluno, que passa a pagar o valor acrescido.
              </p>
              <div className="mt-1.5 rounded-md bg-muted/60 p-2.5 text-[11px] text-foreground">
                <p className="font-medium">Exemplo prático de funcionamento:</p>
                <p className="mt-0.5 text-muted-foreground">
                  Quando um aluno paga uma mensalidade de R$ 150,00 via Pix no plano grátis, saem na hora a tarifa do parceiro (até R$ 1,99) e a taxa do GestaraHub (R$ 1,99), e pelo menos R$ 146,02 entram no saldo da sua conta, livres para você transferir via Pix quando quiser. Se você repassar as taxas ao aluno, ele paga o valor acrescido e você recebe os R$ 150,00. Você nunca precisará pagar boletos no fim do mês ou calcular tarifas manualmente.
                </p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-foreground">
                3. Custo Zero em Inadimplência ou Cancelamento
              </p>
              <p className="mt-0.5">
                Não há cobrança de taxa de adesão, mensalidade fixa de conta bancária ou tarifas sobre faturas emitidas que não venham a ser pagas, sejam canceladas ou expirem. As tarifas incidem estrita e exclusivamente sobre transações efetivamente liquidadas com sucesso.
              </p>
            </div>

            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
              <p className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                <ShieldAlert className="size-4" />
                4. Limitação de Responsabilidade, Bugs e Falhas de Terceiros
              </p>
              <p className="mt-1 text-[11px] text-amber-950/80 dark:text-amber-200/80">
                O GestaraHub atua como fornecedor de software e não como instituição financeira ou garantidora de crédito. A plataforma empenha seus melhores esforços técnicos, mas não se responsabiliza por indisponibilidades temporárias ou oscilações no Sistema de Pagamentos Brasileiro (Pix/BACEN), falhas de operadoras de telecomunicações, atrasos de compensação da instituição parceira (Asaas) ou eventuais instabilidades técnicas externas. Em caso de inconsistências técnicas de conciliação comprovadas, o GestaraHub atuará de boa-fé para auditar e regularizar os lançamentos. Em nenhuma hipótese o GestaraHub será responsável por lucros cessantes ou danos indiretos.
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground">
                5. Contestações de Pagamento (Chargebacks) e Estornos no Cartão
              </p>
              <p className="mt-0.5">
                O CONTRATANTE reconhece que contestações de compra (chargeback) promovidas por portadores de cartão de crédito decorrem da relação comercial entre o aluno e o CONTRATANTE. Em caso de chargeback ou cancelamento motivado por contestação do titular ou suspeita de fraude, o valor contestado e eventuais custos operacionais cobrados pelas adquirentes serão debitados da subconta do CONTRATANTE, eximindo o GestaraHub de qualquer responsabilidade financeira.
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground">
                6. Prevenção a Fraudes e Bloqueio Cautelar do Banco Central
              </p>
              <p className="mt-0.5">
                Em estrito cumprimento às normas do Banco Central do Brasil e de Prevenção à Lavagem de Dinheiro (PLD), a instituição parceira (Asaas) e/ou o GestaraHub reservam-se o direito de reter preventivamente valores ou suspender transações em caso de suspeita fundamentada de fraude, inconsistência cadastral grave ou ordem judicial, pelo prazo necessário para a apuração regulatória, sem que isso configure mora ou gere direito a indenização.
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground">
                7. Relação com os Alunos e Inexistência de Solidariedade Consumerista
              </p>
              <p className="mt-0.5">
                A prestação de serviços educacionais, esportivos ou de condicionamento físico ocorre exclusivamente entre o CONTRATANTE e seus respectivos alunos. O GestaraHub não possui qualquer vínculo civil, trabalhista ou de consumo com os alunos do CONTRATANTE. O CONTRATANTE compromete-se a isentar e manter o GestaraHub a salvo de quaisquer reclamações em órgãos de defesa do consumidor (PROCON) ou demandas judiciais promovidas por alunos.
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground">
                8. Privacidade e Proteção de Dados (LGPD - Lei nº 13.709/2018)
              </p>
              <p className="mt-0.5">
                O CONTRATANTE figura como CONTROLADOR dos dados de seus alunos. O GestaraHub e a instituição financeira parceira atuam na condição de OPERADORES técnicos, tratando dados cadastrais estritamente para a finalidade de emissão de cobrança, conciliação e liquidação financeira, em total conformidade com a Lei Geral de Proteção de Dados.
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground">
                9. Obrigações Tributárias e Emissão de Notas Fiscais (NFS-e)
              </p>
              <p className="mt-0.5">
                O CONTRATANTE é o único e integral responsável pelo recolhimento de tributos de sua atividade e pela emissão de notas fiscais de prestação de serviços (NFS-e) aos seus alunos sobre o valor bruto das mensalidades. O GestaraHub emitirá nota fiscal de serviços de tecnologia exclusivamente referente às taxas de intermediação retidas.
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground">
                10. Titularidade dos Recursos, Saques via Pix e Rescisão
              </p>
              <p className="mt-0.5">
                Os recursos líquidos recebidos pertencem exclusivamente ao CONTRATANTE e podem ser transferidos via Pix a qualquer momento para a conta bancária do titular cadastrado. A instituição parceira não cobra as primeiras transferências Pix de cada mês (hoje, 30) e aplica a tarifa da tabela vigente da conta às demais (hoje, R$ 2,00 por transferência). O CONTRATANTE pode desativar a cobrança online a qualquer tempo sem multas rescisórias, desde que liquidadas eventuais pendências de chargebacks ou saldo devedor.
              </p>
            </div>
          </DialogBody>

          <div className="shrink-0 border-t border-border/40 bg-background p-6 pt-4">
            <Button
              type="button"
              className="w-full"
              onClick={() => setShowLegalTerms(false)}
            >
              Entendido, fechar termos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function percentLabel(fraction: number): string {
  return `${(fraction * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/**
 * Taxas por forma de pagamento: tarifa do parceiro (a cheia, sem promocao) e a
 * taxa do GestaraHub do plano atual, so descontadas quando o aluno paga.
 */
function FeeTable() {
  const tier = useSubscriptionTier();
  const platformFee = formatCents(platformSplitCents(tier));
  const rows = [
    {
      icon: <QrCode className="size-4 text-emerald-600 dark:text-emerald-400" />,
      method: "Pix",
      detail: "Dinâmico e automático",
      partner: `até ${formatCents(ASAAS_FEES.pix.fixedCents)}`,
      when: "Na hora",
    },
    {
      icon: <CreditCard className="size-4 text-sky-600 dark:text-sky-400" />,
      method: "Cartão de crédito",
      detail: "Pelo link de pagamento",
      partner: `até ${percentLabel(ASAAS_FEES.creditCard.percent)} + ${formatCents(ASAAS_FEES.creditCard.fixedCents)}`,
      when: "Em 32 dias",
    },
  ];
  return (
    <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3.5 text-xs text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 pb-2">
        <span className="flex items-center gap-1.5 font-semibold text-primary">
          <Receipt className="size-4" />
          Taxas por forma de pagamento
        </span>
        <span className="text-[11px] text-muted-foreground">Só quando o aluno paga</span>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            <th scope="col" className="pb-1.5 text-left font-medium">Forma</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Parceiro</th>
            <th scope="col" className="pb-1.5 text-right font-medium">GestaraHub</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Recebe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((row) => (
            <tr key={row.method}>
              <td className="py-2 pr-2">
                <span className="flex items-center gap-2">
                  {row.icon}
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{row.method}</span>
                    <span className="block text-[10px] text-muted-foreground">{row.detail}</span>
                  </span>
                </span>
              </td>
              <td className="py-2 pl-2 text-right font-semibold whitespace-nowrap tabular-nums">{row.partner}</td>
              <td className="py-2 pl-2 text-right font-semibold whitespace-nowrap tabular-nums">{platformFee}</td>
              <td className="py-2 pl-2 text-right whitespace-nowrap text-muted-foreground">{row.when}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-border/50 bg-background/60 px-3 py-2 text-[11px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Zap className="size-3.5 text-amber-500" />
          Transferência Pix para o seu banco
        </span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{pixWithdrawalRuleText()}</span>
      </div>

      <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
        <li>
          Taxa do GestaraHub do seu plano:{" "}
          {tier === "free"
            ? `${formatCents(PLATFORM_SPLIT_CENTS.free)} no Grátis; ${formatCents(PLATFORM_SPLIT_CENTS.pro)} nos planos pagos.`
            : `${platformFee} (no Grátis seria ${formatCents(PLATFORM_SPLIT_CENTS.free)}).`}
        </li>
        <li>Sem mensalidade nem adesão. Cobrança não paga ou cancelada não custa nada.</li>
        <li>A tarifa do parceiro é a cheia; contas novas costumam ter promoção. A prévia de cada cobrança mostra o líquido, e você pode repassar as taxas ao aluno.</li>
      </ul>
    </div>
  );
}
