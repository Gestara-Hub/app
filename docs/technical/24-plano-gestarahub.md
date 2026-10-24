# 24 — Plano GestaraHub (assinatura): contrato, recursos e quem grava

Data: 2026-10-24 (extraído do doc 05, seção 3, de 27/09/2026). Status: Feito.
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
