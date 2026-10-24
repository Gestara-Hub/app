# 15 — Retirada do mock no modelo de turmas

> Histórico: as fatias 1 a 5 foram feitas (22/10/2026); o modelo de turmas roda no banco. O resumo do que vale hoje está em `docs/technical/19-desempenho-e-escala.md` e `docs/guides/16-ambiente-local.md`.

Data: 2026-10-21.

> **Status:** Decidido e planejado em 21/10/2026. Execução por fatias, na ordem abaixo. Cada fatia fecha com typecheck, lint e testes verdes e um commit próprio.
> **Contexto relacionado:** [06 — Passagem para o backend](technical-06-passagem-backend.md), [08 — Backend no Supabase](../technical/08-backend-supabase.md), [12 — Modularização da camada de serviços](../technical/12-modularizacao-da-camada-de-servicos.md).

## Decisao

1. **Objetivo:** no modelo de turmas, a conta real lê e grava só no Supabase. O cache passa a ser o do TanStack Query. Somem o `localStorage` de dados (`gestarahub:db`), os `sync*FromDb` e os `if (isSupabaseOrganization(...))` dos serviços.
2. **Demonstração (decidido em 21/10/2026: opção b):** a conta de demonstração vira um **espaço real no banco, criado por seed**, e o mock (`mocks/store`, `mocks/seed`, `simulateRead`/`simulateWrite`) é apagado ao fim. Não haverá dois caminhos no código.
3. **Técnica para não reescrever as telas:** as telas dependem de read-models montados por funções puras (`buildClassGroupView`, `buildSessionRoster`, cálculo de cobranças, resumo do aluno). Elas continuam iguais, mas passam a rodar no **servidor** (server actions), alimentadas pelo banco, em vez de no navegador alimentadas pelo store. A troca é da fonte dos dados, não da regra.
4. **Regras de consistência no banco:** o que hoje só vale no navegador (conflito de horário, capacidade, gasto de pacote, geração de cobranças) passa a ser conferido no servidor, com transação ou função SQL, como já é a chamada com pacote (`apply_attendance_with_packages`, migração 19).

## Contexto

Hoje (21/10/2026), nas contas reais, cada serviço grava no store **e** no banco, e lê sincronizando do banco para o store. As telas leem do store. O levantamento do código mostrou o que ainda escapa do banco:

| Onde | O que fica só no navegador | Efeito |
|---|---|---|
| `billingService.autoGenerateMembershipCharges` | mensalidades geradas ao abrir Cobranças, Painel, Financeiro, Relatórios e resumo do aluno | outro aparelho não vê; cobrar online uma delas falha (a cobrança não existe no banco) |
| `financeService` (materialização de recorrências) | lançamentos recorrentes gerados na leitura | mesmo problema |
| `onlinePaymentsService.expireStale` | expiração local dos códigos online | resolvido em 21/10/2026: o servidor expira, o local só na demonstração |
| `certificatesService` | modelo e logo do certificado | some ao limpar o navegador |
| `rolesService` | cargos da equipe | a tabela `roles` existe, o serviço não usa |
| validações do serviço | conflito de horário do professor, capacidade, parcelas | duas abas abertas furam a regra |

## Escopo

Modelo de turmas: modalidades, equipe e cargos, planos, catálogo de pacotes, alunos e responsáveis, turmas, matrículas, chamada, avulsas e experimentais, lista de espera, substituições, cobranças, recebimentos online, pacotes do aluno, notas e evolução, certificado, financeiro, repasse de professores, comunicação, configurações do espaço, auditoria, Painel, relatórios e resumo do aluno.

**Fora:** Pix Automático real (adiado, depende de CNPJ com 6 meses e da regra do split), agenda e serviços do modelo de barbearia (fora do foco), assinatura do GestaraHub (já no Asaas).

## Fatias

### Fatia 1 — Fechar o que hoje se perde (prioridade)

- [x] **Mensalidades automáticas no servidor** (21/10/2026). O planejamento virou função pura em `packages/core/src/membership-generation.ts` (a mesma regra para a demonstração e para a conta real). Na conta real, `ensureMembershipCharges` chama `generateMembershipChargesAction` (`services/billing/membershipBackend.ts`), que lê do banco, planeja e grava por `insert_membership_charges`; o índice único `uq_charges_membership_period` (aluno + período, mensalidade não cancelada) impede duplicata entre aparelhos, e as duplicadas que existiam foram canceladas pelo sistema (migração 25). O navegador não gera mais mensalidade na conta real, e as que só existiam no `localStorage` saem na sincronização. Pontos que garantem a geração: Cobranças (lista e "Gerar cobranças"), Financeiro, Relatórios e resumo do aluno.
- [x] **Supabase Cron diário** (21/10/2026). A migração 26 liga `pg_cron` e `pg_net` e agenda `membership-charges-daily` (06:00 de Brasília), que chamava `POST /api/cron/membership-charges` (desde a migração 27, `/api/cron/daily`) com `Authorization: Bearer CRON_SECRET`; a rota roda `generateMembershipChargesAction` em todo espaço de turmas ativo (um espaço com erro não para os outros). URL do app e segredo ficam no Vault de cada ambiente (`app_url`, `cron_secret`); localmente, `pnpm cron:local` prepara os dois e o `CRON_SECRET` do `.env.local`, e precisa rodar de novo depois de `supabase db reset`. Testado no local: o banco chamou a rota e a geração respondeu 200. **Produção:** criar os dois segredos no Vault do projeto e o `CRON_SECRET` na Vercel.
- [x] **Recorrências do Financeiro** (21/10/2026). Já gravavam no banco, mas eram geradas no navegador de quem abria o Financeiro, sem proteção contra duplicata entre aparelhos. Agora `materializeRecurrencesAction` (`services/finance/financeBackend.ts`) aplica a regra pura `materializeRecurrence` sobre o banco e grava por `insert_recurrence_entries`; o índice único `uq_financial_entries_recurrence_competence` impede dois lançamentos ativos da mesma recorrência no mês, e as duplicadas existentes foram canceladas (migração 27). O cron diário passou a chamar `POST /api/cron/daily`, que roda mensalidades e recorrências em cada espaço.
- [x] **Expiração local dos códigos online** (21/10/2026). `expireStale` (`onlinePaymentsService`) só roda na demonstração; na conta real quem expira e exclui no Asaas é o servidor (`expireDueOnlinePayments`), e o navegador só lê o status do banco.
- [x] **Modelo do certificado** (21/10/2026). Coluna `organizations.certificate_template` (jsonb, null = padrão, migração 28), lida e gravada por `services/certificatesBackend.ts`; a tela do modelo e o certificado da matrícula leem do banco antes de montar. A logo já ia para o bucket privado `attachments` pela rota `/api/attachments`; o modelo guarda só o id.
- [x] **Cargos da equipe** (21/10/2026). `rolesService` lê e grava a tabela `roles` (`services/rolesBackend.ts`); a Equipe sincroniza os cargos antes de listar e de validar o cargo escolhido. O índice `uq_roles_organization_name` (migração 28) deixa o nome único por espaço, sem acento nem caixa, como a validação da tela. Cargo criado antes só no navegador sobe uma vez para o banco.
- **Pronto quando:** numa conta real, limpar o `localStorage` e abrir em outro navegador mostra exatamente os mesmos dados, inclusive as mensalidades do mês e o modelo do certificado.

### Fatia 2 — Leitura direto do banco, por domínio

Para cada domínio: os read-models passam a ser montados por server actions a partir do banco (reusando as funções puras), os hooks do TanStack Query chamam essas actions, e o `sync*FromDb` e a escrita no store daquele domínio são apagados.

**Junto com a modularização do [doc 12](../technical/12-modularizacao-da-camada-de-servicos.md)** (decidido em 21/10/2026): nos domínios com serviço grande, o primeiro passo é dividir o serviço em pasta por subdomínio (`*Views.ts`, `*Validation.ts`, sub-serviços e `index.ts` com o nome antigo), só movendo código, num commit próprio com testes verdes. A troca da fonte para o banco vem no commit seguinte; nunca os dois juntos, para saber de onde veio uma quebra. Os `*Views.ts` são o que passa a rodar no servidor, e os `*Validation.ts` são a base da fatia 3.

**Como cada domínio passa para o banco** (definido em 21/10/2026, no 2.1):

1. **Actions por domínio** (`services/<domínio>/*Actions.ts`, `"use server"`): o espaço, o usuário e o perfil saem de `requireTenant()` (`services/server/tenant.ts`), que lê o usuário autenticado no Supabase e usa o cliente da sessão, com RLS. A action nunca recebe `organizationId` do navegador e nunca cai no cliente administrativo; sem sessão, devolve 401. Escrita confere a permissão com `ctx.require(...)`, além do RLS.
2. **Erro como valor:** a action devolve `ActionResult` (`services/server/action.ts`). Erro lançado numa action perde a mensagem em produção, então o `ApiError` volta como valor e o serviço do navegador relança com `unwrap`. Os construtores de erro ficam em `@gestarahub/core/api-error`.
3. **Regras sem store:** validação e cálculo saem para módulos puros (`*Rules.ts`, `*Validation.ts`) que recebem os dados como parâmetro. A demonstração passa o `store`; a action passa o que leu do banco.
4. **Serviço do navegador:** na conta real chama a action e não grava no store; na demonstração segue no store até a fatia 4.
5. **Cópia de transição:** domínios ainda não migrados montam telas no navegador a partir do store. Até migrarem, o serviço migrado guarda no store uma cópia do que leu ou gravou (`cache*`), marcada no código, e as sincronizações antigas recarregam do banco o que precisam. A cópia sai na fatia 4.
6. **Testes no banco:** `pnpm --filter @gestarahub/web test:db` roda os `*.db.test.ts` contra o Supabase local, com um espaço e usuários criados por teste e as actions chamadas como numa requisição (`src/test/db.ts`). É a base da fatia 5.

**Do 2.2 em diante: o serviço inteiro roda no servidor** (decidido em 21/10/2026). Portar à mão cada regra com efeitos encadeados (inativar o aluno encerra matrículas, cancela parcelas, tira da lista de espera e cancela o código no Asaas) duplicaria a regra e erraria. Em vez disso:

1. **Espaço da requisição** (`services/world/`): a action genérica `serviceAction("<serviço>.<método>", args)` confere a sessão e a permissão do método (`world/registry.ts`), carrega do banco o espaço inteiro no formato do `store` (`runWorld.ts`, com `tables.ts` convertendo campo `fooBar` para coluna `foo_bar`), roda o **mesmo método** do serviço com o `store` e o ator apontando para esse espaço (`AsyncLocalStorage`, `scope.ts`) e grava só as linhas que mudaram.
2. **Gravação numa transação:** `apply_world_changes` (migração 30) recebe inclusões, alterações e exclusões, roda com o RLS do usuário (SECURITY INVOKER) e recusa tudo se uma linha mudou depois da leitura (`updated_at` diferente, erro `CONFLICT` "Outra pessoa mudou esses dados agora"). Isso já cobre a concorrência entre abas da fatia 3 para o que é a mesma linha.
3. **Efeitos externos depois da gravação** (`world/effects.ts`): cancelar o código no Asaas, por exemplo, só acontece se a gravação no banco deu certo.
4. **No navegador**, os serviços do modelo de turmas são embrulhados por `delegateAll` (alunos, turmas, cobranças, pacotes do aluno, financeiro, repasse, notas, comunicação, relatórios, resumo do aluno, onboarding, certificado e checkout online): na conta real cada método vai para o servidor; na demonstração, roda local. Ficam no navegador só o que mexe com arquivo ou com a configuração do gateway, e o catálogo (2.1), que tem actions próprias e leves.
5. **Os ramos antigos** de banco dentro dos serviços (`isSupabaseOrganization(...)`) viraram `realAccountInBrowser()`, falso dentro do servidor, e os que ficaram mortos foram apagados. O esquema das tabelas do espaço é gerado do banco (`pnpm --filter @gestarahub/web world:schema`, rode depois de migração que mexa nelas).
6. **Custo conhecido:** cada chamada carrega o espaço inteiro (em páginas de 1000 linhas). Serve para o tamanho dos espaços de hoje; quando pesar, cada método passa a declarar as coleções de que precisa (2.9).

Ordem, de quem depende de menos para quem depende de mais:

- [x] 2.1 Catálogo: modalidades, equipe, cargos, planos, catálogo de pacotes (21/10/2026). Actions em `services/catalog/` (`categoriesActions`, `teamActions`) e `services/billing/catalogActions`; regras em `categoryRules`, `teamRules`, `planRules` e `billingValidation` (sem store). Modalidade com nome único sem acento nem caixa no banco (migração 29, `name_key`, a mesma dos cargos). Trocar a trilha da modalidade grava no banco a volta dos alunos ao primeiro nível, e revisar a modalidade marca `modalitiesReviewed` no espaço, que antes ficavam só no navegador. Cargos criados só no navegador antes da migração 28 não sobem mais para o banco. Testes: `catalog/__tests__` e `billing/__tests__` (`*.db.test.ts`).
- [x] 2.2 Alunos e responsáveis (ficha, lista, inativação). Divisão feita (`services/clients/`, 21/10/2026, fase 2 do doc 12).
- [x] 2.3 Turmas, matrículas, chamada, avulsas e experimentais, lista de espera, substituições, calendário. Divisão feita (`services/classes/`, 21/10/2026, fase 1 do doc 12).
- [x] 2.4 Cobranças e recebimentos online. Divisão feita (`services/billing/`, 21/10/2026, fase 4 do doc 12).
- [x] 2.5 Pacotes do aluno (venda, uso, renovação). Divisão feita (`services/billing/`, 21/10/2026).
- [x] 2.6 Notas, evolução e certificado.
- [x] 2.7 Financeiro e repasse de professores. Divisão feita (`services/finance/`, 21/10/2026, fase 3 do doc 12).
- [x] 2.8 Comunicação (modelos, histórico, WhatsApp).
- [x] 2.9 Agregados: Painel, relatórios e resumo do aluno, com consultas agregadas no banco onde o volume pedir.
- **Pronto quando, por domínio:** a tela funciona com o `localStorage` vazio e sem o `sync*FromDb` daquele domínio; os testes do domínio passam (fatia 5).
- **Feito em 21/10/2026 (2.2 a 2.9):** todos esses domínios rodam no servidor pela técnica acima; os `sync*FromDb` e as actions antigas por tabela foram apagados (elas aceitavam `organizationId` de quem chamava e, sem sessão, caíam no cliente administrativo). As leituras usadas só pelo cron (`membershipBackend`, `financeBackend` e as listas que eles usam) viraram módulos só do servidor, sem `"use server"`. Testes no banco: `world/__tests__` (`world.db.test.ts`, `flows.db.test.ts`, `flows2.db.test.ts`) cobrem cadastro, edição e inativação do aluno, turma, matrícula, chamada, lista de espera, avulsa, substituição, curso parcelado, mensalidade gerada e baixa, venda de pacote, notas, mensagem, lançamento, repasse (regra, fechamento e pagamento), modelo do certificado, relatório e troca de plano. Ainda não verificado no navegador (fica para o e2e da fatia 5). Fica para depois: cada método declarar as coleções que carrega (custo do item 6 acima).

### Fatia 3 — Regras no servidor

- [x] Conflito de horário do professor e horário de funcionamento ao criar e editar turma (21/10/2026): a validação roda no servidor sobre o banco (fatia 2).
- [x] Capacidade da turma e da aula (matrícula, avulsa, promoção da lista de espera) na mesma transação da gravação (21/10/2026).
- [x] Geração de parcelas de curso e de pacote numa transação com a matrícula ou a venda (21/10/2026): tudo o que um método muda vai numa chamada só de `apply_world_changes`.
- [x] Permissões e escopo do professor conferidos no servidor e no RLS (21/10/2026).
- **Como ficou (migrações 32 e 33):**
  1. **Versão por espaço** (`world_versions`): o servidor lê a versão antes das tabelas e a gravação confere; se outra gravação do mesmo espaço entrou no meio, aborta (40001) e o servidor roda o método de novo sobre o banco atual (até 3 vezes). Assim a regra (vaga, horário, parcelas) sempre vale sobre o estado mais novo. Métodos com efeito externo antes da gravação (gerar código no Asaas, enviar WhatsApp) não repetem sozinhos e devolvem `CONFLICT` para a tela.
  2. **Gravação só pelo servidor:** `apply_world_changes` só roda com a chave de serviço, depois de o servidor conferir sessão, permissão do método (`world/registry.ts`) e as regras do serviço (inclusive o escopo do professor, com o ator da sessão). O usuário não chama a função direto. Cada linha continua presa ao espaço da sessão.
  3. **Leitura do servidor com a chave de serviço**, sempre filtrada pelo espaço da sessão. Com isso o RLS de leitura passou a seguir as permissões do app para o acesso direto do navegador: alunos, cobranças, pagamentos online e pacotes do aluno só para dono, gerente e recepção; auditoria só para dono e gerente; usuários, cada um vê só a si (dono e gerente veem todos). As políticas que citavam perfis inexistentes (`teacher`, `receptionist`) usam os reais.
  4. **Sem cair no administrativo:** `getClientForTenant` recusa sem sessão (antes caía no cliente administrativo, que ignora o RLS). O cron usa o administrativo de forma explícita.
- Testes: `world/__tests__/rules.db.test.ts` (duas matrículas na última vaga ao mesmo tempo, duas turmas do professor no mesmo horário ao mesmo tempo, chamada só nas próprias aulas, avulsa pela recepção, acesso direto por perfil e gravação sem sessão) e `world.db.test.ts` (função de gravação recusada para o usuário, conflito por linha e por versão).
- **Pronto quando:** duas abas fazendo a mesma operação ao mesmo tempo não furam nenhuma das regras acima.

### Fatia 4 — Demonstração no banco

- [x] Seed que cria o espaço de demonstração completo (21/10/2026): `pnpm demo:local` (também o passo 5 do `pnpm setup:local`) apaga e recria a Academia X no banco, com um usuário por perfil (dono, gerente, recepção e professor), modalidades, equipe, planos, turmas (uma é curso), 25 alunos (bolsista, desconto, lista de espera), três semanas de chamada, mensalidades geradas e a maioria paga, pacote vendido, aluguel recorrente, regras de repasse e modelos de mensagem. O cenário (`apps/web/scripts/demo/demoScenario.ts`) roda os próprios serviços dentro do espaço carregado do banco (`runInWorld`), então os dados seguem as regras da conta real; datas relativas a hoje e sorteios com semente fixa. Constantes em `src/lib/demo.ts`.
- [x] Login da demonstração por usuário do seed (21/10/2026): "Entrar na demonstração" na tela de login entra como o dono (Supabase Auth, senha em `DEMO_PASSWORD`, só onde a variável existe); na barra do topo, "Ver a demonstração como" troca de perfil entrando como o usuário dele. O seletor de usuários do mock saiu do login e do topo.
- [x] O modelo de turmas saiu do mock (21/10/2026). O espaço que os serviços usam (`store`, o ator, `readOp`/`writeOp`, `newId`, erros, busca de texto) mora em `services/world/` (`store.ts`, `actor.ts`, `ops.ts`, `types.ts`), e os padrões de produto (categorias financeiras de sistema, modelos de mensagem, WhatsApp assistido) em `services/defaults.ts`. Nenhum serviço do modelo de turmas importa `@/mocks`. A academia saiu do seed do mock (`SEED_VERSION` 39); os testes de regra montam a academia em `src/test/academy.ts`.
- **O que ainda mora em `@/mocks` e por quê (decisão pendente, 21/10/2026):** o **modelo de agendamento** (barbearia: agenda, serviços, bloqueios, recorrência) não tem tabelas no banco e segue no mock, com a demonstração Corte Nobre; está fora do foco (memória "Focus: classes model only") e não aparece mais no login. Também ficam: o mundo local que os **testes de regra** usam (registrado como fallback do `store` fora do servidor), o cache da **sessão do navegador** (organização, unidade e usuário hidratados no login, `features/auth`), **usuários e configurações** (já gravam no banco para a conta real) e os arquivos da demonstração no IndexedDB (`file-blobs`). Para apagar `@/mocks` de vez falta decidir o modelo de agendamento: **(a)** tirar do produto ou **(b)** dar tabelas a ele e levá-lo pelo mesmo caminho (`services/world`). **Adiado pelo usuário em 21/10/2026:** a barbearia fica no mock por enquanto. Os `simulateRead`/`simulateWrite` ficaram só como apelidos para os serviços do agendamento.
- **Pronto quando:** não existe mais `@/mocks` no código do modelo de turmas e o espaço de demonstração é recriado por um comando. O resto de `@/mocks` depende da decisão acima.

### Fatia 5 — Testes

- [x] Regras puras seguem em `packages/core/test` (node --test).
- [x] Testes de regra dos serviços (`apps/web/src/services/__tests__`) seguem no espaço em memória (`src/test/academy.ts`), rápidos e sem banco. **Decisão (21/10/2026):** em vez de rodar cada um contra o Supabase, o `pnpm test:roundtrip` passa todos eles pelas colunas do banco (cada gravação vira linha e volta, e um valor nulo em coluna `NOT NULL` falha o teste). Foi assim que apareceu o anexo nulo que derrubava o desfazer pagamento.
- [x] Testes no banco local (`pnpm test:db`, arquivos `*.db.test.ts`): gravação, conflitos, regras na mesma transação, RLS por perfil e as guardas das actions (`users.db.test.ts`).
- [x] O e2e (Playwright, projeto `desktop` e `mobile`) roda contra o Supabase local (22/10/2026: desktop 361 de 363, 1 pulado e 1 com pendência conhecida abaixo; mobile 28 de 28): cada spec cria o espaço dela no banco (`e2e/db.ts`) e entra com usuário real; o relógio do servidor segue `E2E_NOW` (`src/instrumentation.ts`). Specs ajustadas ao que o banco devolve.
- **Bugs reais que o e2e no banco achou (21 e 22/10/2026), todos com teste no banco:**
  1. Desfazer pagamento gravava `null` na coluna obrigatória de anexos e a gravação inteira falhava.
  2. Mudança dentro de lista ou objeto (jsonb), como apagar uma chave das configurações, não era gravada: o objeto do serviço e a cópia de comparação dividiam os objetos aninhados (a carga agora copia fundo).
  3. Renovar pacote falhava (chave estrangeira entre o antigo e o novo) e, na primeira correção, trocar de plano passou a bater no índice único da mensalidade. Ordem final da gravação por tabela: alteradas, novas e, por último, alteradas que apontam para uma linha nova.
  4. Lançamento pago e desfeito voltava a ter Excluir: a auditoria não era carregada. A auditoria dos lançamentos agora é carregada (`partialLoad`).
  5. Formulários em painel lateral (Sheet) tinham perdido o "Descartar alterações?", e o Cancelar do rodapé pulava a confirmação.
- **Ambiente do e2e:** o servidor do e2e roda sem `ASAAS_API_KEY` nem `MAILERSEND_API_KEY` (nunca chama o Asaas nem manda convite de verdade) e, com `E2E_NOW`, aceita o Pix simulado na conta real. O teste do Pix Automático fica pulado até ele ter tabelas.
- **Segurança achada no caminho (21/10/2026):** actions `"use server"` que usavam a chave de serviço sem sessão (usuários, assinatura, conta de recebimento, saldo, transferências, Pix/link, simulação de pagamento) passaram a conferir sessão, espaço e permissão (`requireSameOrganization`); o que só o webhook e a rota de anexos chamam saiu do arquivo de actions (`onlinePaymentsWebhook.ts`, `attachmentsStorage.ts`). Usuário inativo no banco perde a sessão.
- **Pendência conhecida (22/10/2026):** em `dinheiro-avulsas.spec.ts` ("Nova cobrança em 12x"), a tela põe o mês da 1ª parcela na URL e logo depois outra troca devolve a URL anterior. Suspeita: resposta de uma action do servidor ainda em andamento (a lista recarregando) reaplica a URL de quando começou. Afeta qualquer filtro trocado enquanto uma leitura está no ar; investigar o `router.replace` de `billing-view.tsx` frente às actions.
- **Pronto quando:** `pnpm test`, `pnpm test:roundtrip`, `pnpm test:db` e `pnpm e2e` passam sem o mock.

## Alternativas

- **(a) Manter o mock só para a demonstração.** Rejeitada em 21/10/2026: o código manteria dois caminhos para sempre, e a demonstração não mostraria o produto real.
- **Reescrever as telas para ler tabela a tabela no navegador (supabase-js direto).** Rejeitada: espalharia a montagem dos read-models pelas telas e perderia as funções puras já testadas.
- **Migrar tudo de uma vez.** Rejeitada: sem fatias, nada fica verificável no meio do caminho.
