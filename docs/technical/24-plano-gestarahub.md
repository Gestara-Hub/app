# 24 — Plano GestaraHub (assinatura): contrato, recursos e quem grava

Data: 2026-10-24 (extraído do doc 05, seção 3, de 27/09/2026; §7 detalhada em 2026-11-16) · Status: Feito (assinatura e troca); §7 NFS-e especificada para implementar depois.
Código: `packages/contracts/src/subscription.ts`, `apps/web/src/lib/subscription.ts`, `services/subscription/`, `services/server/subscription*.ts`, `features/subscription`, `features/settings/components/subscription-plan-card.tsx`.
Testes: `services/subscription/__tests__/`, `packages/core/test/subscription-plan.test.ts`, `lib/__tests__/subscription-*.test.ts`.

> Regras de negócio (preço, troca de plano, tolerância e avisos): [`../product/13-modelo-de-negocio.md`](../product/13-modelo-de-negocio.md), seção 6. Este documento descreve **como funciona** no código. O financeiro do espaço está no [doc 05](05-modulo-financeiro.md) e o pagamento online dos alunos no [doc 25](25-pagamento-online.md).

## 1. Nome

`Plan` já é o plano de mensalidade do aluno. O plano do GestaraHub se chama **assinatura** no código (`Subscription`) e **"Plano GestaraHub"** na tela (Configurações), para não confundir com "Planos e pacotes" do menu.

## 2. Contrato

```ts
// packages/contracts/src/subscription.ts
export type SubscriptionTier = "free" | "pro" | "scale";

/** Recursos pagos, checados junto com a permissão do perfil. */
export type PaidFeature =
  | "online_payments"   // cobrança online (Pix, link, Pix Automático)
  | "messaging"         // Comunicação automatizada (WhatsApp)
  | "reports_advanced"  // Relatórios gerenciais avançados (DRE, churn)
  | "certificates"      // Certificado de conclusão de curso (14/10/2026)
  | "bi";               // Inteligência analítica preditiva
```

`Organization` ganha `subscription?: Subscription` (ausente = `free`).

## 3. Matriz tier → recursos

Em `apps/web/src/lib/subscription.ts`, espelhando `lib/permissions.ts`:

```ts
export const TIER_FEATURES: Record<SubscriptionTier, readonly PaidFeature[]> = {
  free: ["online_payments"],
  pro: ["online_payments", "messaging", "reports_advanced", "certificates"],
  scale: ["online_payments", "messaging", "reports_advanced", "certificates", "bi"],
};
```

## 4. Composição com RBAC

Uma tela paga exige **as duas coisas**: permissão do perfil (`can`) **e** recurso do plano (`hasFeature`).

- **Permissão sem o recurso:** o item de menu aparece **com um cadeado**, e a rota abre a tela "Disponível no Plano Pro" com botão para ver o plano. **[DECIDIR]** mostrar com cadeado (estimula a conversão) ou esconder.
- **Sem a permissão:** o item não aparece e a rota redireciona, como hoje.
- **Guard de rota:** `requirePermission(permission, route)` continua. As páginas pagas também checam o recurso no server (o tier vem da organização da sessão) e, sem o recurso, renderizam a tela de upsell em vez de redirecionar.
- **Service:** as mutations do Financeiro recusam com `ApiError` `FEATURE_NOT_IN_PLAN` (403) quando o tier não tem o recurso (defesa no "servidor", como no backend real).

## 5. Demonstração e conta real

Configurações ganha a aba **"Plano GestaraHub"**: mostra o plano atual, o que o Pro inclui, e um botão **"Ativar Pro (demonstração)"** / **"Voltar ao Grátis"**. Só o proprietário troca. Fica registrado na Auditoria.

**Conta real (23/10/2026, achado 66 do teste geral):** o botão de demonstração aparece só no espaço de demonstração (`pnpm demo:local`) e nos espaços só do navegador (`isDemoSpace`). A conta real vê **"Assinar o Profissional"**, que leva ao checkout, e pode **"Voltar ao Grátis"**, que cancela a assinatura no Asaas antes de gravar. O plano pago é gravado só no servidor:

- `services/server/subscription.ts` grava a coluna `organizations.subscription`.
- O espaço do servidor não grava essa coluna (`SERVER_WRITTEN` em `world/tables.ts`), nem se o navegador mandar o plano junto dos dados da organização.
- A assinatura no Asaas leva o espaço, o plano e o período em `externalReference` (`encodeSubscriptionReference`). Ao conferir o Pix (polling) ou simular o pago, o servidor lê o plano do Asaas e recusa pagamento de outro espaço.
- `updateOrganizationSubscriptionAction` recusa plano pago fora do espaço de demonstração.

Ainda em aberto: os recursos pagos são conferidos na tela e nos serviços do navegador. As actions do servidor não conferem o plano (ver o arquivo do teste geral).

> **Troca de plano, renovação e tolerância** (23/10/2026): upgrade proporcional na hora, downgrade no fim do período pago, mensal ↔ anual, 5 dias de tolerância com avisos e webhook da assinatura. Uma assinatura só por espaço no Asaas. Regras e código em `docs/product/13-modelo-de-negocio.md` §6 ("Como ficou"). A tela paga lê o plano do banco na conta real (achado 80), não do cookie espelho.

## 6. Permissões novas

`Permission` ganha:

| Key | Owner | Manager | Attendant | Professional |
|---|---|---|---|---|
| `finance:view` | ✅ | ✅ | — | — |
| `finance:manage` (lançar, pagar professor, configurar cobrança online) | ✅ | ✅ | — | — |
| `subscription:manage` (trocar o plano GestaraHub) | ✅ | — | — | — |

Atendente continua vendo as Mensalidades (`billing:view`), como hoje. Cobrar um aluno online a partir das Mensalidades exige `billing:manage` **e** o recurso `online_payments`.

## 7. Nota fiscal (decisão de 02/11/2026; especificação executável de 16/11/2026)

Três dinheiros passam pelo Asaas e cada um tem uma resposta própria. Nada disto está implementado ainda (ver [`pendencias.md`](../pendencias.md), "Decidido, falta implementar").

| Dinheiro | Quem emite para quem | Como | Etapa |
| --- | --- | --- | --- |
| Assinatura do plano (Pro, Scale) + upgrade proporcional | GestaraHub → espaço | Automática por assinatura no Asaas (`invoiceSettings` com `ON_PAYMENT_CONFIRMATION`) + `POST /v3/invoices` na diferença avulsa de upgrade após o pagamento confirmado. | **Fase 1 (abaixo)** |
| Taxa do GestaraHub por transação (split retido) | GestaraHub → espaço | **Uma nota avulsa por espaço e por mês**, somando as taxas retidas no período (`POST /v3/invoices` com `customer` = o espaço como cliente da conta principal; o Asaas aceita nota sem cobrança vinculada). Descrição "Taxa de intermediação de N recebimentos de {mês}". Emitida pela rotina diária no primeiro dia do mês seguinte. Vale para o Grátis também. | Fase 2 (depois) |
| Compras avulsas no sistema (addons: mensagens extras WhatsApp, pacotes de certificados etc.) | GestaraHub → espaço | Reaproveita o pipeline avulso da Fase 1 (`POST /v3/payments` → webhook pago → `POST /v3/invoices`). | Futuro (fora do escopo inicial; [`product/13`](../product/13-modelo-de-negocio.md) §7) |
| Tarifa do Asaas (Pix, cartão) | Asaas → espaço | Receita do Asaas, cobrada da subconta: não é nota nossa. | — |
| Mensalidade do aluno | espaço → aluno | Receita do espaço: responsabilidade dele (o contrato da ativação, item 9, já diz isso; NFS-e para alunos é item do Scale, doc 13 §7). | Futuro (Scale) |

---

### 7.1. Especificação de execução — Fase 1 (Contratação de Plano: assinatura e upgrade)

Escopo fechado para a primeira implementação de NFS-e: **cobrir apenas a contratação e renovação do Plano GestaraHub (mensal/anual) e a diferença proporcional paga no upgrade imediato**. Addons avulsos (ex.: pacotes extras de WhatsApp ou pacotes de X certificados sem assinar plano) e a nota mensal consolidada das taxas de split ficam fora desta fase.

#### A. Pré-requisitos de ambiente e contabilidade (antes do deploy em produção)
1. **Conta principal PJ no Asaas:** habilitar certificado digital A1 / emissão de NFS-e na Prefeitura ou Portal Nacional (`GET /v3/fiscalInfo/municipalOptions`, `POST /v3/fiscalInfo`).
2. **Parâmetros fiscais com o contador → variáveis de ambiente na Vercel (`apps/web`):**
   - `ASAAS_NFSE_SERVICE_ID` (`municipalServiceId` via `GET /v3/fiscalInfo/services`) **ou** o par `ASAAS_NFSE_SERVICE_CODE` + `ASAAS_NFSE_SERVICE_NAME` (nunca mandar os dois juntos; municípios sem listagem ou no Portal Nacional usam código + nome).
   - `ASAAS_NFSE_RETAIN_ISS` (`"false"` por padrão; validar com o contador).
   - `ASAAS_NFSE_ISS`, `ASAAS_NFSE_PIS`, `ASAAS_NFSE_COFINS`, `ASAAS_NFSE_CSLL`, `ASAAS_NFSE_INSS`, `ASAAS_NFSE_IR` (no Simples Nacional, em regra apenas `iss` e demais zerados; validar NT-007 / regime da MHMJ).
   - **Regra de segurança operacional (feature flag por env):** criar helper `getAsaasNfseConfig()` em `apps/web/src/lib/asaas/`. Enquanto as variáveis não existirem no ambiente, a configuração/emissão fiscal é **ignorada silenciosamente sem bloquear assinaturas**, facilitando testar no sandbox antes da virada.
3. **Webhook da conta principal do Asaas:** cadastrar na conta-pai a mesma URL `${NEXT_PUBLIC_APP_URL}/api/webhooks/asaas` e token `ASAAS_WEBHOOK_SECRET`, garantindo os eventos `PAYMENT_*`, `SUBSCRIPTION_*` **e** os eventos de nota: `INVOICE_CREATED`, `INVOICE_SYNCHRONIZED`, `INVOICE_AUTHORIZED`, `INVOICE_ERROR`, `INVOICE_CANCELED`, `INVOICE_CANCELLATION_DENIED`.

#### B. Lacuna obrigatória no Checkout: endereço completo do tomador
Prefeituras e o Asaas recusam NFS-e se o `customer` não tiver **CPF/CNPJ e endereço completo** (`postalCode`, `address`, `addressNumber`, `province` — o Asaas resolve município/UF pelo CEP).
- **Situação atual:** `subscriptionCheckoutSchema` (`apps/web/src/features/subscription/subscription-checkout-schema.ts`), `subscription-checkout-view.tsx`, `subscription-checkout-dialog.tsx` e `CreateSubscriptionInput` (`apps/web/src/services/subscription/subscriptionCheckoutActions.ts`) coletam e enviam apenas `name`, `email`, `cpfCnpj` e `phone`.
- **O que alterar:**
  1. Estender `subscriptionCheckoutSchema` e `CreateSubscriptionInput["customer"]` com `postalCode` (8 dígitos), `address` (rua), `addressNumber` (número), `complement` (opcional) e `province` (bairro).
  2. No frontend (`subscription-checkout-view.tsx` e `subscription-checkout-dialog.tsx`), pré-preencher esses campos com `unit.address` (via `useUnit()`, igual já faz `activate-subaccount-dialog.tsx`) e buscar CEP automaticamente se o usuário digitar um novo.
  3. Em `createAsaasSubscriptionCheckoutAction` (`subscriptionCheckoutActions.ts`), enviar esses campos no `createOrFindCustomer(...)` (que já atualiza o cadastro no Asaas via `PUT /customers/{id}` quando encontra por `externalReference: organizationId`).
  4. Na troca de plano com cobrança de diferença (`startPlanChange` / `PlanChangeDialog`), validar via `getCustomer(subscription.asaasCustomerId)` (ou flag local) se o assinante antigo já tem endereço completo no Asaas antes de emitir a nota do upgrade; se faltar, usar `units.address` do espaço ou pedir na confirmação.

#### C. Migração de banco (`apps/supabase/migrations/`)
Criar tabela `public.platform_invoices` (acesso direto bloqueado por RLS; leitura pelo app via server action autenticada e escrita exclusiva por `service_role`):
- `id` `uuid primary key default gen_random_uuid()`
- `organization_id` `uuid not null references public.organizations(id) on delete cascade`
- `kind` `text not null check (kind in ('subscription', 'plan_upgrade', 'platform_fees', 'addon'))`
- `asaas_invoice_id` `text not null unique`
- `asaas_payment_id` `text` *(índice único parcial `where asaas_payment_id is not null and status <> 'canceled'` para garantir 1 nota ativa por cobrança)*
- `asaas_subscription_id` `text`
- `external_reference` `text` *(ex.: `plan-invoice:<orgId>:<paymentId>`)*
- `status` `text not null` (`'scheduled' | 'synchronized' | 'authorized' | 'processing_cancellation' | 'canceled' | 'cancellation_denied' | 'error'`)
- `amount_cents` `integer not null`
- `service_description` `text not null`
- `effective_date` `date`
- `invoice_number` `text`
- `validation_code` `text`
- `pdf_url` `text`
- `xml_url` `text`
- `status_description` `text` *(mensagem de erro da prefeitura em `error`)*
- `issued_at` `timestamptz`
- `created_at` / `updated_at` `timestamptz not null default now()`

Em `webhook_events` (ver `apps/web/src/services/server/backgroundRuns.ts`), opcionalmente adicionar coluna `invoice_id text` (ou aproveitar `payment_id`/`subscription_id` + índice existente por `event_id`).

#### D. Cliente Asaas (`apps/web/src/lib/asaas/types.ts` e `client.ts`)
1. **Novos tipos em `types.ts`:**
   - `AsaasInvoiceTaxes` (`retainIss`, `iss?`, `pis?`, `cofins?`, `csll?`, `inss?`, `ir?`)
   - `AsaasSubscriptionInvoiceSettingsRequest` / `Response` (`effectiveDatePeriod: "ON_PAYMENT_CONFIRMATION"`, `municipalServiceId?`, `municipalServiceCode?`, `municipalServiceName?`, `observations?`, `taxes`, `receivedOnly?`)
   - `AsaasCreateInvoiceRequest` (`payment?`, `customer?`, `serviceDescription`, `observations?`, `value`, `deductions`, `effectiveDate`, `municipalServiceId?`, `municipalServiceCode?`, `municipalServiceName?`, `taxes`, `externalReference?`)
   - `AsaasInvoiceResponse` (`id`, `status`, `customer`, `payment?`, `subscription?`, `value`, `effectiveDate`, `serviceDescription`, `number?`, `validationCode?`, `pdfUrl?`, `xmlUrl?`, `statusDescription?`, `externalReference?`)
   - Estender `AsaasWebhookPayload`: eventos `INVOICE_CREATED | INVOICE_SYNCHRONIZED | INVOICE_AUTHORIZED | INVOICE_PROCESSING_CANCELLATION | INVOICE_CANCELED | INVOICE_CANCELLATION_DENIED | INVOICE_ERROR` e campo opcional `invoice?: AsaasInvoiceResponse`.
   - Estender `AsaasCustomerRequest` e `AsaasCustomerResponse` com `city?` / `state?` caso necessário na leitura de `getCustomer`.
2. **Novas funções em `client.ts`:**
   - `getCustomer(customerId, apiKey?)` → `GET /customers/${customerId}`
   - `setSubscriptionInvoiceSettings(subscriptionId, payload)` → `POST /subscriptions/${subscriptionId}/invoiceSettings`
   - `getSubscriptionInvoiceSettings(subscriptionId)` → `GET /subscriptions/${subscriptionId}/invoiceSettings`
   - `createInvoice(payload)` → `POST /invoices`
   - `getInvoice(invoiceId)` → `GET /invoices/${invoiceId}`
   - `listInvoices(params: { payment?: string; subscription?: string; customer?: string })` → `GET /invoices`
   - `cancelInvoice(invoiceId)` → `POST /invoices/${invoiceId}/cancel` (uso eventual para estorno/arrependimento de 7 dias)

#### E. Serviço de emissão e sincronização (`apps/web/src/services/server/subscriptionInvoices.ts`, sem `"use server"`)
1. **`configureSubscriptionInvoiceSettings(subscriptionId, descriptionLabel)`:**
   - Se `!getAsaasNfseConfig()`, retorna sem erro.
   - Chama `setSubscriptionInvoiceSettings(subscriptionId, { effectiveDatePeriod: "ON_PAYMENT_CONFIRMATION", ...fiscalServiceAndTaxes, observations: descriptionLabel })`.
   - **Nunca derruba a venda do plano:** chamar dentro de `try/catch`; se falhar, registrar com `reportError("subscription.invoiceSettings", error, ...)` (aparece em **Saúde** do `apps/admin`).
   - **Pontos exatos de chamada:**
     - `createAsaasSubscriptionCheckoutAction` (`services/subscription/subscriptionCheckoutActions.ts`) logo após `createSubscription(subscriptionPayload)`.
     - `recreateOnAsaas` (`services/server/subscriptionPlan.ts`) ao recriar assinatura no religamento/desmarcação.
     - `syncAsaasPlan` (`services/server/subscriptionPlan.ts`) ao atualizar plano/ciclo para manter as observações/descrição do novo plano alinhadas nas próximas renovações.
2. **`ensurePaymentInvoice(admin, input: { organizationId, payment, kind: "subscription" | "plan_upgrade", serviceDescription })`:**
   - Função idempotente para **somente após pagamento confirmado** (nunca na criação do Pix pendente):
     1. Verifica se `!getAsaasNfseConfig()` ou se `payment.id` já existe em `platform_invoices` (`status <> 'canceled'`); se sim, não faz nada.
     2. Consulta `listInvoices({ payment: payment.id })` no Asaas: se a assinatura (`invoiceSettings`) ou uma chamada concorrente (polling + webhook) já criou a nota no Asaas, apenas faz upsert em `platform_invoices` e retorna!
     3. Caso não exista nenhuma nota ainda (caso normal de **upgrade proporcional `plan_upgrade`**, ou fallback caso `invoiceSettings` da assinatura tenha falhado), chama `createInvoice({ payment: payment.id, effectiveDate: asaasToday(), value: payment.value, deductions: 0, serviceDescription, externalReference: \`plan-invoice:${organizationId}:${payment.id}\`, ...fiscalServiceAndTaxes })` e salva o retorno em `platform_invoices`.
   - **Pontos exatos de chamada:**
     - **Upgrade proporcional (`kind: "plan_upgrade"`):** dentro de `confirmPlanChangePayment` (`services/server/subscriptionPlan.ts`, fluxo do polling/sandbox) **e** dentro de `recordPlanChangePaymentPaid` (`services/server/subscriptionPlan.ts`, fluxo do webhook), após confirmar que o status é pago.
     - **Fallback da assinatura (`kind: "subscription"`):** dentro de `confirmSubscriptionPayment` (`services/server/subscription.ts`) e `recordSubscriptionPaymentPaid` (`services/server/subscriptionPlan.ts`), garantindo que mesmo se `invoiceSettings` tiver falhado ou a assinatura for anterior à feature, toda parcela confirmada ganhe nota.
3. **`syncInvoiceFromWebhook(admin, webhookInvoice)`:**
   - **Segurança:** reconsultar `const verified = await getInvoice(webhookInvoice.id)` na conta principal (mesmo padrão usado para pagamentos de subconta em `verifyGatewayPaymentForWebhook`), para nunca confiar cegamente em URLs/status vindos sem conferência na API do Asaas.
   - Resolver `organizationId` pela ordem: linha existente em `platform_invoices` (`asaas_invoice_id`) → `verified.payment` (linha existente por `asaas_payment_id`) → `verified.subscription` (`organizations.subscription->>'asaasSubscriptionId'`) → `decodePlanChangeReference` / `decodeSubscriptionReference(verified.externalReference)` → `verified.customer` (`organizations.subscription->>'asaasCustomerId'`).
   - Fazer upsert completo em `platform_invoices` mapeando o status do Asaas (`SCHEDULED`, `SYNCHRONIZED`, `AUTHORIZED`, `PROCESSING_CANCELLATION`, `CANCELED`, `CANCELLATION_DENIED`, `ERROR`).
   - Quando `status === "AUTHORIZED"`, gravar `invoice_number`, `validation_code`, `pdf_url`, `xml_url`, `issued_at`, e registrar na Auditoria do espaço via `recordSystemAudit` (ex.: *"Nota fiscal nº 123 emitida para o Plano GestaraHub"*).
   - Quando `status === "ERROR"`, gravar `status_description` e acionar `reportError("invoice.asaas.error", ...)` para alertar a equipe no `apps/admin` (**Saúde**).

#### F. Webhook (`apps/web/src/app/api/webhooks/asaas/route.ts`)
1. Na leitura do payload em `POST`: extrair `const { event, payment, subscription, invoice } = payload ?? {};`.
2. Ajustar a guarda inicial (hoje exige `payment?.id || subscription?.id`) para aceitar também `invoice?.id` quando `event.startsWith("INVOICE_")`.
3. Passar `paymentId: payment?.id ?? invoice?.payment` e `subscriptionId: subscription?.id ?? payment?.subscription ?? invoice?.subscription` para `beginWebhookEvent`.
4. Em `handleEvent`: antes de `if (!payment) return ...`, adicionar bloco `if (event.startsWith("INVOICE_"))`:
   - Se `!invoice?.id`, retornar `{ status: "ignored", outcome: "nota sem id" }`.
   - Chamar `syncInvoiceFromWebhook(admin, invoice)` (se o cliente/assinatura/pagamento não pertencer a nenhuma organização conhecida na conta principal, retornar `{ status: "ignored", outcome: "nota fora do plano" }`).

#### G. Contrato e Interface (`packages/contracts`, `apps/web`, `apps/admin`)
1. **`packages/contracts/src/subscription.ts`:** exportar tipo `PlatformInvoiceView` (`id`, `kind`, `status`, `amountCents`, `serviceDescription`, `invoiceNumber?`, `pdfUrl?`, `xmlUrl?`, `issuedAt?`, `createdAt`).
2. **`apps/web/src/services/subscription/`:** action `listPlatformInvoicesAction()` (exige permissão `subscription:manage` e `organizationId` da sessão) + hook `usePlatformInvoices()` em `features/subscription/`.
3. **Tela do cliente (`apps/web/src/features/settings/components/subscription-plan-card.tsx`):**
   - Exibir bloco compacto **"Notas fiscais"** (somente para quem tem `subscription:manage` e quando houver notas ou conta real paga), mostrando descrição, valor, data, selo de situação (*Em emissão* / *Emitida* / *Falha na emissão*) e botões **PDF** e **XML** quando `pdfUrl` / `xmlUrl` existirem.
4. **Painel Admin (`apps/admin/src/app/(panel)/spaces/[id]/`):**
   - Na aba **Plano** do espaço, listar `platform_invoices` com `status`, `status_description` e botão (restrito a `plans:grant` / admin) para **reemitir NFS-e** de cobrança que falhou após corrigir dados cadastrais.

#### H. Testes antes do deploy
- `apps/web/src/services/subscription/__tests__/planInvoices.db.test.ts` (mockando `@/lib/asaas`, seguindo o padrão de `planChange.db.test.ts` e `plan-webhook.test.ts`):
  1. Checkout chama `setSubscriptionInvoiceSettings` com `ON_PAYMENT_CONFIRMATION` e falha eventual em `invoiceSettings` não cancela o checkout nem impede fallback na confirmação;
  2. `startPlanChange` **não** emite nota antes de pagar; `confirmPlanChangePayment` + `recordPlanChangePaymentPaid` chamados juntos criam **apenas 1** nota no Asaas e no banco (idempotência);
  3. Webhook `INVOICE_AUTHORIZED` reconsulta `getInvoice`, grava `number`, `pdf_url`, `xml_url` e audita; `INVOICE_ERROR` grava motivo e registra em `error_logs`;
  4. `listPlatformInvoicesAction` bloqueia perfil sem `subscription:manage` e isola estritamente por `organizationId`.
- Conferência manual no **Asaas Sandbox**: criar assinatura de teste + simular pagamento (`POST /v3/sandbox/payment/{id}/confirm` ou fluxo de cartão), testar upgrade proporcional e conferir chegada real do webhook `INVOICE_AUTHORIZED` no túnel local (`docs/guides/16`).

