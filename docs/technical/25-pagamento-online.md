# 25 — Pagamento online dos alunos (Pix, link e Pix Automático)

Data: 2026-10-24 (extraído do doc 05, seção 6, de 27/09/2026). Status: Feito (o Asaas real entrou depois; o simulado segue na demonstração e no e2e).
Código: `apps/web/src/services/payments/` (porta e adaptadores), `services/onlinePayments/`, `features/online-payments`, `lib/asaas/`, `app/api/webhooks/asaas/route.ts`.
Testes: `services/__tests__/online-payments.test.ts`, `services/onlinePayments/__tests__/`, `services/payments/__tests__/`.

> Sobre o Asaas: [`../guides/14-asaas-mcp.md`](../guides/14-asaas-mcp.md) (consulta da doc pelo assistente), [`../product/19-levantamento-pagamentos.md`](../product/19-levantamento-pagamentos.md) (levantamento dos fluxos). O que cada parte cobra e a regra das mensalidades: [`../product/15-regras-de-cobranca.md`](../product/15-regras-de-cobranca.md) e [doc 02](02-motor-de-cobranca.md). O financeiro do espaço está no [doc 05](05-modulo-financeiro.md) e o plano GestaraHub no [doc 24](24-plano-gestarahub.md).

## 1. O que simula

Nesta fase não há gateway real. Um **adaptador** isola o provedor, para trocar pelo real depois:

```ts
// apps/web/src/services/payments/paymentGateway.ts
export interface PaymentGateway {
  createPix(input: { chargeId: Id; amountCents: number; expiresInMinutes: number }): Promise<PixPayment>;
  createLink(input: { chargeId: Id; amountCents: number }): Promise<PaymentLinkPayment>;
  requestRecurringAuthorization(input: { studentId: Id; maxAmountCents: number }): Promise<RecurringAuthorization>;
}
export const mockPaymentGateway: PaymentGateway; // gera códigos fictícios, sem rede
```

## 2. Contrato

```ts
export type OnlinePaymentMethod = "pix" | "link";
export type OnlinePaymentStatus = "awaiting" | "paid" | "expired" | "canceled";

export interface OnlinePayment {
  id: Id;
  chargeId: Id;
  method: OnlinePaymentMethod;
  amountCents: number;
  status: OnlinePaymentStatus;
  pixCopyPaste?: string;     // "copia e cola" fictício
  linkUrl?: string;          // link fictício (página de demonstração)
  expiresAt: DateTimeISO;
  paidAt?: DateTimeISO;
  createdAt: DateTimeISO;
}

export type RecurringAuthorizationStatus = "pending" | "active" | "revoked";

/** Pix Automático: autorização do aluno para débito recorrente da mensalidade. */
export interface RecurringAuthorization {
  id: Id;
  organizationId: Id;
  studentId: Id;
  maxAmountCents: number;
  status: RecurringAuthorizationStatus;
  authorizedAt?: DateTimeISO;
  revokedAt?: DateTimeISO;
  createdAt: DateTimeISO;
}

export interface OnlinePaymentSettings {   // em OrganizationSettings
  enabled: boolean;
  pixKey?: string;           // exibida como dado da academia (simulado)
  defaultExpiresInMinutes?: number; // padrão 1440 (24 h)
}
```

`Charge` ganha `paidVia?: "manual" | "online" | "recurring"`, para saber como foi pago.

## 3. Fluxos

- **Cobrar online** (menu da cobrança em Mensalidades): escolhe Pix ou Link. Mostra o código copia-e-cola, um QR ilustrativo e o link, com botão **"Copiar"** e **"Enviar pelo WhatsApp"** (abre `wa.me` com a mensagem pronta; o envio automático fica para o módulo Comunicação).
- **Simular pagamento (demonstração):** botão visível só na demo, que marca o `OnlinePayment` como pago e a cobrança como `paid` com `method = "pix"` e `paidVia = "online"`.
- **Expiração:** `awaiting` com `expiresAt` passado vira `expired` na leitura. Pode gerar um novo.
- **Pix Automático:** no cadastro ou detalhe do aluno, **"Solicitar Pix Automático"** cria a autorização `pending`, e **"Simular autorização"** a ativa. Com autorização `active`, as mensalidades do aluno **com vencimento até hoje** são marcadas pagas na leitura, com `paidVia = "recurring"`, desde que o valor seja ≤ `maxAmountCents`. Acima do limite, fica pendente e mostra um aviso.
- **Requisito real, registrado para o futuro:** o Pix Automático exige CNPJ ativo há pelo menos 6 meses. Na demonstração não há checagem; a tela de configuração mostra o aviso.

## 4. Regras

- Só cobranças `pending` ou `overdue` podem ser cobradas online. Pagar manualmente cancela os `OnlinePayment` em aberto da cobrança.
- Cancelar a cobrança cancela os `OnlinePayment` dela.
- **Baixa pela rotina também vai à Auditoria (01/11/2026).** Quando a rotina de expiração encontra o pagamento já pago no Asaas e dá a baixa antes de o webhook chegar (`settlePaidAtGateway`), registra o mesmo evento do webhook ("Parceiro de pagamentos confirmou..."); antes só o webhook registrava, e o webhook que chegava depois via a cobrança já paga e não escrevia nada.
- **Erro do parceiro na ativação não chega cru à tela (01/11/2026).** `setupSubaccountAction` registra a frase do Asaas no registro de erros e devolve `{ error, field }` com mensagem neutra ("Não foi possível usar este e-mail. Informe outro e-mail financeiro.", "Confira o CPF ou CNPJ."): a frase original ("o e-mail X já está em uso") confirmava a um invasor que aquele e-mail tem conta no parceiro. O diálogo mostra a mensagem no campo indicado e foca nele.
- Desfazer o pagamento de uma cobrança paga online **não é permitido** na demonstração (seria estorno). **[DECIDIR]**
- **Conta real nunca recebe código de demonstração** (23/10/2026, achado 56). Se o parceiro falhar, a conta real recebe uma mensagem de erro e nada é gravado. Só o espaço de demonstração e o servidor do e2e caem no Pix simulado (`allowDemo` em `paymentGateway`, `services/payments/paymentGateway.ts`).
- **Pix logo depois de ativar a conta de recebimento:** a subconta nova não tem chave Pix, e o Asaas só cria uma temporária na primeira cobrança: o primeiro QR falhava ("Você não possui uma chave Pix cadastrada") e só o segundo saía (visto em 01/11/2026).
  - Na ativação, depois das tarifas e do webhook, `ensureSubaccountPixKey` (`services/onlinePayments/gatewaySetup.ts`) cria uma chave aleatória (EVP, a única que a API aceita) se a subconta não tem nenhuma; falhar aqui não desfaz a ativação.
  - Na hora do Pix, se o QR falha por falta de chave, `asaasAdapter.createPix` cria a chave e pede o QR de novo uma vez. Só se ainda falhar a cobrança é cancelada no Asaas (não fica órfã) e a tela mostra "A conta ainda está liberando o Pix. Tente de novo em alguns minutos." (`PixNotReadyError`).
  - Outro erro na busca do QR também cancela a cobrança no parceiro, sem tentar criar chave.
  - Limites do Asaas: uma chave por minuto, 5 por conta PF e 20 por PJ (`POST /v3/pix/addressKeys`).
- **"Simular liquidação (Sandbox)" não é um pagamento de verdade** (01/11/2026, decidido manter assim). O botão pede ao Asaas um recebimento em dinheiro (`receiveInCash`, em `simulateOnlinePaidAction`): sem tarifa (o líquido volta igual ao bruto e o extrato mostra "Tarifa do Asaas: não registrada"), sem crédito no saldo da subconta (disponível para saque fica zerado) e liberado na hora até no cartão. Em produção o botão não existe e o webhook grava a tarifa real. Se um dia for preciso ver tarifa e saldo no sandbox, o Asaas tem `POST /v3/sandbox/payment/{id}/confirm`, que confirma a cobrança como um pagamento real.
- **No Financeiro, a taxa que ficou com o espaço sai numa linha própria** (01/11/2026): a cobrança entra cheia e "Taxas de pagamento online" sai no dia do pagamento (doc 05 §4.3); o DRE mostra o mesmo valor em "Deduções".
- **Taxa do GestaraHub só quando o parceiro a retém** (31/10/2026, decisão 4 do diário da noite, confirmada pelo usuário). Com o Asaas e sem `ASAAS_MASTER_WALLET_ID`, não há split: a taxa é zero, não entra no valor repassado ao aluno nem sai do líquido do espaço. Um ponto só decide isso no servidor, `effectivePlatformSplitCents` (`services/payments/platformSplit.ts`), usado por "Cobrar online", pelo checkout, pela fatura gerada e pela página pública. Sem o Asaas (demonstração e e2e), o provedor de demonstração segue simulando a taxa.

## 7. Fatura Pública e Autoatendimento do Aluno (/p/c/:id)

- Quando uma cobrança em aberto não possui pagamento online gerado previamente e o espaço possui Recebimentos Online ativo (`onlinePayments.enabled = true`), os lembretes automáticos e manuais de cobrança enviam o link da fatura do GestaraHub: `/p/c/:chargeId`.
- **Quem paga e o CPF** (`services/server/chargeInvoiceActions.ts`; a página é aberta sem login, por quem tiver o link):
  - Com CPF válido no cadastro (do aluno, ou do responsável financeiro se for menor), a página mostra as formas aceitas pelo espaço.
  - Adulto sem CPF no cadastro: a página pede um CPF válido, que **vale só para esta cobrança**. Não é gravado no cadastro (corrigido em 30/10/2026: antes gravava sem login).
  - Aluno menor sem responsável financeiro: a página pede ao espaço para cadastrar o responsável (a mesma regra do "Cobrar online").
  - Só as formas ligadas em Recebimentos online.
- **Um código válido por vez:** ao gerar um novo, os códigos em aberto da cobrança são cancelados também no Asaas (senão o antigo ainda poderia ser pago); falha no Asaas fica marcada para a rotina de hora em hora tentar de novo. Se o código novo não for gravado no banco, ele é cancelado no Asaas, para não ficar órfão.
- **Dados mascarados (decisão do usuário, 30/10/2026):** o servidor manda só o nome mascarado do aluno e de quem paga ("Ana S. L.") e o CPF mascarado ("***.982.247-**"), como em toda rota pública (doc `product/24` §6).
- **Cálculo de Tarifas e Repasse:** Os valores por método consideram a taxa do gateway e split do GestaraHub, calculando o acréscimo se o repasse de taxas estiver configurado.
- **Emissão na hora:**
  - **Pix:** Gera o QR Code com código Copia e Cola na hora e ativa verificação em tempo real (polling) para confirmar o pagamento assim que quitado.
  - **Cartão / Boleto:** Redireciona o pagador para o checkout seguro do parceiro.
- **Espaço sem recebimento online:** Se a subconta estiver inativa ou não configurada, o lembrete de cobrança não inclui link quebrado.

## 8. Ciclo de vida da subconta (desativar vs. encerrar)

- **Hoje (feito):** desligar **`Habilitar cobranças online`** (`onlinePayments.enabled = false`) em **Recebimentos online → Configurações** (`online-payments-settings-tab.tsx`) interrompe novas cobranças online e oculta links nos lembretes/fatura pública, mantendo `gateway_account_id`, `gateway_wallet_id` e `gateway_api_key` em `organizations` caso o espaço volte a usar. **Não existe** ação no app nem no `apps/admin` para apagar a subconta no Asaas.
- **Encerramento definitivo no Asaas (guardado para depois):** nossas subcontas seguem o modelo **não-BaaS** ([`../product/27-juridico-termos-e-identificacao.md`](../product/27-juridico-termos-e-identificacao.md) item A2), no qual a API `DELETE /v3/accounts/{id}` só apaga contas criadas há menos de 48h e sem login (exigindo Whitelist de IP); fora disso, ou o encerramento acontece manualmente no painel web do Asaas ou exige migrar para White Label/BaaS (`DELETE /v3/myAccount`). Os pré-requisitos completos (saldo zerado, cancelamento de cobranças `awaiting`, checagem de chargebacks, retenção BACEN e atualizações nos termos) estão especificados em [`../product/24-diretrizes-exclusao-e-lgpd.md`](../product/24-diretrizes-exclusao-e-lgpd.md) §7.
