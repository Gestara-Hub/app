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
| `onlinePaymentsService.expireStale` | expiração local dos códigos online | resolvido no servidor em 21/10/2026 (`expireDueOnlinePayments`); falta tirar o local |
| `certificatesService` | modelo e logo do certificado | some ao limpar o navegador |
| `rolesService` | cargos da equipe | a tabela `roles` existe, o serviço não usa |
| validações do serviço | conflito de horário do professor, capacidade, parcelas | duas abas abertas furam a regra |

## Escopo

Modelo de turmas: modalidades, equipe e cargos, planos, catálogo de pacotes, alunos e responsáveis, turmas, matrículas, chamada, avulsas e experimentais, lista de espera, substituições, cobranças, recebimentos online, pacotes do aluno, notas e evolução, certificado, financeiro, repasse de professores, comunicação, configurações do espaço, auditoria, Painel, relatórios e resumo do aluno.

**Fora:** Pix Automático real (adiado, depende de CNPJ com 6 meses e da regra do split), agenda e serviços do modelo de barbearia (fora do foco), assinatura do GestaraHub (já no Asaas).

## Fatias

### Fatia 1 — Fechar o que hoje se perde (prioridade)

- [x] **Mensalidades automáticas no servidor** (21/10/2026). O planejamento virou função pura em `packages/core/src/membership-generation.ts` (a mesma regra para a demonstração e para a conta real). Na conta real, `ensureMembershipCharges` chama `generateMembershipChargesAction` (`services/membershipBackend.ts`), que lê do banco, planeja e grava por `insert_membership_charges`; o índice único `uq_charges_membership_period` (aluno + período, mensalidade não cancelada) impede duplicata entre aparelhos, e as duplicadas que existiam foram canceladas pelo sistema (migração 25). O navegador não gera mais mensalidade na conta real, e as que só existiam no `localStorage` saem na sincronização. Pontos que garantem a geração: Cobranças (lista e "Gerar cobranças"), Financeiro, Relatórios e resumo do aluno.
- [x] **Supabase Cron diário** (21/10/2026). A migração 26 liga `pg_cron` e `pg_net` e agenda `membership-charges-daily` (06:00 de Brasília), que chama `POST /api/cron/membership-charges` com `Authorization: Bearer CRON_SECRET`; a rota roda `generateMembershipChargesAction` em todo espaço de turmas ativo (um espaço com erro não para os outros). URL do app e segredo ficam no Vault de cada ambiente (`app_url`, `cron_secret`); localmente, `pnpm cron:local` prepara os dois e o `CRON_SECRET` do `.env.local`, e precisa rodar de novo depois de `supabase db reset`. Testado no local: o banco chamou a rota e a geração respondeu 200. **Produção:** criar os dois segredos no Vault do projeto e o `CRON_SECRET` na Vercel.
- [ ] **Recorrências do Financeiro** com o mesmo tratamento (materialização no servidor, idempotente).
- [ ] **Tirar a expiração local** dos códigos online (`expireStale`): o servidor já expira e exclui no Asaas.
- [ ] **Modelo do certificado:** coluna `certificate_template` (jsonb) na organização e logo no Storage privado.
- [ ] **Cargos da equipe:** `rolesService` passa a usar a tabela `roles`.
- **Pronto quando:** numa conta real, limpar o `localStorage` e abrir em outro navegador mostra exatamente os mesmos dados, inclusive as mensalidades do mês e o modelo do certificado.

### Fatia 2 — Leitura direto do banco, por domínio

Para cada domínio: os read-models passam a ser montados por server actions a partir do banco (reusando as funções puras), os hooks do TanStack Query chamam essas actions, e o `sync*FromDb` e a escrita no store daquele domínio são apagados. Ordem, de quem depende de menos para quem depende de mais:

- [ ] 2.1 Catálogo: modalidades, equipe, cargos, planos, catálogo de pacotes.
- [ ] 2.2 Alunos e responsáveis (ficha, lista, inativação).
- [ ] 2.3 Turmas, matrículas, chamada, avulsas e experimentais, lista de espera, substituições, calendário.
- [ ] 2.4 Cobranças e recebimentos online.
- [ ] 2.5 Pacotes do aluno (venda, uso, renovação).
- [ ] 2.6 Notas, evolução e certificado.
- [ ] 2.7 Financeiro e repasse de professores.
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
- [ ] Apagar `mocks/store`, `mocks/seed`, `simulateRead`/`simulateWrite`, o `SEED_VERSION` e os `isSupabaseOrganization` dos serviços.
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
