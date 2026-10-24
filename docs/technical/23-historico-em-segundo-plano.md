# 23. Histórico do que roda sem pessoa

Data: 2026-10-23. Migração `20261023000049_background_history.sql`.

## Problema

A Auditoria registrava só o que uma pessoa fazia na tela. O que o servidor faz sozinho não deixava rastro de sucesso, só os erros (doc 21): a rotina diária, os avisos do Asaas (webhook) e a rotina de hora em hora. Também não dava para responder:
- "por que o plano caiu em 18/11?";
- "quem confirmou o Pix da Ana?";
- "a rotina rodou ontem?".

## Decisões do usuário (23/10/2026)

- Juntar com a Auditoria sempre que possível, com o **sistema como autor**.
- Toda tarefa em segundo plano registra **pelo menos as principais e as que derem erro**.
- O que é feito em massa sai **resumido por espaço** ("gerou 12 mensalidades", com a lista), não uma linha por item.
- A Auditoria e o histórico do plano ficam **para sempre**. Os registros técnicos ficam 120 dias.

## Três camadas

| Pergunta | Onde | Quem vê | Guarda |
| --- | --- | --- | --- |
| O que aconteceu no meu espaço, quem fez e quando? | `audit_logs` (Auditoria), com o autor pessoa ou sistema | Dono; o gerente vê o operacional (mesma regra de sempre) | Para sempre |
| Como foi a linha do tempo do plano? | `subscription_events`, ligado à Auditoria | Dono (Configurações → Plano → Histórico do plano) | Para sempre |
| A rotina rodou? O aviso chegou? O que deu errado? | `job_runs`, `webhook_events` e `error_logs` (doc 21) | Suporte, direto no banco | 120 dias |

### 1. Auditoria com o sistema como autor
- **Autor:** `actor.kind = "system"`, com o nome de quem agiu: "Rotina diária", "Rotina de pagamentos online", "Parceiro de pagamentos" ou "Sistema". Colunas novas:
  - `source`: a origem técnica (`cron.daily`, `cron.online-payments`, `webhook.asaas`); vazia quando foi uma pessoa;
  - `failed`;
  - `error_reference`: o código do registro de erros, o mesmo que aparece para o usuário.
- **Escrita:** só pelo servidor, com a chave de serviço, em `services/server/systemAudit.ts` (`recordSystemAudit` e `recordServerAudit`). O navegador continua sem poder gravar.
- **Tela:**
  - O filtro "Responsável" ganhou as opções "Pessoas", "Sistema (rotinas e pagamentos)" e "Só o que falhou".
  - A linha mostra "Automático" no lugar do perfil e o selo "Falhou".
  - O detalhe mostra o código do erro e a origem.
  - O período ("hoje", "7 dias") é contado no fuso do espaço (doc 22).

**O que entra hoje:**
- **Rotina diária, por espaço** (`services/server/dailyRoutine.ts`):
  - "gerou 12 mensalidades" e "lançou 3 lançamentos repetidos no Financeiro", com a lista no detalhe (até 50 itens, depois "e mais N");
  - a falha, com o código: "não conseguiu gerar as mensalidades (código K7Q2M9XD)";
  - quando não há nada a fazer, nada é gravado.
- **Plano:** todos os eventos (seção 2), com quem fez.
- **Pagamento online de aluno confirmado pelo parceiro:** "Parceiro de pagamentos confirmou o pagamento online de Ana Souza por Pix (R$ 150,00, mensalidade de nov)". Sai uma vez por pagamento: no cartão, o Asaas avisa "confirmado" e depois "recebido".
- **Falha da rotina do plano num espaço**, com o código.

### 2. Histórico do plano (`subscription_events`)
- **Uma linha por mudança**, com:
  - o tipo: `activated`, `upgraded`, `change_scheduled`, `change_canceled`, `change_applied`, `renewed`, `renewal_overdue`, `reverted_to_free`, `reactivated`, `closed`, `canceled`, `removed_at_partner`;
  - o plano antes e depois;
  - o valor, a cobrança e a assinatura do Asaas, e o dia em que vale;
  - quem fez (pessoa ou sistema) e a origem.
- **Gravação:** sai junto com a escrita do plano, no servidor, em todo caminho (tela, webhook, rotina), por `services/server/subscriptionEvents.ts`.
- **Ligação com a Auditoria:** cada evento grava também uma linha na Auditoria e guarda o id dela (`audit_log_id`). Na Auditoria, o alvo leva o id do evento.
- **Upgrade confirmado pelo parceiro:** a frase leva quem pediu. Por exemplo: "Parceiro de pagamentos mudou o Plano GestaraHub para o Expansão mensal (diferença de R$ 79,40 paga, pedido por Marcello)". Quem pediu fica guardado na troca pendente (`pendingChange.requestedBy`).
- **Sem duplicar:** o navegador não grava mais na Auditoria as trocas da conta real. Só o espaço que vive só no navegador ainda grava de lá.

### 3. Registros técnicos
- **`job_runs`:** uma linha por execução da rotina diária e da de hora em hora, com:
  - o início e o fim;
  - a situação: `ok`, `partial` (algum espaço falhou) ou `failed`;
  - os totais e os códigos dos erros.
- **`webhook_events`:** uma linha por aviso do Asaas, com:
  - o id do evento, o tipo, a cobrança, a assinatura e o espaço;
  - a situação (`processed`, `ignored`, `failed`), o que o tratamento fez e o código do erro.
- **Aviso repetido:** o id do evento é único. Um aviso já tratado volta como repetido e não é tratado de novo; o Asaas avisa "pelo menos uma vez". Um aviso que falhou é tratado de novo quando o Asaas reenvia, e a linha conta as tentativas. Na falha, o webhook responde 500 para o Asaas reenviar.
- **Limpeza:** `prune_background_logs()` apaga o que tem mais de 120 dias, todo dia às 06:45 UTC.

## Índices (por consulta)

| Tabela | Índice | Para |
| --- | --- | --- |
| `audit_logs` | `(organization_id, timestamp desc, id desc) where source is not null` | Filtro "Sistema". O "Pessoas" e a lista sem filtro usam o `idx_audit_logs_org_time` de sempre, porque as pessoas são a maior parte da tabela |
| `audit_logs` | `(organization_id, timestamp desc, id desc) where failed` | "Só o que falhou" |
| `audit_logs` | `(error_reference) where error_reference is not null` | Do código que o usuário mandou até a linha da Auditoria |
| `subscription_events` | `(organization_id, created_at desc, id desc)` | Histórico do plano na tela |
| `subscription_events` | `(asaas_payment_id) where not null` | "O que esta cobrança do Asaas fez?" |
| `job_runs` | `(job, started_at desc)` | "Como foi a última execução?". Cerca de 25 linhas por dia: a limpeza por data dispensa índice próprio |
| `webhook_events` | único `(provider, event_id) where event_id is not null` | Aviso repetido |
| `webhook_events` | `(payment_id, received_at desc) where not null` | "O que chegou sobre a cobrança pay_...?" |
| `webhook_events` | `(organization_id, received_at desc) where not null` | Avisos de um espaço |
| `webhook_events` | `(received_at desc)` | Últimos avisos e limpeza de 120 dias (é a tabela que cresce com o uso) |
| `webhook_events` | `(received_at desc) where status = 'failed'` | Conferir e reprocessar os que falharam |

Sem índice em `subscription_id` de `webhook_events`: todo aviso de cobrança de assinatura já tem a cobrança (`payment_id`), e os avisos só de assinatura são poucos.

## Como buscar (suporte)

- **"Deu erro, código K7Q2M9XD":** `error_logs.last_reference` (doc 21) e `audit_logs.error_reference`.
- **"O plano do espaço X caiu":** `subscription_events` do espaço, mais recente primeiro. Mostra quem fez, quando, o valor e a cobrança do Asaas.
- **"O Pix da Ana não deu baixa":** `webhook_events` por `payment_id`. Mostra se chegou, quantas vezes, o resultado e o código do erro.
- **"A rotina rodou?":** `job_runs` por `job`, mais recente primeiro.

## Fica para depois
- Tela de suporte para `job_runs` e `webhook_events`. Hoje a consulta é no banco. Faz sentido quando houver equipe de suporte.
- **Rotina de hora em hora na Auditoria do espaço:** hoje ela fica só em `job_runs`. Os Pix vencidos têm pouco valor para o dono, e o parabéns automático já fica no histórico de mensagens.

## Testes
- `services/server/__tests__/backgroundHistory.db.test.ts`: aviso repetido e reenviado depois de falhar, execução da rotina, resumo por espaço com a falha e o código, nada gravado quando não há o que fazer, e o filtro "Pessoas / Sistema / Só o que falhou".
- `services/subscription/__tests__/planChange.db.test.ts`: o histórico e a Auditoria do upgrade (com quem pediu) e da volta ao Grátis.
- `services/subscription/__tests__/plan-webhook.test.ts`: o aviso repetido, a Auditoria uma vez por pagamento e a falha com o código.
