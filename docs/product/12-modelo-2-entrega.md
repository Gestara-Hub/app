# Modelo 2: Entrega ou encomenda — especificacao

> Spec dev-ready do Modelo 2. Segue a "Regra de evolucao" ([02-modelos-operacionais.md](02-modelos-operacionais.md)) e o ADR de extensao ([../technical/01-extensao-modelos-operacionais.md](../technical/01-extensao-modelos-operacionais.md)): entra como **modulo separado** (sugestao: `features/orders`), reusa a fundacao, **nao** genericiza o nucleo do Modelo 1. Um tenant e de um modelo so — um tenant de encomendas **nao** tem a agenda 1:1 do Modelo 1.
>
> **Status no codigo (22/09/2026): ainda nao implementado.** So existe o valor `"delivery"` em `OperationalModel` (`packages/contracts/src/organization.ts`), o item de nav Clientes liberado para `delivery` e a rota nucleo `/orders` em `coreRouteFor` (`apps/web/src/components/layout/nav.ts`), sem pagina. Nao ha contratos, services nem telas. Pela regra de idioma do projeto, os identificadores abaixo ja estao em ingles; os termos em portugues sao so rotulo de UI.

## Decisao

Um cliente faz um **pedido/encomenda** de produtos com **data de entrega ou retirada**. O negocio acompanha a producao por um **pipeline de status** (recebido -> em producao -> pronto -> concluido), registra **pagamento** (sinal + saldo) e controla **estoque** (insumos/produtos). Termos genericos: **Produto**, **Pedido**, **Entrega** (sem vertical especifico).

## Escopo do 1o corte

- **Catalogo de Produtos** (+ `Category` reusada) e **Estoque** (insumos/produtos, movimentos, alerta de baixo).
- **Pedido** com N itens (produto + qtd + personalizacao).
- **Entrega OU retirada por pedido** (endereco/taxa quando entrega).
- **Pipeline de status** de producao/entrega.
- **Pagamento/sinal** — registro e status (`pendente/parcial/pago`), **sem gateway** (coerente com o mock).
- **Item personalizado** (descricao/observacoes/anexo).
- **Capacidade: SEM teto** — apenas "carga do dia" informativa por data de entrega.

Fora deste corte (futuro): gateway/conciliacao de pagamento real, taxa de entrega por regiao/roteirizacao, emissao fiscal, multi-unidade, receita/BOM avancada, app do cliente.

## Reuso e fronteiras (ADR 01)

Compartilhado — reusa como esta, sem genericizar:

- **Comprador = `Client`** (rotulo "Cliente"; mesmo dado).
- **Categoria de produto = `Category`.**
- **Responsavel interno = `Professional`** (opcional — quem produz/atende).
- Organizacao/Unidade, Usuarios/RBAC, sessao/auth, shell (nav/layout), camada de dados mock.

Novo (modulo `apps/web/src/features/orders`, rota `/orders`, + contratos): `Product` (Produto), `Supply` (Insumo), `StockMovement` (Movimento de estoque), `Recipe` (Receita, opcional), `Order` (Pedido), `OrderItem` (Item do pedido), `OrderPayment` (Pagamento).

`Appointment` / `Agenda` do Modelo 1 **nao** sao tocados. Nao ha grade por profissional aqui.

## Entidades (esboco de contrato)

Rascunho em estilo `@gestarahub/contracts` (nomes/campos sujeitos a ajuste).

```ts
// Product (Produto) — item de catalogo.
interface Product {
  id: Id;
  organizationId: Id;
  unitId: Id;
  name: string;
  categoryId?: Id;              // = Category
  priceCents: number;
  saleUnit: "unit" | "kg" | "g" | "l" | "ml"; // unidade de venda
  customizable: boolean;        // aceita personalizacao no item do pedido
  tracksStock: boolean;         // controla estoque de produto acabado
  stockQty?: number;            // se tracksStock
  minStock?: number;            // alerta de baixo (informativo)
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

// Supply (Insumo) — materia-prima com estoque.
interface Supply {
  id: Id;
  organizationId: Id;
  unitId: Id;
  name: string;
  saleUnit: "unit" | "kg" | "g" | "l" | "ml";
  stockQty: number;
  minStock?: number;
  status: RecordStatus;
}

// StockMovement (Movimento de estoque) — entrada/saida/ajuste sobre Product ou Supply.
interface StockMovement {
  id: Id;
  organizationId: Id;
  unitId: Id;
  itemType: "product" | "supply";
  itemId: Id;
  kind: "in" | "out" | "adjustment";
  quantity: number;
  reason?: string;              // compra, baixa por pedido, perda, ajuste
  orderId?: Id;                 // quando a saida e baixa de um pedido
  createdAt: DateTimeISO;
}

// Recipe (Receita, opcional) — insumos consumidos por um Product (auto-baixa ao produzir).
interface Recipe {
  productId: Id;
  items: { supplyId: Id; quantity: number }[];
}

// Order (Pedido) — encomenda de um cliente.
interface Order {
  id: Id;
  organizationId: Id;
  unitId: Id;
  code?: string;                // numero legivel ("#1043")
  clientId: Id;                 // = Client (comprador)
  fulfillment: "delivery" | "pickup";
  dueDate: DateISO;             // data de entrega/retirada
  dueTime?: TimeISO;            // horario/janela (opcional)
  address?: Address;            // se delivery (reusa Address de common.ts)
  deliveryFeeCents?: number;    // se delivery
  responsibleId?: Id;           // = Professional (responsavel interno, opcional)
  status: "received" | "in_production" | "ready" | "completed" | "canceled";
  notes?: string;
  cancellationReason?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
  // total/pagamento sao derivados (ver OrderItem/OrderPayment)
}

// OrderItem (Item do pedido) — linha do pedido.
interface OrderItem {
  id: Id;
  orderId: Id;
  productId: Id;
  quantity: number;
  unitPriceCents: number;       // snapshot do preco no momento do pedido
  customization?: string;       // descricao/sabor/observacoes (se customizable)
  attachmentUrl?: string;       // foto de referencia (opcional)
  // lineTotal = quantity * unitPriceCents
}

// OrderPayment (Pagamento) — registro de sinal/saldo (ledger; sem gateway).
interface OrderPayment {
  id: Id;
  orderId: Id;
  kind: "deposit" | "balance" | "full"; // sinal | saldo | total
  amountCents: number;
  method?: PaymentMethod;       // reusa "cash" | "pix" | "card" | "other" de billing.ts
  paidAt: DateTimeISO;
}
```

Read-models: `OrderView` com `client`, `responsible`, itens (produto expandido), e derivados `totalCents` (itens + taxa), `paidCents` (soma dos pagamentos) e `paymentStatus` (`pending | partial | paid`). Estoque com flag derivada `low` (`stockQty <= minStock`).

`PaymentMethod` ja existe em `packages/contracts/src/billing.ts` (usado nas mensalidades do Modelo 3, rotulos Pix, Dinheiro, Cartão, Outro em `lib/labels.ts`) e deve ser reusado, nao redefinido.

## Regras de negocio

**Pedido e status**
- Pipeline: `received -> in_production -> ready -> completed`; de qualquer estado -> `canceled` (com motivo, mantem historico). `completed` = **entregue** (delivery) ou **retirado** (pickup) — o rotulo segue o `fulfillment`.
- `total = soma dos itens + taxa de entrega` (se delivery).

**Entrega / retirada**
- `delivery`: exige `address`; `deliveryFeeCents` opcional. `pickup`: sem endereco/taxa.

**Capacidade (sem teto)**
- Nao ha limite de producao. A agenda por data de entrega mostra a **carga do dia** (nº de pedidos/itens por data) — **informativo**, sem bloquear novos pedidos.

**Pagamento (registro/status)**
- `OrderPayment` registra `deposit` (sinal) / `balance` (saldo) / `full` (total). `paidCents = soma`; `paymentStatus`: `pending` (0), `partial` (0 < pago < total), `paid` (pago >= total). **Sem gateway** — so registro.

**Estoque**
- `Product` pode controlar estoque proprio (`tracksStock`); `Supply` sempre tem estoque. `StockMovement` registra entrada/saida/ajuste (`in`/`out`/`adjustment`).
- **Baixa por pedido**: ao mover para `in_production` (ou `ready`), consome estoque — **automatico** se o Product tem `Recipe` (baixa os insumos) e/ou `tracksStock`; senao, **baixa manual**.
- **Alerta de estoque baixo** (`stockQty <= minStock`): **informativo**, nao bloqueia venda (sem enforcement, coerente com o resto).

**Personalizacao**
- Item de Product `customizable` aceita `customization` (texto) + `attachmentUrl` (foto de referencia).

**RBAC**
- Reusa perfis/permissoes: proprietario/gerente gerenciam catalogo/estoque/pedidos; "atendente" cria e toca pedidos; `responsibleId` (Professional) e so referencia de quem produz.

## Fluxos principais

1. **Cadastrar produto** — nome, categoria, preco, unidade, personalizavel, controla estoque (min).
2. **Gerir estoque** — insumos/produtos: entrada/ajuste, ver niveis e alertas de baixo.
3. **Novo pedido** — cliente; itens (produto + qtd + personalizacao); entrega/retirada (+ endereco/taxa/data); responsavel; sinal.
4. **Avancar status** (Kanban) — recebido -> em producao -> pronto -> concluido; cancelar com motivo.
5. **Registrar pagamento** — sinal e depois saldo; ver quanto falta.
6. **Baixa de estoque ao produzir** — automatica (receita/tracksStock) ou manual.
7. **Ver carga do dia** — agenda por data de entrega (quantos pedidos/itens por data).

## Telas

- **Produtos** (catalogo, CRUD) e **Nova/Editar produto**.
- **Estoque** — insumos/produtos com nivel, movimentos e alertas de baixo.
- **Pedidos — Kanban por status** (board operacional principal: recebido / em producao / pronto / concluido) + **lista** com filtros (data, status, cliente).
- **Agenda por data de entrega** — calendario/lista da carga do dia (informativo; **novo componente**, nao o grid 1:1 do M1).
- **Novo/Editar pedido** — cliente, itens (+ personalizacao/anexo), entrega/retirada, responsavel, pagamento/sinal.
- **Detalhe do pedido** — itens, status (pipeline), pagamento (sinal/saldo), entrega/endereco.

## Estados e mensagens (resumo)

| Entidade | Estados |
| --- | --- |
| Pedido (`Order`) | received, in_production, ready, completed, canceled |
| Pagamento (derivado no pedido) | pending, partial, paid |
| Product / Supply | active, inactive |
| Estoque (derivado) | ok, low |

Mensagens-chave: "Pedido #1043 movido para Em producao"; "Estoque baixo: Farinha (2 kg)"; "Saldo pendente: R$ 100,00"; "Endereco obrigatorio para entrega".

## Premissas assumidas (confirmar)

- **Comprador = Client**, **Categoria = Category**, **Responsavel interno = Professional** (opcional) reusados.
- **Pipeline** padrao `received -> in_production -> ready -> completed | canceled`; `completed` rotulado por `fulfillment` (entregue/retirado).
- **Financeiro = registro/status** (sem pagamento real), como todo o mock.
- **Unidade unica** (multi-unidade fica futuro).
- **Um modelo por tenant**: este tenant nao expoe a agenda 1:1 do M1.

## Decisoes do 1o corte

- **Referencia:** generico (Produto / Pedido / Entrega).
- **Capacidade:** **sem teto** — so "carga do dia" informativa por data de entrega.
- **Entrega:** **ambos por pedido** — entrega (endereco + taxa) ou retirada no balcao.
- **Escopo extra:** **pagamento/sinal + item personalizado + estoque** — os tres incluidos.

## Refinamentos futuros

- **Receita/BOM** completa e auto-baixa fina (1o corte: baixa manual ou receita simples).
- **Taxa de entrega** por regiao/roteirizacao (1o corte: valor manual por pedido).
- Conciliacao e gateway real (os metodos ja vem de `PaymentMethod`).
- **Janela de horario** de entrega e alertas de prazo.
- **Multi-unidade** e relatorios de producao.
