# 19. Desempenho e escala: o que vai engargalar e como resolver

Data: 2026-10-23. Status: fases 0 e 1 feitas e cache do servidor ligado (seção 7); fases 2 e 3 propostas.

## 1. Resumo

O sistema é rápido hoje porque os espaços são pequenos. O custo de **toda** ação (abrir uma tela, marcar presença, gerar um recibo) cresce com o **histórico inteiro do espaço**, não com o que a tela mostra. Com um ano de uso, uma academia média já leva 1,4 s por ação; uma grande, 4 s. No segundo ano, o dobro. Com várias pessoas usando ao mesmo tempo, piora mais: as gravações de um espaço entram em fila e brigam entre si.

Há também um **defeito de correção** que aparece com volume: algumas leituras param em 1.000 linhas sem avisar.

A proposta é em 4 fases, da mais urgente e barata para a mais estrutural. Meta: **ação comum abaixo de 300 ms (p95) independentemente do tamanho do histórico**, e duas pessoas no mesmo espaço sem conflito quando mexem em coisas diferentes.

## 2. Medição (banco local, sem latência de rede)

Espaço criado por teste com um ano de uso: chamada 3x por semana em todas as turmas, 12 mensalidades por aluno.

| Espaço | Alunos | Turmas | Presenças | Cobranças | Uma ação (leitura ou gravação) | 10 leituras juntas | Memória por ação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Médio, 1 ano | 200 | 12 | 35,6 mil | 2,4 mil | **1,4 s** | **7,1 s** | 13,7 MB |
| Grande, 1 ano | 600 | 36 | 106,7 mil | 7,2 mil | **4,1 s** | **19,2 s** | 41 MB |
| Espaço novo (e2e) | 3 | 1 | 10 | 5 | ~0,06 s | — | — |

Em produção soma-se a latência entre Vercel e Supabase (cada carga faz 30 ou mais consultas, em sequência quando passa de 1.000 linhas por tabela). O tempo cresce em linha reta com o histórico: o segundo ano dobra o primeiro.

## 3. Onde engargala

### 3.1 O espaço inteiro em toda ação (causa raiz)

- `services/world/runWorld.ts` (`loadWorld`): toda chamada da conta real, **inclusive leitura**, lê todas as tabelas do espaço (cerca de 28 coleções, de 1.000 em 1.000 linhas), monta o espaço em memória, roda a regra e compara tudo para gravar a diferença. Só o log de auditoria é carregado em parte (`tables.ts`).
- `services/world/delegate.ts`: todos os métodos dos serviços migrados passam por aí, listas e detalhes também.
- Documentos (PDF/CSV), relatórios e o resumo do aluno também carregam o espaço inteiro para usar uma fração dele.

### 3.2 Uma versão por espaço: gravações em fila e conflitos

- `world_versions` (migração 32): uma versão por organização. Toda gravação confere a versão do espaço inteiro. Dois professores marcando chamada em turmas diferentes conflitam; a ação perdedora recarrega o espaço inteiro e tenta de novo, até 3 vezes (`serviceActions.ts`), e por fim mostra "Outra pessoa mudou esses dados agora".
- Cada linha alterada faz 3 idas ao banco dentro da transação travada (`apply_world_changes`), então mudanças grandes (parcelas, geração de mensalidades) seguram o espaço por mais tempo.

### 3.3 Leituras cortadas em 1.000 linhas (defeito, urgente)

- `max_rows = 1000` (`apps/supabase/config.toml`, igual ao padrão do Supabase hospedado). `listChargesFromDb`, `listFinancialEntriesFromDb` e outras leituras sem paginação recebem no máximo 1.000 linhas **sem erro**.
- `generateMembershipChargesAction` (`billing/membershipBackend.ts`) decide quais mensalidades criar a partir dessa lista: passou de 1.000 mensalidades no espaço (cerca de 85 alunos em um ano), ela enxerga só parte delas, tenta recriar as que "faltam" e esbarra no índice único. Na prática: geração de mensalidade falhando ou incompleta em espaços com mais de um ano.

### 3.4 Navegador: chamadas demais para o servidor

As chamadas de uma aba ao servidor rodam uma por vez (Next). Cada consulta a mais é uma carga do espaço inteiro na fila.

- **Casca do app em toda página:** `OnboardingTopBanner` e `DiscoveryNextStepBar` (`app/(app)/layout.tsx`) usam `useOnboardingSteps`, que busca unidade, organização, serviços, profissionais, **todos os alunos**, **todos os agendamentos**, modalidades, turmas, planos e pacotes. Roda mesmo depois de a configuração inicial acabar. São cerca de 11 cargas ao abrir qualquer página.
- **Invalidação global** (`lib/providers.tsx`): toda gravação relê auditoria e "Próximo passo" se estiverem na tela e marca o cache todo como velho.
- **Invalidações largas:** `invalidateEnrollmentMoney` (7 raízes), `invalidateMoney` (billing, finance, pagamento de professor, online, auditoria, matrículas, resumos), `classes.all` em quase toda ação de turma.
- **Busca sem espera:** `components/shared/list/search-input.tsx` manda cada tecla; digitar um nome de 10 letras enfileira 10 cargas do espaço (alunos, lançamentos, mensagens, auditoria).
- **Listas que só crescem, filtradas no navegador:** mensagens (histórico inteiro), auditoria, cobranças em atraso de todos os meses, lançamentos do mês.
- **Chamada:** uma ação por aluno; "Todos vieram" grava um aluno por vez (já melhorado em c74e67e, mas ainda N ações).
- Telas: o painel monta cerca de 24 consultas; a ficha do aluno, cerca de 19; a turma, cerca de 20 (contando a casca).

### 3.5 Rotinas diárias e Asaas

- `app/api/cron/daily/route.ts`: percorre os espaços **um por um**, com duas tarefas cada; sem `maxDuration`. O tempo cresce com o número de clientes até estourar o limite da Vercel e deixar espaços sem mensalidade.
- `onlinePayments/gatewayCleanup.ts`: até 500 chamadas ao Asaas em sequência (cancelar e conferir), mais até 200 com um UPDATE por linha. Linhas que o Asaas diz "pago" ficam como `awaiting` e voltam primeiro na fila: se acumularem 500, a limpeza para de expirar o resto.

### 3.6 Banco

- Índices que começam por `organization_id` cobrem bem as tabelas grandes hoje (cobranças, lançamentos, matrículas, presenças, mensagens, alunos).
- `audit_logs`: a carga filtra `target->>type`, que o índice GIN não atende, e é a tabela que mais cresce.
- `attendances` sem índice por sessão ou data (hoje irrelevante porque tudo é carregado; vira lacuna quando a carga for por sessão).
- RLS chama `current_organization_id()` sem `(select …)`: pode rodar por linha nas leituras feitas com a sessão do usuário (o servidor usa a chave de serviço, então hoje pesa pouco).

## 4. Proposta (em ordem)

### Fase 0: correções urgentes (1 a 2 dias)

1. **Fim do corte em 1.000 linhas.** Uma função de leitura paginada (`selectAllPages`) usada por todas as leituras `*FromDb` sem `range`, com teste de banco de mais de 1.000 mensalidades. Prioridade máxima: é defeito, não lentidão.
2. **Rotina diária em paralelo e com limite.** Espaços processados em lotes (ex.: 5 por vez), `maxDuration` na rota e retomada do ponto onde parou; limpeza do Asaas com concorrência limitada e as linhas "pagas no Asaas" saindo da fila.

### Fase 1: ganhos rápidos no navegador (até 1 semana, sem mexer no motor)

Corta de 50% a 80% das chamadas ao servidor.

1. **Casca leve.** `useOnboardingSteps` só com a configuração inicial em aberto, e a lista de passos vinda de **uma** consulta de agregados (existe matrícula? existe presença? ...), em vez de 10 listas inteiras.
2. **Busca com espera de 300 ms** no `SearchInput` (um único lugar).
3. **Invalidação certeira.** Tirar a releitura global de auditoria e "Próximo passo" a cada gravação; trocar `.all` por chaves específicas nas mutações mais usadas (chamada, cobrança, matrícula).
4. **Gravação em lote.** "Todos vieram" e chamada concluída em uma ação só (lista de alunos); o mesmo para gerar cobranças e parcelas.
5. **Cache de catálogo.** Planos, modalidades, profissionais e configurações mudam pouco: `staleTime` de minutos e invalidação só quando mudam.

### Fase 2: parar de carregar o espaço inteiro (o que resolve de vez)

Caminho incremental, sem reescrever as regras (elas continuam as mesmas, testadas):

1. **Leituras direto no banco.** Listas e detalhes viram consultas SQL específicas (com filtro, paginação e ordenação no banco), por exemplo views/RPC por tela: chamada da aula, cobranças do mês, ficha do aluno, mensagens e auditoria paginadas. O custo passa a seguir o tamanho do resultado, não o do histórico. As leituras são a maioria das chamadas: é o maior ganho.
2. **Gravações com carga parcial.** Cada método de gravação declara o recorte de que precisa (ex.: marcar presença precisa da turma, das matrículas dela, das presenças daquela aula e dos pacotes do aluno). O `runInWorld` carrega só esse recorte e compara só ele. A regra continua igual; muda o que é carregado.
3. **Concorrência por registro, não por espaço.** A versão única do espaço sai; o controle passa a ser por linha (o `updated_at` por linha já é conferido em `apply_world_changes`) ou por agregado (aula, aluno). Dois professores em turmas diferentes deixam de conflitar.
4. **Ordem sugerida, pelo uso:** chamada e aula → cobranças → ficha do aluno → turmas → financeiro → relatórios e documentos.

### Fase 3: relatórios, histórico e infraestrutura

1. **Relatórios e documentos com agregação no banco** (SQL `GROUP BY`/views): DRE, cobranças do mês, retenção, frequência; o PDF recebe só os números.
2. **Histórico fora do caminho quente:** auditoria e mensagens só paginadas por data; índice de expressão em `audit_logs (organization_id, (target->>'type'), timestamp)`; índice em `attendances (organization_id, session_id)`.
3. **Infraestrutura:** Vercel e Supabase na mesma região (São Paulo, `gru1`/`sa-east-1`); conexões pelo pooler do Supabase (Supavisor); `maxDuration` nas rotas longas; RLS com `(select current_organization_id())`.
4. **Medir sempre:** log de tempo por ação (método, ms, linhas carregadas) e o teste de carga desta proposta (espaço de 1 ano) rodando antes de cada entrega grande, com a meta de 300 ms.

## 5. O que esperar

| Depois de | Ação comum (espaço de 1 ano) | Observação |
| --- | --- | --- |
| Hoje | 1,4 s a 4 s, crescendo com o histórico | Conflitos com várias pessoas |
| Fase 0 | Igual | Sem mensalidade faltando ou duplicada; rotina diária não estoura |
| Fase 1 | Igual por ação, mas 50% a 80% menos ações | Telas abrem bem mais rápido |
| Fase 2 | Abaixo de 300 ms, sem crescer com o histórico | Sem conflito entre turmas e alunos diferentes |
| Fase 3 | Relatórios e PDFs em segundos mesmo com anos de dados | Custo previsível de servidor |

## 6. Alternativas descartadas

- **Cache do espaço inteiro na memória do servidor (ou Redis):** na Vercel cada requisição pode cair numa instância diferente; manter o espaço inteiro sincronizado entre instâncias é frágil e caro, e não resolve os conflitos.
- **Reescrever tudo para consultas diretas de uma vez:** arriscado; as regras do motor são o que está testado. O caminho incremental troca primeiro as leituras e o recorte das gravações.
- **Aumentar `max_rows`:** esconde o defeito de 1.000 linhas por um tempo e deixa cada carga ainda mais pesada.

## 7. Andamento e decisão sobre cache (23/10/2026)

### Feito

- **Fase 0, corte em 1.000 linhas** (`7bd46c3`): `selectAllRows` (`lib/supabase/select-all.ts`) lê todas as páginas em alunos, turmas, matrículas, planos, cobranças, lançamentos, totais do extrato online, saldo, buscas do catálogo e na lista de espaços da rotina diária. Teste de banco com 1.100 mensalidades: falhava (1.000 vistas) e passa. A tela de auditoria continua mostrando as 1.000 mais recentes até ganhar paginação no servidor (fase 2).
- **Fase 0, rotinas** (`46204bb`): rotina diária com 4 espaços por vez, ordem embaralhada, prazo de 240 s (`maxDuration` 300) e contagem dos que ficaram para a próxima rodada; rotina de hora em hora com 5 chamadas ao Asaas por vez; código que o Asaas diz pago recebe a baixa com os dados do Asaas (`settleAsaasPayment`, o mesmo do webhook) e sai da fila.
- **Fase 1** (`29f291c`): barra de configuração inicial com uma leitura de contagens (`getOnboardingSnapshot`) em vez de dez listas; "Próximo passo" e passos relidos depois de gravar só enquanto há algo a fazer; busca com espera de 300 ms (Enter busca na hora); "Todos vieram" numa gravação só (`markManyAttendance`). Antes disso, a chamada já relia tudo uma vez só no fim da fila (`c74e67e`).

### Cache: onde faz sentido

Medição do tempo de uma ação num espaço de 1 ano (200 alunos, 35,6 mil presenças): **70% ida ao banco** (980 ms), 23% montar o espaço em memória (320 ms), 6% comparar para gravar (88 ms). Ou seja, o cache do espaço no servidor compensa como ponte até a fase 2.

| Camada | Decisão | Por quê |
| --- | --- | --- |
| Espaço no servidor por (espaço, versão) | **Feito** | Corta a ida ao banco quando nada mudou; correto por construção (ver abaixo) |
| Navegador (TanStack Query) | Feito em parte (fase 1) | Menos releituras; catálogo com validade maior fica para a fase 2 |
| Tabelas-resumo no banco | Fase 3 | Painel e relatórios lendo uma linha |
| Cache do Next com etiquetas | Depois da fase 2 | Com leituras pequenas por tela; hoje o espaço passa do limite por item |
| Redis/KV compartilhado | Descartado | Tráfego e decodificação de 14 a 41 MB por ação, custo mensal, mesmo problema de CPU |

**Como o cache do servidor fica correto** (`services/world/runWorld.ts`, migração 40):
- A versão do espaço avança em **toda** gravação nas tabelas do espaço: `apply_world_changes` e um gatilho por tabela (webhook, mensalidades, configurações, convites), no máximo uma vez por transação.
- Cada ação lê a versão (1 consulta). Versão igual: usa as linhas guardadas e monta a cópia de trabalho. Versão diferente ou mais de 5 minutos: lê do banco.
- Depois de gravar, `apply_world_changes_returning` devolve a versão nova e as linhas como ficaram no banco; o cache avança sem reler (a leitura que a tela faz logo depois sai do cache). Exclusão em tabela com filhas em cascata (alunos, turmas, cobranças...) descarta o cache.
- Conflito na gravação descarta o cache; a nova tentativa lê do banco. Limite de 400 mil linhas guardadas (sai o espaço menos usado). `WORLD_CACHE=off` desliga.
- Testes de banco (`worldCache.db.test.ts`): gravação direta aparece na leitura seguinte; depois de cada gravação o espaço em cache é igual a uma leitura nova do banco; o caminho de avanço é o usado.

### Números depois do cache (mesmo espaço de 1 ano, banco local)

| Ação | Antes | Com cache |
| --- | --- | --- |
| Leitura (espaço em cache) | 1,4 s | **0,23 s** |
| Gravação | 1,4 s | **0,25 s** |
| Leitura logo depois de gravar | 1,4 s | **0,23 s** |
| Primeira leitura ou depois de gravação de outra pessoa | 1,4 s | 1,2 a 1,4 s |
| 10 leituras ao mesmo tempo | 7,1 s | 2,3 s |

O que sobra (cerca de 0,23 s) é montar a cópia de trabalho do espaço inteiro, e ainda cresce com o histórico: a fase 2 continua sendo o que zera o problema. Em produção o ganho tende a ser maior, porque a ida ao banco (a parte cortada) inclui a latência entre Vercel e Supabase. O cache vale por instância do servidor: com o Fluid Compute da Vercel as instâncias são reaproveitadas, mas a primeira ação numa instância nova paga a leitura completa.
