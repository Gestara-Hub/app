# 06 — Passagem para o backend

Data: 2026-10-14.

> **Status:** 13/10/2026. Ponto de partida da fase 3 (backend). Lista o que o mock faz "por baixo dos panos" e que o servidor precisa assumir, as decisões que faltam e a ordem sugerida de construção.
> Documentos irmãos: integração real do WhatsApp em [07-integracao-whatsapp.md](07-integracao-whatsapp.md) e levantamento de pagamentos em [../product/19-levantamento-pagamentos.md](../product/19-levantamento-pagamentos.md).

## 1. Direção

- **Código:** banco no monorepo (pasta `apps/supabase/`), reaproveitando `packages/contracts` (formato da API) e `packages/core` (regras puras: motor de cobrança, financeiro, agenda, datas). Portais de aluno e professor unificados no mesmo monólito Next.js distribuídos via PWA ([10-monolito-frontend-pwa.md](10-monolito-frontend-pwa.md)).
- **Tabela original (13/10/2026), já resolvida pelo 08:**

| Decisão | Sugestão | Por quê |
|---|---|---|
| Framework HTTP | Hono | Leve, roda em função serverless e em servidor comum (troca de hospedagem continua possível). NestJS pesa na partida a frio. |
| Banco | Postgres gerenciado com intermediário de conexões (Neon ou Supabase) | Relacional (cobrança, matrícula, presença) e funções serverless abrem muitas conexões curtas. |
| Login | A decidir (provedor pronto ou próprio) | Hoje é um cookie simulado (`gestarahub_session`). |
| Arquivos | Armazenamento privado com link temporário | Comprovantes têm dados pessoais (LGPD). |
| Tarefas agendadas | Vercel Cron chamando rotas protegidas | Substitui o que o mock faz ao abrir a tela (seção 2.1). |

- **Em aberto (produto):** app do aluno no celular (reforça uma API separada do Next) e orçamento mensal.

## 2. O que o mock faz e o servidor precisa assumir

### 2.1 Tarefas que hoje rodam ao abrir a tela → tarefas agendadas

Todas já são **idempotentes** no mock (rodar duas vezes não duplica). O servidor mantém essa garantia.

Agendador: **Supabase Cron**, chamando uma Edge Function por tarefa, um espaço por vez.

| Hoje (mock, na leitura) | Onde | Vira |
|---|---|---|
| Gera as mensalidades do mês e dos meses alcançados | `autoGenerateMembershipCharges` em `billingService` | Tarefa diária; trava por aluno e período (`membershipPeriodTaken`) |
| Materializa lançamentos que se repetem todo mês | `ensureMaterialized` / `materializeAll` em `financeService` | Tarefa diária |
| Baixa automática do Pix Automático simulado | `applyRecurringAutoPayments` em `onlinePaymentsService` | Vem do aviso (webhook) do provedor de pagamento, não de tarefa |
| Expira cobranças online vencidas | `expireStale` em `onlinePaymentsService` | Tarefa ou cálculo na leitura |
| Parabéns automático (WhatsApp oficial) | `runBirthdayGreetings` em `communicationService` | Tarefa diária no horário da regra |
| Lembrete de cobrança avulsa, parcela de curso e pacote (`charge_reminder`) e "Pacote acabando" (`package_ending`) | só envio assistido no mock | Tarefas diárias no horário de cada modelo, com a franquia |
| Lembretes automáticos de cobrança (WhatsApp oficial) | **não existe no mock** | Tarefa nova, respeitando `allowedSendHours` e a franquia |

Status **derivados** continuam calculados na leitura, sem tarefa: mensalidade "atrasada" (`effectiveStatus`), lançamento atrasado, aula "concluída", turma "Encerrada" e matrícula "Concluída" (curso com fim no passado), pacote vencido, usado até o fim, "última aula" e "vence em N dias".

### 2.2 O que o servidor carimba (nunca vem da tela)

- **Espaço e unidade** (`organizationId`, `unitId`): vêm da sessão. Os tipos `Create*` já excluem esses campos (`TenantScopeFields`). Ver [03-multi-tenant-e-escopo.md](03-multi-tenant-e-escopo.md).
- **Autor** das ações: o mock usa o "ator ambiente" (`getCurrentActor`) na auditoria e no autor dos registros de aula. No servidor, vem do token.
- `id`, `createdAt`, `updatedAt`.

### 2.3 Arquivos

- Comprovantes dos lançamentos: hoje `attachmentsService` guarda o conteúdo no IndexedDB do navegador (`mocks/file-blobs.ts`) e o registro só os metadados (`FileAttachment`).
- No servidor: **Supabase Storage** (bucket privado), link temporário para abrir, metadados ligados ao lançamento, acesso só com `finance:view` e prazo de retenção (LGPD). Imagem comprimida no app antes do envio (web e celular), porque as Edge Functions não têm bibliotecas nativas de imagem.

### 2.4 Consultas que juntam dados (boas candidatas a SQL)

- Faltas seguidas para o "Para fazer hoje": `turmasService.listAbsenceStreaks` (soma as turmas do aluno; presença ou justificada encerram).
- Sugestões aprendidas de pontos fortes e metas: `clientsService.getProgressionTermSuggestions` (por espaço e modalidade).
- Resumo da evolução: `clientsService.getProgressionOverview` (presenças por nível).
- Resumo do aluno (ficha do aluno e apps): `studentSummaryService.getStudentSummary` (`StudentSummary`): cadastro, mensalidade com bolsa, matrículas de todas as situações com parcelas do curso, saldo em aberto de todos os tipos, frequência de 30 dias, nível por modalidade, pacotes em uso e últimas mensagens. Um endpoint só, com o RLS do aluno e do professor.
- Financeiro: resumo, série de 6 meses, por categoria, próximos vencimentos (`financeService`).
- Comunicação: números do mês e "Recebido depois de lembrete" (`communicationService.getMetrics`).

### 2.5 Regras e mensagens

- **Notas:** o professor só lança nas turmas em que é o instrutor titular; o mock já aplica no `gradesService` (erro `FORBIDDEN`, 403) e o servidor repete a regra pelo usuário do token.
- As validações e mensagens em português estão nos services do mock e já seguem o formato de erro da API (`ApiError` com `code`, `message`, `fields`, `httpStatus`). O backend repete as mesmas regras e mensagens para a tela não mudar.
- **Testes como especificação (atualizado em 14/10/2026, depois das fases A a D):** `packages/core/test` (171 testes, regras puras: cobrança, parcelas, cursos, pacotes, repasse, certificado), `apps/web/src/services/__tests__` (715 testes no app, a maior parte nos services: mensalidades, bolsas, cobrança avulsa, cursos, pacotes, financeiro, professores, pagamento online, evolução, faltas, comunicação, configurações, relatórios) e `apps/web/e2e` (fluxos de tela; os das fases A a D ainda aguardam a rodada no navegador). Cada fatia do backend deve passar nos testes de service da sua área antes de trocar o mock pela API.

### 2.6 O que NÃO vai para o servidor

- Migrações do mock (`SEED_VERSION` 20 a 31 em `mocks/store.ts`): o banco nasce no formato atual dos contratos.
- Dados e botões de demonstração: "Simular pagamento", "Simular autorização", conexão oficial do WhatsApp simulada, troca de plano livre em Configurações.
- `localStorage` como banco e o mundo multi-tenant em memória.

## 3. Ordem sugerida (fatias completas)

1. **Login, espaço e usuários:** sessão real, RBAC por capacidades (`requirePermission`, `can`), escopo por profissional.
2. **Alunos:** cadastro, responsáveis, inativação.
3. **Modalidades, turmas, matrículas, chamada e lista de espera.**
4. **Cobrança:** motor em `packages/core/billing`, mensalidades, bolsas, tarefa de geração, e as formas novas do [doc 20](../product/20-plano-novas-formas-de-cobranca.md): cobrança avulsa com parcelas, curso fechado (forma de cobrança da turma, parcelas na matrícula, cancelamento no meio) e pacote de aulas (catálogo, venda, renovação com saldo, **gasto da aula na mesma transação da chamada**). Certificado de conclusão (Pro) junto com cursos.
5. **Evolução:** graduação, registros de aula, metas.
6. **Financeiro:** lançamentos, anexos, pagamento de professores ("% do que os alunos pagaram": mensalidades, parcelas de curso pagas e aulas de pacote usadas, com `carriedFrom` para o valor das aulas herdadas), relatórios de cursos e de pacotes.
7. **Comunicação:** envio assistido (só registro) e depois WhatsApp oficial ([07](07-integracao-whatsapp.md)).
8. **Pagamentos reais:** plano da plataforma e cobrança online dos alunos ([doc 19](../product/19-levantamento-pagamentos.md)).

Cada fatia troca a implementação dos services correspondentes (de store em memória para chamadas à API), mantendo assinaturas e tipos.

> **21/10/2026:** as fatias 1 a 7 acima já gravam no Supabase, mas ainda com o store do navegador como cache. A retirada do mock no modelo de turmas segue o plano do [doc 15](15-retirada-do-mock-turmas.md).
