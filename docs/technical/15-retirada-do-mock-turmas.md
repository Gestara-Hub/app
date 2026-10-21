# 15 — Retirada do mock no modelo de turmas

> **Status:** Decidido e planejado em 21/10/2026. Execução por fatias, na ordem abaixo. Cada fatia fecha com typecheck, lint e testes verdes e um commit próprio.
> **Contexto relacionado:** [06 — Passagem para o backend](06-passagem-backend.md), [08 — Backend no Supabase](08-backend-supabase.md), [12 — Modularização da camada de serviços](12-modularizacao-da-camada-de-servicos.md).

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

- [x] **Mensalidades automáticas no servidor** (21/10/2026). O planejamento virou função pura em `packages/core/src/membership-generation.ts` (a mesma regra para a demonstração e para a conta real). Na conta real, `ensureMembershipCharges` chama `generateMembershipChargesAction` (`services/membershipBackend.ts`), que lê do banco, planeja e grava por `insert_membership_charges`; o índice único `uq_charges_membership_period` (aluno + período, mensalidade não cancelada) impede duplicata entre aparelhos, e as duplicadas que existiam foram canceladas pelo sistema (migração 25). O navegador não gera mais mensalidade na conta real, e as que só existiam no `localStorage` saem na sincronização. Pontos que garantem a geração: Cobranças (lista e "Gerar cobranças"), Financeiro, Relatórios e resumo do aluno.
- [x] **Supabase Cron diário** (21/10/2026). A migração 26 liga `pg_cron` e `pg_net` e agenda `membership-charges-daily` (06:00 de Brasília), que chamava `POST /api/cron/membership-charges` (desde a migração 27, `/api/cron/daily`) com `Authorization: Bearer CRON_SECRET`; a rota roda `generateMembershipChargesAction` em todo espaço de turmas ativo (um espaço com erro não para os outros). URL do app e segredo ficam no Vault de cada ambiente (`app_url`, `cron_secret`); localmente, `pnpm cron:local` prepara os dois e o `CRON_SECRET` do `.env.local`, e precisa rodar de novo depois de `supabase db reset`. Testado no local: o banco chamou a rota e a geração respondeu 200. **Produção:** criar os dois segredos no Vault do projeto e o `CRON_SECRET` na Vercel.
- [x] **Recorrências do Financeiro** (21/10/2026). Já gravavam no banco, mas eram geradas no navegador de quem abria o Financeiro, sem proteção contra duplicata entre aparelhos. Agora `materializeRecurrencesAction` (`services/financeBackend.ts`) aplica a regra pura `materializeRecurrence` sobre o banco e grava por `insert_recurrence_entries`; o índice único `uq_financial_entries_recurrence_competence` impede dois lançamentos ativos da mesma recorrência no mês, e as duplicadas existentes foram canceladas (migração 27). O cron diário passou a chamar `POST /api/cron/daily`, que roda mensalidades e recorrências em cada espaço.
- [x] **Expiração local dos códigos online** (21/10/2026). `expireStale` (`onlinePaymentsService`) só roda na demonstração; na conta real quem expira e exclui no Asaas é o servidor (`expireDueOnlinePayments`), e o navegador só lê o status do banco.
- [x] **Modelo do certificado** (21/10/2026). Coluna `organizations.certificate_template` (jsonb, null = padrão, migração 28), lida e gravada por `services/certificatesBackend.ts`; a tela do modelo e o certificado da matrícula leem do banco antes de montar. A logo já ia para o bucket privado `attachments` pela rota `/api/attachments`; o modelo guarda só o id.
- [x] **Cargos da equipe** (21/10/2026). `rolesService` lê e grava a tabela `roles` (`services/rolesBackend.ts`); a Equipe sincroniza os cargos antes de listar e de validar o cargo escolhido. O índice `uq_roles_organization_name` (migração 28) deixa o nome único por espaço, sem acento nem caixa, como a validação da tela. Cargo criado antes só no navegador sobe uma vez para o banco.
- **Pronto quando:** numa conta real, limpar o `localStorage` e abrir em outro navegador mostra exatamente os mesmos dados, inclusive as mensalidades do mês e o modelo do certificado.

### Fatia 2 — Leitura direto do banco, por domínio

Para cada domínio: os read-models passam a ser montados por server actions a partir do banco (reusando as funções puras), os hooks do TanStack Query chamam essas actions, e o `sync*FromDb` e a escrita no store daquele domínio são apagados.

**Junto com a modularização do [doc 12](12-modularizacao-da-camada-de-servicos.md)** (decidido em 21/10/2026): nos domínios com serviço grande, o primeiro passo é dividir o serviço em pasta por subdomínio (`*Views.ts`, `*Validation.ts`, sub-serviços e `index.ts` com o nome antigo), só movendo código, num commit próprio com testes verdes. A troca da fonte para o banco vem no commit seguinte; nunca os dois juntos, para saber de onde veio uma quebra. Os `*Views.ts` são o que passa a rodar no servidor, e os `*Validation.ts` são a base da fatia 3.

**Como cada domínio passa para o banco** (definido em 21/10/2026, no 2.1):

1. **Actions por domínio** (`services/<domínio>/*Actions.ts`, `"use server"`): o espaço, o usuário e o perfil saem de `requireTenant()` (`services/server/tenant.ts`), que lê o usuário autenticado no Supabase e usa o cliente da sessão, com RLS. A action nunca recebe `organizationId` do navegador e nunca cai no cliente administrativo; sem sessão, devolve 401. Escrita confere a permissão com `ctx.require(...)`, além do RLS.
2. **Erro como valor:** a action devolve `ActionResult` (`services/server/action.ts`). Erro lançado numa action perde a mensagem em produção, então o `ApiError` volta como valor e o serviço do navegador relança com `unwrap`. Os construtores de erro ficam em `@gestarahub/core/api-error`.
3. **Regras sem store:** validação e cálculo saem para módulos puros (`*Rules.ts`, `*Validation.ts`) que recebem os dados como parâmetro. A demonstração passa o `store`; a action passa o que leu do banco.
4. **Serviço do navegador:** na conta real chama a action e não grava no store; na demonstração segue no store até a fatia 4.
5. **Cópia de transição:** domínios ainda não migrados montam telas no navegador a partir do store. Até migrarem, o serviço migrado guarda no store uma cópia do que leu ou gravou (`cache*`), marcada no código, e as sincronizações antigas recarregam do banco o que precisam. A cópia sai na fatia 4.
6. **Testes no banco:** `pnpm --filter @gestarahub/web test:db` roda os `*.db.test.ts` contra o Supabase local, com um espaço e usuários criados por teste e as actions chamadas como numa requisição (`src/test/db.ts`). É a base da fatia 5.

Ordem, de quem depende de menos para quem depende de mais:

- [x] 2.1 Catálogo: modalidades, equipe, cargos, planos, catálogo de pacotes (21/10/2026). Actions em `services/catalog/` (`categoriesActions`, `teamActions`) e `services/billing/catalogActions`; regras em `categoryRules`, `teamRules`, `planRules` e `billingValidation` (sem store). Modalidade com nome único sem acento nem caixa no banco (migração 29, `name_key`, a mesma dos cargos). Trocar a trilha da modalidade grava no banco a volta dos alunos ao primeiro nível, e revisar a modalidade marca `modalitiesReviewed` no espaço, que antes ficavam só no navegador. Cargos criados só no navegador antes da migração 28 não sobem mais para o banco. Testes: `catalog/__tests__` e `billing/__tests__` (`*.db.test.ts`).
- [ ] 2.2 Alunos e responsáveis (ficha, lista, inativação). Divisão feita (`services/clients/`, 21/10/2026, fase 2 do doc 12).
- [ ] 2.3 Turmas, matrículas, chamada, avulsas e experimentais, lista de espera, substituições, calendário. Divisão feita (`services/classes/`, 21/10/2026, fase 1 do doc 12).
- [ ] 2.4 Cobranças e recebimentos online. Divisão feita (`services/billing/`, 21/10/2026, fase 4 do doc 12).
- [ ] 2.5 Pacotes do aluno (venda, uso, renovação). Divisão feita (`services/billing/`, 21/10/2026).
- [ ] 2.6 Notas, evolução e certificado.
- [ ] 2.7 Financeiro e repasse de professores. Divisão feita (`services/finance/`, 21/10/2026, fase 3 do doc 12).
- [ ] 2.8 Comunicação (modelos, histórico, WhatsApp).
- [ ] 2.9 Agregados: Painel, relatórios e resumo do aluno, com consultas agregadas no banco onde o volume pedir.
- **Pronto quando, por domínio:** a tela funciona com o `localStorage` vazio e sem o `sync*FromDb` daquele domínio; os testes do domínio passam (fatia 5).

### Fatia 3 — Regras no servidor

- [ ] Conflito de horário do professor e horário de funcionamento ao criar e editar turma.
- [ ] Capacidade da turma e da aula (matrícula, avulsa, promoção da lista de espera) na mesma transação da gravação.
- [ ] Geração de parcelas de curso e de pacote numa transação com a matrícula ou a venda.
- [ ] Permissões e escopo do professor (`teacherScope`) conferidos no servidor e no RLS, não só no serviço do navegador.
- **Pronto quando:** duas abas fazendo a mesma operação ao mesmo tempo não furam nenhuma das regras acima.

### Fatia 4 — Demonstração no banco

- [ ] Seed (`apps/supabase/seed.sql` ou script) que cria o espaço de demonstração completo: organização, unidade, usuários por perfil, modalidades, turmas, alunos, matrículas, chamadas, cobranças e pacotes, com datas relativas a hoje.
- [ ] Login da demonstração por usuário do seed (hoje é o seletor do mock em `(auth)/actions.ts`).
- [ ] Apagar `mocks/store`, `mocks/seed`, `simulateRead`/`simulateWrite`, o `SEED_VERSION` e os `isSupabaseOrganization` dos serviços. É a fase 5 do doc 12: sai também o alias `turmasService`, e as telas passam a importar os serviços em inglês.
- **Pronto quando:** não existe mais `@/mocks` no código e o espaço de demonstração é recriado por um comando.

### Fatia 5 — Testes

- [ ] Regras puras seguem em `packages/core/test` (node --test).
- [ ] Os testes de serviço (`apps/web/src/services/__tests__`, hoje contra o mock) passam a rodar contra o Supabase local, com banco zerado por suíte; a migração acompanha cada domínio da fatia 2, não fica para o fim.
- [ ] O e2e (Playwright) roda no fim, contra o espaço de demonstração do seed.
- **Pronto quando:** `pnpm test` e `pnpm e2e` passam sem o mock.

## Alternativas

- **(a) Manter o mock só para a demonstração.** Rejeitada em 21/10/2026: o código manteria dois caminhos para sempre, e a demonstração não mostraria o produto real.
- **Reescrever as telas para ler tabela a tabela no navegador (supabase-js direto).** Rejeitada: espalharia a montagem dos read-models pelas telas e perderia as funções puras já testadas.
- **Migrar tudo de uma vez.** Rejeitada: sem fatias, nada fica verificável no meio do caminho.
