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

As chamadas de uma aba ao servidor rodam uma por vez (Next). Cada consulta a mais é uma carga do espaço inteiro na fila. Por isso chamada externa demorada (Meta, Asaas) não pode ficar dentro da ação: desde 01/11/2026 os efeitos de `afterWorldCommit` rodam depois da resposta (`after()` do Next em `runWorld.ts`), e o envio oficial de WhatsApp usa isso (doc 07, "Envio oficial em segundo plano").

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
3. **Concorrência por registro, não por espaço (feito, seção 9).** A versão única do espaço sai; o controle passa a ser por linha (o `updated_at` por linha já é conferido em `apply_world_changes`) ou por agregado (aula, aluno). Dois professores em turmas diferentes deixam de conflitar.
4. **Ordem sugerida, pelo uso:** chamada e aula → cobranças → ficha do aluno → turmas → financeiro → relatórios e documentos.

### Fase 3: relatórios, histórico e infraestrutura

1. **Relatórios e documentos com agregação no banco** (SQL `GROUP BY`/views): DRE, cobranças do mês, retenção, frequência; o PDF recebe só os números.
2. **Histórico fora do caminho quente:** auditoria e mensagens só paginadas por data; índice de expressão em `audit_logs (organization_id, (target->>'type'), timestamp)`; índice em `attendances (organization_id, session_id)`.
3. **Infraestrutura:** Vercel e Supabase na mesma região (São Paulo, `gru1`/`sa-east-1`); conexões pelo pooler do Supabase (Supavisor); `maxDuration` nas rotas longas; RLS com `(select current_organization_id())`.
4. **Levantamento geral de índices (feito, seção 13; decisão de 23/10/2026: no fim das fases):** com os recortes, os relatórios no banco e a concorrência por linha prontos, rodar `EXPLAIN ANALYZE` nas consultas reais sobre o espaço de 1 ano e criar numa migração só os índices que faltarem, removendo os que nenhuma consulta usa. Já se sabe de um: o GIN em `audit_logs.target` não atende `target->>'type' = 'financial_entry'` (carga parcial da auditoria em toda ação).
5. **Medir sempre (log feito, seção 10):** log de tempo por ação (método, ms, linhas carregadas) e o teste de carga desta proposta (espaço de 1 ano) rodando antes de cada entrega grande, com a meta de 300 ms.

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

## 8. Fase 2: recorte por método (23/10/2026, começando pela chamada)

Cada método pode declarar o **recorte** que lê (`services/world/slices.ts`): coleções pequenas inteiras (turmas, modalidades, profissionais, planos) e, das que crescem, só as linhas necessárias (as presenças, reservas e substituição **daquela aula**, as matrículas **daquela turma**, os alunos, cobranças e pacotes **daqueles alunos**). No servidor, `runInWorld` busca só isso no banco (`loadSlicedWorld`, sempre filtrando pelo espaço), e o custo passa a seguir o tamanho do recorte, não o histórico.

**Segurança:**
- Coleção fora do recorte não existe no espaço montado: ler ou gravar nela falha na hora (`SliceMissError`). No servidor, essa falha é registrada e a ação é refeita com o espaço inteiro (nunca calcula com dado faltando).
- `WORLD_SLICE_CHECK=1` no Vitest: cada chamada de método com recorte roda também com o espaço inteiro (ids gerados iguais nas duas rodadas) e exige o mesmo resultado, o mesmo erro e as mesmas gravações (`services/world/sliceCheck.ts`). Na primeira passada, apontou que desmarcar devolve a aula a um pacote já encerrado (o recorte passou a trazer todos os pacotes dos alunos da aula).
- Teste de banco (`slices.db.test.ts`): aula pelo recorte igual à aula pelo espaço inteiro, gravações iguais e cache igual ao banco depois de gravar pelo recorte.
- A gravação continua conferindo a versão do espaço; o cache avança com as linhas devolvidas, como nas gravações com o espaço inteiro.

**Métodos no recorte:** `turmas.getSession`, `markAttendance`, `markManyAttendance`, `clearAttendance` (`services/classes/classSlices.ts`). Conferidos em 165 chamadas dos testes.

**Números (espaço de 1 ano, banco local):**

| Ação | Espaço inteiro, sem cache | Espaço inteiro, com cache | Recorte |
| --- | --- | --- | --- |
| Abrir a aula (chamada) | 1,5 s | 0,23 s | **0,05 s** |
| Marcar presença | 1,55 s | 0,25 s | **0,06 s** |

**Resto da tela da aula** (mesmo commit da cobrança): `turmas.getById`, `listWaitlist`, `reserveSession`, `cancelReservation`, `substituteInstructor`, `restorePrimaryInstructor` e `clients.list`/`listPaginated`. A conferência pegou um caso real: a checagem de "professor já dá aula nesse horário" olha as substituições de todas as turmas no mesmo dia; o recorte da substituição carrega todas (são poucas).

**Cobranças** (`services/billing/billingSlices.ts`): a leitura de cobranças gera as mensalidades que faltam, aplica o Pix Automático e o "em atraso" vale para todos os meses; o recorte é o espaço **sem o histórico que cobrança não usa** (presenças, mensagens, avaliações, lançamentos e regras do financeiro, lista de espera, substituições). Vale para listar, gerar, cobrança avulsa, limpar, pagar, desfazer, cancelar e reabrir. Conferido em 298 chamadas.

| Espaço de 1 ano | Espaço inteiro, sem cache | Espaço inteiro, com cache | Recorte |
| --- | --- | --- | --- |
| Cobranças do mês | 1,2 a 1,5 s | 0,38 s | **0,17 s** |

O recorte de cobranças ainda cresce com alunos e cobranças (cerca de 12 por aluno por ano), bem mais devagar que as presenças; um recorte por linha (o mês e os em aberto) fica para depois de mover a geração de mensalidades e o Pix Automático para fora da leitura.

**Ficha do aluno e turmas** (`clients/clientSlices.ts`, `classes/classSlices.ts` e os recortes de pacotes, mensagens, Pix Automático e notas): a ficha lê o catálogo e só o histórico **daquele aluno** (matrículas, presenças, cobranças, pacotes, reservas e mensagens); a turma lê as matrículas, a lista de espera, as reservas e as cobranças dela e o histórico **dos alunos dela**. Vale para `studentSummary.getStudentSummary`, `packages.listStudentPackages`, `communication.listLogs`/`listLogsPaginated`, `onlinePayments.getRecurringForStudent`, `turmas.list`, `listSessions` (só as marcações das aulas do período), `listEnrollments`, `deactivate`, `reactivate`, `setEnrollmentPayment`, `promoteFromWaitlist`, `removeFromWaitlist` e `grades.listClassAssessments`. A conferência pegou dois casos: inativar a turma cancela reservas e cobranças avulsas de quem não é matriculado (o recorte traz as reservas e cobranças da turma) e a lista de aulas conta vagas de pacote (traz os pacotes).

| Espaço de 1 ano (35 mil presenças) | Espaço inteiro, sem cache | Recorte |
| --- | --- | --- |
| Ficha do aluno | 1,5 a 1,6 s | **0,035 s** |
| Matrículas da turma | 1,5 a 1,6 s | **0,12 a 0,14 s** |

**Financeiro e pagamento de professores** (`finance/financeSlices.ts`): o caixa soma cobranças, lançamentos e pagamentos de professor, a prévia do professor conta matrículas, avulsas e pacotes, e a recorrência gera mensalidades e aplica o Pix Automático; nada disso usa presenças, mensagens, avaliações nem a lista de espera, que ficam fora. Vale para todos os métodos de `finance` e `teacherPay`. A conferência pegou um caso: excluir um lançamento pago e depois desfeito é recusado pela auditoria ("já foi pago uma vez"); o recorte traz só a auditoria dos lançamentos (a mesma carga parcial do espaço inteiro, `partialLoad`), agora também no carregador do recorte. Conferido em 252 chamadas (sem chamada nos testes: `getMonthlySeries`, `listTeachers`, `listRules`, `applyRecurringAutoPayments`).

| Espaço de 1 ano (35 mil presenças) | Espaço inteiro, sem cache | Recorte |
| --- | --- | --- |
| Resumo do financeiro do mês | 1,45 a 1,48 s | **0,04 s** |

Como o de cobranças, este recorte ainda cresce com cobranças e lançamentos (dezenas por aluno por ano), não com presenças. O próximo passo para ele é um recorte por período, junto com o de cobranças.

**Relatórios e documentos** (`reports/reportSlices.ts`, `server/documentSlices.ts`): nenhum relatório lê mensagens nem avaliações, e só a lista de chamada lê presenças, as das aulas do mês. Cada documento lê só o que mostra: o recibo, a cobrança e o aluno; a declaração anual, as cobranças do aluno; o boletim, o aluno e as avaliações; o extrato online, os Pix e as cobranças deles; o demonstrativo do professor e o certificado, os recortes de `teacherPay.getPayoutPreview` e de `turmas.getCourseCertificate`. Os documentos não passam pelo `delegate`: o miolo de cada um virou uma função (`*Model`) e `server/__tests__/documentSlices.test.ts` chama a conferência direto, com cobrança paga, em aberto e inexistente e os 8 relatórios. Conferido em 22 chamadas de relatório, 26 de documento e 9 de certificado.

**Falha real achada na medição:** o filtro `in` ia em lotes de 150 valores, e 150 ids de aula (`turma~data~hora`, mais de 50 caracteres cada) estouram a URL do PostgREST ("URI too long"). Com ids de verdade, a lista de aulas de um período com muitas turmas e a lista de chamada do mês caíam no espaço inteiro. Os lotes agora contam caracteres (`inChunks`, até 3.000 por lote), com teste de banco de 400 aulas que falhava antes da correção.

| Espaço de 1 ano (35 mil presenças) | Espaço inteiro, sem cache | Recorte |
| --- | --- | --- |
| Cadastro de alunos | 1,35 a 1,38 s | **0,03 s** |
| Lista de chamada do mês | 1,37 a 1,44 s | **0,12 a 0,14 s** |

**Como acrescentar um recorte:** declarar em `<domínio>/<domínio>Slices.ts`, registrar `slices` no namespace em `world/registry.ts`, rodar `WORLD_SLICE_CHECK=1 pnpm --filter @gestarahub/web test` e, se a conferência apontar uma coleção ou linha que faltou, ampliar o recorte. Filtro por um campo novo entra também em `SCOPE_FIELDS` (`world/scopes.ts`, seção 9).

## 9. Concorrência pelo que a ação leu (23/10/2026, migração 42)

Antes, toda gravação exigia a mesma versão do espaço da leitura: duas ações ao mesmo tempo no mesmo espaço conflitavam mesmo sem mexer nas mesmas coisas, e a perdedora recarregava e tentava de novo (até 3 vezes) antes de mostrar "Outra pessoa mudou esses dados agora".

**Como ficou** (`services/world/scopes.ts`, migração 42):
- O que um recorte lê vira **baldes** (hash de coleção, campo e valor): ler as presenças da aula X lê o balde (presenças, aula, X); ler uma coleção inteira lê o balde dela. Cada linha gravada marca os baldes dos campos de filtro (antes e depois) e o da coleção inteira.
- `world_buckets` guarda, por espaço e balde, a versão da última gravação que o marcou. A gravação com recorte só conflita se um balde que ela leu foi marcado **depois da leitura**. São 65.536 baldes por espaço: dois escopos podem cair no mesmo balde, o que só dá um conflito a mais, nunca um a menos.
- Os campos pelos quais um recorte pode filtrar ficam em `SCOPE_FIELDS`; filtrar por um campo fora da lista falha na hora (servidor e conferência dos testes), para nenhum conflito passar sem ser visto.
- **Gravação direta** (fora do motor: webhook do Asaas, rotinas, configurações) não sabe dos baldes: o gatilho da migração 40 passa a marcar `world_versions.direct_version`, e ela conflita com toda ação com recorte lida antes dela, como antes.
- **Ação sem recorte** (espaço inteiro) segue a regra de antes: qualquer gravação no meio conflita. Mesmo assim, ela marca os baldes do que grava, e quem leu pelo recorte vê.
- As gravações de um espaço continuam uma por vez no banco (trava curta na linha de `world_versions`); muda quem precisa **tentar de novo**. O cache avança quando está na versão logo antes da gravação (antes exigia a versão lida, que com recorte pode ser mais antiga).
- O `updated_at` por linha continua conferido em toda atualização.

**Testes de banco** (`world/__tests__/concurrency.db.test.ts`, as duas ações intercaladas de propósito): chamadas de turmas diferentes gravam as duas; a mesma aula conflita; gravação direta, ou com o espaço inteiro, no que o recorte leu conflita; com o espaço inteiro em outra turma, não conflita. Com a regra antiga, os casos de turmas diferentes falham.

| 10 professores marcando chamada ao mesmo tempo, turmas diferentes | Gravadas | Conflitos | Tempo |
| --- | --- | --- | --- |
| Versão única do espaço (antes) | 3 de 10 (7 viram "Outra pessoa mudou") | 24 | 0,24 s |
| Pelo que a ação leu | **10 de 10** | **0** | **0,15 s** |

**Ainda vale saber:**
- Cobranças e financeiro leem coleções inteiras (cobranças, alunos, matrículas): conflitam com qualquer gravação nelas, como antes. Diminui quando esses recortes forem por período.
- `world_buckets` cresce com os escopos tocados (no máximo 65.536 linhas por espaço). Se pesar, dá para reduzir os baldes ou limpar os antigos.

**Fase 2 concluída.** Próximo: fase 3 (relatórios somando no banco, histórico fora do caminho quente, infraestrutura) e, no fim, o levantamento geral de índices.

## 10. Fase 3 (23/10/2026)

**Feito:**
- **Auditoria no banco** (`audit/auditLogPage.ts`, `listAuditLogPage`): filtros (tipo, autor, período, busca), visibilidade por perfil e paginação de 50 em 50 rodam na consulta, com o total de verdade. Antes, a tela trazia os 1.000 eventos mais recentes e filtrava depois: num espaço com histórico, o filtro por tipo escondia eventos antigos que existiam. A tela pede a próxima página em "Carregar mais eventos" (`useInfiniteQuery`).
- **Falha de segurança corrigida no caminho:** o perfil de quem vê a auditoria vinha do navegador. Um Gerente que chamasse a ação com "owner" via os eventos que são só do Dono. Agora o perfil sai da sessão no servidor, e a ação pede `audit:view`. Teste de banco: `audit/__tests__/auditLogPage.db.test.ts` (1.104 eventos: total, ordem, filtro que antes sumia, busca com `%` e `_`, visibilidade do Gerente).
- **Log de tempo por ação** (`world/runWorld.ts`): toda ação acima de 300 ms sai no log do servidor com o método, de onde leu (recorte, cache ou banco), linhas e o tempo de ler, aplicar a regra e gravar. Com `WORLD_TIMING=1`, sai em toda ação. Conflitos que fazem a ação tentar de novo também saem (`serviceActions.ts`).
- **RLS com `(select …)`** (migração 43): as 63 políticas que chamavam `current_organization_id()`/`current_user_profile()` passam a calcular uma vez por consulta, não por linha. Conferido: o texto de todas as 64 políticas é o mesmo de antes, tirando o embrulho.
- **Limpeza dos baldes** (migração 43): `world_buckets.updated_at` e a rotina `world-buckets-prune-daily` (pg_cron, 03:30 de Brasília) apagam os baldes sem mudança há mais de 1 dia. Um balde só importa enquanto uma ação leu e ainda não gravou (no máximo os 5 minutos de uma rota); a tabela fica com o que mudou nas últimas 24 h.

**Medição com histórico realista** (1 ano: 28 mil presenças, 2 mil cobranças, 6 mil mensagens, 300 lançamentos; banco local, sem cache):

| Ação | Tempo |
| --- | --- |
| Cobranças do mês | 0,13 a 0,14 s |
| Resumo do financeiro | 0,13 a 0,14 s |
| Histórico de mensagens (todas) | 0,20 s |
| Mensagens de um aluno | 0,01 a 0,02 s |
| Extrato de cobranças (relatório) | 0,11 a 0,13 s |
| Ficha do aluno | 0,01 a 0,03 s |

**Decidido não fazer agora (com o motivo):**
- **Relatórios somando no banco (item 1):** os relatórios saem em 0,03 a 0,14 s pelo recorte. Reescrever as regras em SQL duplicaria regra testada sem ganho visível. Volta quando o log de tempo mostrar relatório acima de 300 ms.
- **Mensagens paginadas no banco:** a leitura do histórico também dispara as felicitações de aniversário (grava), então não é uma consulta simples. Hoje 0,2 s com 6 mil mensagens; cresce com o histórico (cerca de 0,6 s em 3 anos). Próximo candidato quando passar de 300 ms: separar as felicitações da leitura e paginar como a auditoria.
- **`maxDuration` nas rotas de documento:** com o Fluid Compute da Vercel, o padrão já é 300 s, e os documentos saem em menos de 0,2 s. As rotinas (rotas longas de verdade) já tinham `maxDuration`.
- **Região e pooler:** é configuração do deploy, não código. Vercel em `gru1` e Supabase em `sa-east-1`. O app fala com o banco pelo PostgREST (supabase-js), que já usa o pool do Supabase; o pooler (Supavisor) só importa para conexão direta ao Postgres, que o app não usa.

**Achado (registrado, não corrigido):** cada linha gravada pelo motor custa de 1,5 a 3 ms no banco (`apply_world_changes` faz 3 consultas por linha). No uso normal não aparece (gerar as mensalidades de 200 alunos são 200 linhas, cerca de 0,5 s), mas uma gravação de milhares de linhas de uma vez, como importação em massa, passa do tempo limite da consulta. Se a importação vier, o caminho é gravar por tabela em lote (`INSERT ... SELECT FROM jsonb_to_recordset`) em vez de linha a linha.

**Segunda falha de segurança na auditoria, corrigida em seguida** (migração 44): a gravação de eventos das ações que rodam no navegador aceitava o evento inteiro vindo dele, inclusive o autor, e a política de inserção de `audit_logs` só conferia o espaço. Quem estivesse logado podia gravar no próprio espaço um evento em nome de outra pessoa, pela ação ou direto pelo cliente do Supabase. Agora o navegador manda só o que aconteceu (ação, alvo, frase sem o autor, mudanças); autor, espaço, unidade (conferida), hora e id saem da sessão no servidor, que grava com a chave de serviço. A sessão não insere mais em `audit_logs`. Teste de banco em `rules.db.test.ts` (falha com a política antiga).

**Falta da fase 3:** o levantamento geral de índices (item 4), combinado para o fim.

## 11. Gravação em lote no motor (23/10/2026, migração 45)

**Por que:** toda chamada ao banco pelo servidor tem limite de 8 s (`statement_timeout` do PostgREST). O motor gravava linha por linha: 4 a 5 consultas montadas na hora (`EXECUTE`) por linha, o que dava de 1,5 a 3 ms por linha. Na `audit_logs`, a única tabela do motor com chave uuid, a busca "essa linha já existe?" comparava `id::text`, o que impede o índice: cada evento gravado percorria a tabela inteira, e o custo crescia com o histórico (correção de 23/10/2026: nas outras tabelas a chave é texto e a conversão não atrapalhava o índice). Uma gravação de alguns milhares de linhas (as mensalidades de um espaço grande, por exemplo) falhava inteira, e as outras gravações do espaço esperavam atrás dela.

**Como ficou:** `apply_world_changes` separa as mudanças em grupos seguidos da mesma tabela e do mesmo tipo (o app manda `op`: nova ou alterada), numa consulta só, e grava cada grupo com um comando (`world_upsert_batch`, `world_delete_batch`). Os ids são comparados no tipo da coluna (uuid ou texto), sempre com o índice. As regras não mudaram: linha do espaço da sessão, id de outro espaço recusado (42501), `expected` conferido (40001), atualização só das colunas que vieram, inserção com os padrões do banco e a ordem entre os grupos que o app mandou. A volta das linhas gravadas também é uma consulta por tabela.

| 6.000 linhas numa gravação | Antes | Agora |
| --- | --- | --- |
| Inserir | passa de 8 s (falha) | **0,36 s** |
| Alterar | passa de 8 s (falha) | **0,37 s** |
| Apagar | passa de 8 s (falha) | **1,1 s** |

Testes de banco: `world/__tests__/batchWrites.db.test.ts` (6.000 linhas: inserir, alterar só o status e apagar; linha de outro espaço no meio do lote não grava nada) e os 72 de antes.

## 12. Leituras sem gravação e histórico de mensagens no banco (23/10/2026)

**Parabéns automático na rotina** (`communication/birthdayGreetingsCron.ts`): antes rodava na leitura do histórico de mensagens e das métricas. Dois problemas: a leitura gravava (conflito, repetição, risco de envio duplicado no oficial) e o parabéns só saía se alguém abrisse a tela de mensagens depois do horário da regra. Agora a rotina de hora em hora (`/api/cron/online-payments`, migração 34) roda a mesma regra em cada espaço com o WhatsApp oficial conectado, com recorte (alunos, modelos e só os parabéns já registrados). A regra não mudou: a partir do horário dela, um por aluno por dia, no fuso do Brasil (`instrumentation.ts`). Testes: os de parabéns em `communication.test.ts` rodam a regra como a rotina, conferem que abrir o histórico não envia e conferem o recorte contra o espaço inteiro; `birthdayGreetingsCron.db.test.ts` roda no banco (envia uma vez; a segunda rodada não repete).

**Histórico de mensagens paginado no banco** (`communication/messageLogPage.ts`, `listMessageLogPage`, `messageLogsPage`): a aba Histórico pede só a página, com situação, tipo, busca (nome, telefone ou texto) e total feitos na consulta. Antes trazia o histórico inteiro (e acima de 1.000 mensagens cortava). O tipo usa a mesma regra do espaço local (`messageKindMatches`). As outras leituras de mensagens (ficha do aluno, painel) leem só as do aluno ou do gatilho. Teste de banco: `messageLogPage.db.test.ts` (1.200 mensagens: total, ordem, tipos, situação, aluno, busca com `%`/`_`, telefone formatado e texto).

**Mensalidades geradas na leitura de cobranças: mantidas (analisado).**
- O Pix Automático na leitura não roda no servidor: as autorizações só existem no espaço de demonstração.
- A geração na leitura só grava quando falta mensalidade, e é a rede de segurança entre um evento (aluno reativado, troca de plano, madrugada do dia 1º) e a rotina das 06:00. Não duplica: o índice único por período recusa a segunda, que conflita, tenta de novo e encontra a cobrança pronta.
- Tirar da leitura faria a cobrança desses casos aparecer só no dia seguinte: mudança de comportamento com mais risco que ganho.

**Produção:** região (Vercel `gru1`, Supabase `sa-east-1`) e pooler ficam no checklist de publicação, junto com a ordem das migrações 40 a 45 e a conferência das rotinas do pg_cron.

## 13. Levantamento geral de índices (23/10/2026, migração 46)

**Como foi feito:** um espaço de 1 ano no banco local (200 alunos, 12 turmas, 28 mil presenças, 2 mil cobranças, 6 mil mensagens, 300 lançamentos, 30 mil eventos de auditoria). Com as estatísticas zeradas, as ações reais do app rodaram três vezes: carga do espaço inteiro sem cache, aula e chamada, aulas da semana, turmas, cobranças do mês, financeiro, alunos, ficha, mensagens por aluno e por gatilho, relatórios, páginas de auditoria e de mensagens, declaração anual e as rotinas (mensalidades, recorrências, parabéns). Depois, `pg_stat_statements` para as consultas que mais pesaram e `EXPLAIN ANALYZE` de cada uma.

**Cuidado na leitura:** no banco local, esse espaço tem quase todas as linhas, então o Postgres prefere o índice só por espaço para tudo, e a contagem de uso local não prova que um índice é inútil em produção. Os índices seguem a forma das consultas do código, conferida com a varredura sequencial também desligada.

**O que mudou:**
1. **(organization_id, id) em todas as 25 tabelas do espaço**, no lugar do índice só de `organization_id`, que vira prefixo dele. A carga do espaço inteiro e o `load.all` dos recortes leem "linhas do espaço, por id, de mil em mil": sem esse índice, cada página ordenava todas as linhas do espaço (nas presenças, ordenação em disco).
2. **Paginação pela chave** em `loadRows` (`world/runWorld.ts`): "depois do último id" em vez de "pular N linhas". Antes, a página 28 das presenças percorria as 27 mil anteriores.
3. **Auditoria:** `(organization_id, (target->>'type'), timestamp DESC, id DESC)` atende a carga parcial dos lançamentos (em toda carga do espaço) e a página por tipo; a página geral ganha o `id` no índice de data. Sai o GIN em `target`: nenhuma consulta usa "contém", e ele pesava em toda gravação da tabela que mais cresce.
4. **Mensagens:** página com `(organization_id, sent_at DESC, id DESC)` e leitura por gatilho (painel) com `(organization_id, trigger)`.
5. **Duplicados que saíram:** presenças por aula e substituições por aula, cobertos pelos índices únicos `(organization_id, session_id, ...)`.

| Consulta (espaço de 1 ano) | Antes | Depois |
| --- | --- | --- |
| Presenças, página 28 da carga do espaço | 33 ms (ordenação em disco) | 17 ms pelo índice; constante com a paginação pela chave |
| Carga parcial da auditoria | 13,5 ms | 2,7 ms |
| Presenças das aulas de uma semana | 20,6 ms | 0,6 ms |
| Página de mensagens | 1,4 ms | 0,17 ms |
| Página da auditoria por tipo | 0,08 ms | 0,03 ms |
| **Carga do espaço inteiro, sem cache (app)** | **1,17 s** | **0,63 s** |

As ações com recorte (cobranças, financeiro, mensagens, relatórios) já liam pouco e ficaram iguais, dentro da variação. O que sobra na carga do espaço inteiro é trazer as 28 mil presenças pela rede, que só acontece sem cache e nas ações sem recorte.

**Mantidos de propósito:** os índices por campo que o código filtra (aluno, turma, aula, situação, vencimento, competência, recorrência) e os únicos, que protegem regras (mensalidade por período, lançamento por competência da recorrência, presença por aula e aluno). Alguns, como cobranças por tipo ou situação, separam pouco dentro de um espaço, mas pesam pouco na gravação; sem prova de que sobram, ficam. Revisar com `pg_stat_user_indexes` em produção, depois de alguns meses de uso real.

**Produção:** a migração cria os índices sem `CONCURRENTLY` (roda em transação e, na primeira publicação, as tabelas estão vazias). Para recriar com dados, rodar à mão com `CREATE INDEX CONCURRENTLY`.
