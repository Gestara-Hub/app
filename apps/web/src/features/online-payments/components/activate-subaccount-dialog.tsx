"use client";

import { useState } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
  InputText,
  InputPhone,
  SelectField,
  DialogFormFooter,
  FieldShell,
  fieldAria,
} from "@/components/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSetupGatewaySubaccount } from "../hooks/use-online-payments";

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

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe a razão social ou nome do responsável."),
  email: z.string().trim().email("Informe um e-mail financeiro válido."),
  cpfCnpj: z
    .string()
    .trim()
    .refine((val) => {
      const digits = val.replace(/\D/g, "");
      return digits.length === 11 || digits.length === 14;
    }, "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido."),
  companyType: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]),
  mobilePhone: z.string().trim().min(8, "Informe o telefone com DDD."),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message:
      "Você deve ler e aceitar os termos de intermediação e tarifas para continuar.",
  }),
});

type FormValues = z.infer<typeof schema>;

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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: organization.name || "",
      email: "",
      cpfCnpj: "",
      companyType: "LIMITED",
      mobilePhone: "",
      termsAccepted: false,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await setup.mutateAsync({
        organizationId: organization.id,
        name: values.name,
        email: values.email,
        cpfCnpj: values.cpfCnpj,
        companyType: values.companyType,
        mobilePhone: values.mobilePhone,
      });

      if (!res.success) {
        toast.error(res.error || "Não foi possível ativar a conta.");
        return;
      }

      toast.success("Conta de recebimentos ativada com sucesso!");
      onOpenChange(false);
    } catch {
      toast.error("Erro inesperado ao ativar a conta de recebimentos.");
    }
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <DialogTitle>Ativar conta de recebimento</DialogTitle>
                <DialogDescription>
                  Receba pagamentos com Pix e links, com baixa automática e repasse direto na sua conta.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <FormProvider {...form}>
            <form onSubmit={onSubmit} noValidate className="space-y-4 pt-1">
              <InputText<FormValues>
                name="name"
                label="Razão Social ou Nome do Titular"
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
                <SelectField<FormValues>
                  name="companyType"
                  label="Tipo de Empresa"
                  options={[
                    { value: "MEI", label: "MEI" },
                    { value: "LIMITED", label: "LTDA (Sociedade Limitada)" },
                    { value: "INDIVIDUAL", label: "Empresário Individual" },
                    { value: "ASSOCIATION", label: "Associação" },
                  ]}
                  clearable={false}
                  disabled={setup.isPending}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InputText<FormValues>
                  name="email"
                  type="email"
                  label="E-mail financeiro"
                  disabled={setup.isPending}
                />
                <InputPhone<FormValues>
                  name="mobilePhone"
                  label="Celular / WhatsApp de contato"
                  placeholder=""
                  disabled={setup.isPending}
                />
              </div>

              {/* Quadro detalhado de taxas por modalidade */}
              <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3.5 text-xs text-foreground">
                <div className="flex items-center justify-between border-b border-primary/15 pb-2">
                  <span className="flex items-center gap-1.5 font-semibold text-primary">
                    <Receipt className="size-4" />
                    Tabela de Taxas por Modalidade
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Descontadas apenas quando o aluno paga
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Modalidade Pix */}
                  <div className="rounded-md border border-border/80 bg-card/90 p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QrCode className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="font-medium text-foreground">
                            Pix Dinâmico e Pix Automático
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Disponibilidade imediata (D+0 na sua conta)
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-sm font-bold text-foreground">
                            R$ 1,99
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            (Plano Free)
                          </span>
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <Badge
                            variant="secondary"
                            className="h-3.5 px-1 text-[9px] font-semibold text-primary"
                          >
                            Plano Pro: R$ 1,29
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Modalidade Cartão de Crédito via Link */}
                  <div className="rounded-md border border-border/80 bg-card/90 p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="size-4 text-sky-600 dark:text-sky-400" />
                        <div>
                          <p className="font-medium text-foreground">
                            Cartão de Crédito (Link de Pagamento)
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Recebimento em 30 dias (D+30)
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">
                          2,99% + taxa por cobrança
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          à vista no crédito
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Transferência / Saque */}
                  <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/60 px-3 py-2 text-[11px]">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Zap className="size-3.5 text-amber-500" />
                      Transferência Pix para sua conta bancária:
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Grátis (R$ 0,00)
                    </span>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  • <strong>Sem surpresas:</strong> você só paga quando receber do aluno. Não há mensalidade de gateway, não há taxa de adesão e cobranças não pagas ou canceladas têm custo zero.
                </p>
              </div>

              {/* Termo de Aceite Jurídico Obrigatório */}
              <div className="space-y-2 rounded-lg border border-border/90 bg-muted/30 p-3">
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
                        className="mt-0.5"
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
                      Autorizo expressamente o GestaraHub a abrir a conta de recebimento na instituição parceira (Asaas I.P. S.A.) e a descontar automaticamente a taxa por cobrança paga (R$ 1,99 no Free ou R$ 1,29 no Pro).
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

              <DialogFormFooter
                isPending={setup.isPending}
                createLabel="Ativar recebimentos"
              />
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes dos Termos Jurídicos Completos */}
      <Dialog open={showLegalTerms} onOpenChange={setShowLegalTerms}>
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
          <DialogHeader>
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

          <div className="space-y-4 pt-2 text-xs leading-relaxed text-muted-foreground">
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
                O CONTRATANTE nomeia o GestaraHub como procurador tecnológico exclusivo para solicitar a abertura, configuração e integração da conta de recebimento em seu nome perante a instituição parceira (Asaas I.P. S.A.), com o propósito restrito de processar os pagamentos e mensalidades de seus alunos.
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground">
                2. Como Funciona a Tarifa (Divisão Automática de Valores)
              </p>
              <p className="mt-0.5">
                O CONTRATANTE autoriza expressamente o desconto da taxa da plataforma (R$ 1,99 no plano Free ou R$ 1,29 no plano Pro por transação liquidada) no exato instante em que o pagamento for confirmado pela rede bancária.
              </p>
              <div className="mt-1.5 rounded-md bg-muted/60 p-2.5 text-[11px] text-foreground">
                <p className="font-medium">Exemplo prático de funcionamento:</p>
                <p className="mt-0.5 text-muted-foreground">
                  Quando um aluno paga uma mensalidade de R$ 150,00 via Pix, a taxa é deduzida na hora pelo sistema bancário e todo o restante do valor líquido entra imediatamente no saldo da sua conta, livre para você transferir via Pix quando quiser. Você nunca precisará pagar boletos no fim do mês ou calcular tarifas manualmente.
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
                Os recursos líquidos recebidos pertencem exclusivamente ao CONTRATANTE e podem ser transferidos via Pix a qualquer momento para a conta bancária do titular cadastrado, sem tarifas de transferência. O CONTRATANTE pode desativar a cobrança online a qualquer tempo sem multas rescisórias, desde que liquidadas eventuais pendências de chargebacks ou saldo devedor.
              </p>
            </div>
          </div>

          <div className="pt-2">
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
