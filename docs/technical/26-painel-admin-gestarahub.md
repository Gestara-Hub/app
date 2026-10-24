# 26 — Painel administrativo do GestaraHub (`apps/admin`)

Data: 2026-10-24. Status: Feito (fases 0 a 8; 1C WhatsApp e itens da seção 17 ficam para depois).
Código: `apps/admin`, `packages/contracts`, `packages/core`, `apps/supabase/migrations/…050 a …057`. Em `apps/web`: "Fale com a gente", comunicados, cortesia no plano, recusa de administrador e de espaço inativo.
Testes: `apps/admin/src/**` (guia: [guides/21](../guides/21-painel-admin-local.md)). Regra do projeto: e2e só quando o dono pedir.

> Para quem é: o dono do GestaraHub (responsável único pela plataforma) e, depois, a equipe interna. Não é uma tela dos clientes. Domínio, hospedagem e variáveis são decisões e tarefas do dono; a seção 12 lista o que fazer.

## 1. Decisão proposta

Criar um segundo app no mesmo monorepo, `apps/admin`, com login e domínio próprios, para o GestaraHub **gerenciar os espaços (tenants), atender o suporte, acompanhar a saúde do sistema, conceder e ajustar planos e falar com os clientes**. Ele reaproveita `@gestarahub/contracts`, `@gestarahub/core`, o mesmo banco Supabase e as mesmas migrações.

Por que app separado e não rotas `/admin` no `apps/web`:

- O painel usa a chave de serviço do Supabase (`SUPABASE_SERVICE_ROLE_KEY`), que passa por cima da separação entre espaços. Essa chave não deve existir no deploy que os clientes acessam.
- Um erro de rota ou de permissão no app dos clientes não pode expor o painel.
- Login próprio, com verificação em duas etapas obrigatória, sem "espaço" e sem a sessão de tenant do `proxy.ts`.
- Deploys independentes: mexer no painel não derruba o app dos clientes.

Rejeitado: repositório novo (duplicaria contratos e regras) e rotas `/admin` no `apps/web` (só serviria como versão descartável da caixa de suporte).

## 2. Princípios

1. **Menor poder possível.** Por padrão o painel mostra números, estados e erros mascarados. Dados pessoais de alunos (nome, CPF, telefone) ficam fechados.
2. **Abrir dado de um espaço exige motivo.** "Entrar como suporte" (seção 6.3) pede um motivo, vale por tempo curto e fica na auditoria da plataforma.
3. **Toda ação grava quem, quando, em qual espaço e por quê.** A auditoria da plataforma é separada da auditoria dos espaços (`audit_logs`) e ninguém a edita.
4. **Plano pago continua sendo gravado só pelo servidor** (regra do `SERVER_WRITTEN`, achado 66). O admin concede plano por uma ação de servidor própria, com motivo.
5. **Sem jargão e sem número inventado**, como no resto do produto. Texto em português, código em inglês.
6. **Começar pequeno.** Cada fase entrega algo que já serve sozinho (seção 10).

## 3. Quem usa

Hoje só o dono usa. Mas o painel nasce com **cadastro de administradores**: outras pessoas podem ser convidadas, com um papel, e **só entram neste sistema, nunca no app dos clientes (`apps/web`)**.

| Papel | O que pode | Observação |
| --- | --- | --- |
| `platform_owner` | Tudo: espaços, planos, concessões, suporte, comunicados, equipe, LGPD | Você |
| `platform_support` | Atender o suporte, ler espaços, comunicados | Atendimento |
| `platform_finance` | Ler assinaturas e receita; conceder cortesia e carência | Financeiro |
| `platform_viewer` | Só leitura de números e saúde | Sócios, dev |

**Isolamento nos dois sentidos** (a pessoa do painel nunca vira usuário de um espaço, e o usuário de um espaço nunca entra no painel):

- O painel só aceita login de quem tem linha em `platform.admins` (e com 2FA ativo). Quem só existe em `public.users` é recusado.
- O `apps/web` só abre sessão para quem tem linha em `public.users` com espaço. Quem só existe em `platform.admins` é recusado, mesmo com senha certa. Teste automatizado nos dois lados (seção 11).
- O convite do painel cria o usuário de autenticação com um marcador (`app_metadata.platform = true`) que o `apps/web` rejeita antes de qualquer consulta.

## 4. Arquitetura

```
apps/
  web/       app dos clientes (já existe)
  admin/     painel do GestaraHub (novo)
  supabase/  migrações
packages/
  contracts/ tipos (novos tipos de suporte, comunicados e papéis de plataforma)
  core/      regras puras (planos, datas, fuso, formatação)
```

- **Stack:** a mesma do `apps/web` (Next.js App Router, React 19, TypeScript, Tailwind, shadcn/ui, TanStack Query, Zod), para o time não aprender duas coisas. Tabelas simples e densas, sem o refino visual do app dos clientes.
- **Acesso a dados (decisão do dono: mesmo projeto Supabase, schema próprio):**
  - As tabelas do painel moram no schema `platform` (não em `public`). O schema `platform` **não é exposto** na API do Supabase (fora de `api.schemas`), então nem o navegador nem o `apps/web` conseguem consultá-lo.
  - O `apps/admin` acessa o banco **só pelo servidor**, com uma conexão direta de Postgres usando um papel próprio (`platform_app`), e não com a chave `service_role`. Esse papel tem `ALL` no schema `platform`, `SELECT` nas tabelas de `public` que o painel consome (organizations, users, subscription_events, error_logs, job_runs, webhook_events, audit_logs, online_payments, legal_consents) e **nenhum** `INSERT/UPDATE/DELETE` direto em `public`.
  - Escritas em `public` (plano concedido, inativar espaço, reabrir) passam por funções `SECURITY DEFINER` em `platform` (por exemplo `platform.apply_plan_grant`), uma por ação, que validam, gravam e deixam a auditoria. Isso mantém a regra de que o plano pago só é gravado pelo servidor.
  - O papel de aplicação do `apps/web` (`authenticated`, `anon`) não tem `USAGE` em `platform`. RLS ligada em todas as tabelas do schema, sem policy para eles.
- **Login:** Supabase Auth do mesmo projeto, com a tabela `platform.admins` ligada a `auth.users` e o marcador de plataforma (seção 3); e-mail e senha mais TOTP obrigatório, reaproveitando a lógica de `technical/17`. Sessão curta (8 h), sem "lembrar dispositivo".
- **Divisão de código:** `apps/admin/src/features/<área>` (spaces, support, health, plans, announcements, team), `services/` para os dados e `lib/` para a sessão. Mesmas fronteiras de importação do `apps/web` (eslint).
- **Variáveis de ambiente:** a conexão do admin usa `PLATFORM_DATABASE_URL` (papel `platform_app`); o painel não precisa da `SUPABASE_SERVICE_ROLE_KEY`, e nenhuma variável do admin vai para o `apps/web`. Para convidar admins e redefinir 2FA, uma chave de serviço só do Auth, restrita a esse uso, fica em um módulo isolado.
- **Domínio:** `admin.gestarahub.com.br` (a registrar no DNS pelo dono), com opção de limitar por IP ou VPN depois.

## 5. Modelo de dados (migrações novas, em `apps/supabase/migrations`)

Rascunho para validar antes de criar as migrações.

| Tabela | Para quê | Campos principais |
| --- | --- | --- |
| `platform.admins` | Quem entra no painel | `id`, `auth_user_id`, `name`, `email`, `role`, `status`, `two_factor_enabled`, `created_at` |
| `platform.support_threads` | Uma conversa de suporte | `id`, `organization_id`, `user_id`, `channel` (`chatbot`), `status` (`open`, `waiting_customer`, `waiting_us`, `resolved`), `subject`, `origin_screen`, `error_reference`, `assigned_to`, `last_message_at`, `created_at`, `resolved_at` |
| `platform.support_messages` | Mensagens da conversa | `id`, `thread_id`, `author` (`customer`, `bot`, `staff`), `staff_id`, `body`, `attachments`, `created_at` |
| `platform.audit_logs` | Auditoria do painel (só acrescenta) | `id`, `admin_id`, `action`, `organization_id`, `target`, `reason`, `before`, `after`, `ip`, `created_at` |
| `platform.plan_grants` | Planos concedidos pelo painel (cortesia, carência, ajuste) | `id`, `organization_id`, `tier`, `interval`, `kind` (`courtesy`, `grace`, `correction`), `starts_on`, `ends_on`, `reason`, `granted_by`, `revoked_at` |
| `platform.announcements` | Comunicados aos donos de espaço | `id`, `title`, `body`, `audience` (`all`, `plan`, `area`, `spaces`), `audience_filter`, `starts_at`, `ends_at`, `severity`, `created_by` |
| `platform.announcement_reads` | Quem já viu | `announcement_id`, `user_id`, `read_at`, `dismissed_at` |
| `platform.space_notes` | Anotações internas sobre um espaço | `id`, `organization_id`, `admin_id`, `body`, `pinned`, `created_at` |
| `platform.support_access_sessions` | "Entrar como suporte" | `id`, `admin_id`, `organization_id`, `reason`, `scope`, `started_at`, `expires_at`, `ended_at` |

Já existem e o painel só lê: `organizations`, `users`, `subscription_events`, `error_logs`, `job_runs`, `webhook_events`, `audit_logs`, `online_payments`, `legal_consents`, `rate_limits`.

Pergunta de modelagem aberta: guardar o "último acesso" do espaço. Hoje não há coluna; dá para ler `last_sign_in_at` do Supabase Auth pelo servidor (sem coluna nova) ou gravar `last_active_at` em `organizations` por uma rotina leve. Recomendo o primeiro na fase 2.

## 6. Funcionalidades

### 6.1 Início (visão geral)

Uma tela com o estado do negócio em um olhar:

- **Cartões (no máximo 4):** espaços ativos (com variação em 30 dias), assinantes pagos, chamados abertos (com "sem resposta há mais de 24 h" em destaque) e erros novos de hoje.
- **Lista "precisa de atenção":** espaços com pagamento vencido na carência, assinatura removida no parceiro, rotina que falhou, erro novo repetido em mais de um espaço, chamado sem resposta.
- **Atalhos:** abrir chamados, buscar um espaço, criar comunicado.
- **Atividade recente:** últimas ações do painel (da `platform.audit_logs`).

### 6.2 Espaços (tenants)

**Lista** (paginada no servidor, busca por nome, e-mail do dono ou id):

| Coluna | Origem |
| --- | --- |
| Nome e área | `organizations` (`classSegment`, `customSegmentProgression`) |
| Plano e situação | `subscription` (tier, interval, status, `renewsOn`) |
| Dono | `users` (perfil `owner`) |
| Alunos ativos, turmas ativas | contagens (visão materializada ou consulta agregada) |
| Recebimento online | `gateway_status` da subconta |
| Último acesso | Supabase Auth `last_sign_in_at` |
| Criado em | `organizations.created_at` |

**Filtros:** plano, situação (ativo, em carência, revertido ao Grátis, cancelado), área, recebimento online ativo, criado nos últimos 7/30 dias, sem acesso há 30 dias, com erro nas últimas 24 h. **Ordenação:** nome, criação, último acesso, renovação. **Exportar CSV** da lista filtrada (sem dados pessoais).

**Ficha do espaço** (abas):

1. **Resumo:** dados do espaço, dono (nome e e-mail, para contato), plano, próxima renovação, uso (alunos, turmas, professores), fuso, aceite dos termos (versão e data).
2. **Assinatura:** histórico do plano (`subscription_events`, com o autor "Sistema" nas rotinas), cobranças da assinatura no Asaas, troca marcada, carência. Botões da seção 6.4.
3. **Saúde:** erros do espaço (agrupados, mascarados, com o código que o usuário viu), execuções da rotina diária, avisos do Asaas recebidos e ignorados.
4. **Recebimentos online:** situação da subconta (aprovada, pendente), tarifas sincronizadas, pagamentos online dos últimos 30 dias (contagem e valor, sem o nome do aluno), webhook da subconta.
5. **Suporte:** conversas do espaço e as anotações internas (`space_notes`).
6. **Auditoria:** o que o painel fez neste espaço e as últimas ações dos donos (resumo do `audit_logs`, sem detalhe de aluno).
7. **Ações perigosas:** inativar espaço, reabrir, exportar dados do espaço (LGPD), excluir (ver 6.8).

### 6.3 "Entrar como suporte"

Para entender um problema real, o suporte às vezes precisa ver a tela do cliente. Fluxo:

1. Na ficha do espaço, "Ver como suporte", com motivo obrigatório (texto livre e um tipo: "dúvida do cliente", "erro", "cobrança", "outro") e, se vier de um chamado, o chamado ligado.
2. Cria `support_access_sessions` com validade de 30 minutos (renovável uma vez), grava na auditoria da plataforma e **na auditoria do próprio espaço** ("Suporte do GestaraHub acessou a conta", visível ao dono).
3. Abre uma visão **somente leitura** do espaço (sem botões de gravar, sem enviar mensagem, sem cobrar). Fase 1 dessa função: só telas de configuração, plano, turmas e cobranças sem nome de aluno; ficha de aluno só com um segundo motivo.
4. Qualquer escrita em nome do cliente é uma ação própria do painel (por exemplo "corrigir o fuso"), nunca pela visão de leitura.

### 6.4 Planos e assinaturas

- **Ver** o plano de cada espaço, o histórico, a renovação e o que o cliente vê ("Seu plano renova em ...").
- **Conceder cortesia:** plano Profissional por N dias (para pilotos e parceiros), com motivo e data de fim. Ao acabar, volta ao Grátis pela rotina diária com o aviso de sempre.
- **Estender carência:** somar dias à tolerância de 5 dias quando houver problema nosso (por exemplo, Pix fora do ar).
- **Corrigir plano:** ajustar tier e intervalo quando um pagamento caiu e o webhook não chegou, com a conferência no Asaas ao lado.
- **Cancelar assinatura no parceiro** e **reenviar a cobrança da diferença** (reaproveitando as ações de servidor que já existem em `services/subscription`).
- **Regras:** toda ação de plano pede motivo, grava em `plan_grants` e na auditoria; `subscription` continua sendo escrita só pelo servidor (o painel usa a mesma camada de ação que o webhook e a rotina). O cliente vê no histórico do plano a linha "Concedido pelo GestaraHub" (sem o nome da pessoa).
- **Catálogo de planos e preços:** tela só leitura na fase 3 (lê `config/subscription.ts`). Edição de preço pelo painel: fase posterior; hoje o preço vem de `config/subscription.ts` e está aprovado.

### 6.5 Suporte e chatbot inteligente

**Decisão do dono:** o chatbot é inteligente (responde dúvidas de uso), ajuda a abrir o chamado e o suporte responde depois pelo app, e-mail e WhatsApp.

**No app dos clientes (`apps/web`):**

- Botão "Fale com a gente" no menu do usuário, na tela de Planos e no aviso de erro ("Algo deu errado. Código ABC123"), já com o código preenchido.
- Janela lateral de conversa. O bot abre perguntando "Como posso ajudar?" com atalhos (dúvida de uso, problema ou erro, cobrança e plano, sugestão).
- A conversa já sai com o contexto, sem a pessoa digitar: espaço, usuário, perfil, plano, área, tela de origem, versão do app e o código do erro.
- Anexo de imagem (captura de tela), com limite de tamanho e tipo.
- Respostas do suporte aparecem na mesma janela (bolinha de "nova resposta" no sino).

**Como o bot responde (inteligente, mas com limites):**

1. **Base de conhecimento:** as docs voltadas ao usuário (guias de uso, regras de cobrança, turmas, planos), reunidas em trechos e buscadas por similaridade (busca no banco com `pgvector`, no schema `platform`). Reindexa quando a doc muda (rotina que roda no deploy). Fonte única: `docs/`, sem manter outra cópia.
2. **Modelo:** a API da Anthropic (Claude), chamada só pelo servidor, com instruções de sistema fixas, as pontas da conversa e os trechos achados. A chave fica no servidor do admin.
3. **Resposta com origem:** sempre cita a tela ("Configurações > Plano") e o trecho da doc de onde veio; sem trecho que sustente, diz que não sabe e **oferece abrir o chamado** (nunca inventa).
4. **O que o bot nunca faz sozinho:** prometer reembolso, prazo, desconto ou mudança de plano; mexer em dado do cliente; responder sobre valores de cobranças específicas. Nesses assuntos só abre o chamado e avisa que um humano responde.
5. **Abrir chamado:** o bot resume o problema em uma frase, confirma com a pessoa ("Posso enviar isso para o suporte?") e cria o chamado com o resumo, a conversa inteira e o contexto. Pede o telefone para o WhatsApp quando a pessoa quer essa via (com o consentimento registrado).
6. **Privacidade:** o modelo recebe a pergunta, o contexto do espaço (plano, área, tela) e trechos de doc; **nunca** dados de alunos, CPF, telefones de terceiros ou valores de cobranças. Mensagens da pessoa passam pelo mascaramento de `lib/log` antes de ir ao modelo. A conversa fica guardada por 12 meses e entra na política de privacidade (item novo a redigir).
7. **Medição:** cada resposta tem "Ajudou?" (sim/não). A tela de Suporte mostra: perguntas resolvidas pelo bot, chamados abertos depois do bot, assuntos mais frequentes e perguntas sem resposta (viram pauta de doc nova). Isso também reduz o seu trabalho no suporte.
8. **Custo:** limite de mensagens por usuário por dia e por espaço, e um teto mensal de gasto com alarme. Cada resposta registra tokens usados.

**Respostas do suporte e canais (decisão do dono):**

- **Inicialmente:** pelo app (a conversa) e por e-mail.
- **Depois:** WhatsApp, para o número de quem abriu o chamado pelo app, com consentimento. Exige uma linha de WhatsApp da plataforma (a oficial da Meta, que também serve para os avisos dos espaços Pro); só entra quando a conta estiver aprovada. A resposta que você escrever no painel sai pelos canais escolhidos pela pessoa; o que ela responder por e-mail ou WhatsApp volta para a mesma conversa (e-mail por endereço de resposta com o código do chamado, WhatsApp pelo número).
- Sem resposta da pessoa em 7 dias, o chamado vai para "resolvido" com aviso; ela reabre respondendo.

**No painel:**

- **Caixa de entrada** com filtros (abertas, aguardando cliente, aguardando nós, resolvidas), busca (assunto, espaço, usuário), ordenação por tempo parado, marcação de **urgente** (o bot marca quando a pessoa não consegue entrar, cobrar ou receber) e contador desde a última mensagem do cliente.
- **Conversa:** histórico com o que o bot já respondeu e o resumo dele no topo, dados do espaço ao lado (plano, área, erros recentes do mesmo código, último acesso), notas internas, mudar status, ligar a um erro (`error_logs`).
- **Respostas prontas** (tabela `platform.support_macros`) com variáveis `{nome}` e `{espaco}`, e botão "sugerir resposta": o mesmo bot prepara um rascunho que você revisa e envia (nunca sai sozinho).
- **Você sozinho no suporte:** o aviso de chamado urgente e o resumo diário (abaixo); sem horário de atendimento por enquanto.
- **Avaliação:** ao resolver, o cliente responde "Ajudou?" e a média aparece no Início.
- **Notificação para você:** e-mail (e depois WhatsApp) para chamado urgente e um **resumo diário** dos demais, em vez de um aviso por mensagem; assim o suporte não interrompe o seu outro trabalho.

**Prazo de resposta (decisão do dono):** a meta é responder em **no máximo 2 dias úteis**, para qualquer plano. É uma meta, sem bloqueio nem multa.

| Situação | Como funciona |
| --- | --- |
| Dúvida de uso | O bot responde na hora, 24 horas por dia; você só entra quando ele não resolve |
| Chamado | Meta de 2 dias úteis até a primeira resposta; a lista mostra verde (no prazo), amarelo (último dia) e vermelho (passou) |
| Urgente (não consegue entrar, cobrar ou receber) | O bot marca como urgente e você recebe aviso imediato por e-mail (e depois WhatsApp); a meta continua sendo a mesma |

A janela do chat diz ao cliente "Respondemos em até 2 dias úteis". **Sem horário de atendimento por enquanto**: não há mensagem de ausência nem expediente configurado; entra depois, se fizer falta. Se o volume crescer, o primeiro ajuste é contratar atendimento, não apertar o prazo.

### 6.6 Saúde do sistema

- **Erros:** lista de `error_logs` agrupados por impressão (`fingerprint`), com contagem, primeiro e último registro, espaços afetados (contagem), origem (servidor, navegador, rotina, webhook) e o código mostrado ao usuário. Filtros por origem, nível, espaço e período. Ação "marcar como conhecido" (silencia do resumo diário).
- **Busca por código:** o suporte cola o código que o cliente mandou e cai na linha do erro e no espaço.
- **Rotinas:** `job_runs` (a diária, a de aniversários, a de lembretes) com última execução, duração, resultado e falhas; botão "rodar de novo" só para quem tem papel de dono e só em rotinas seguras (idempotentes).
- **Avisos do parceiro:** `webhook_events` (processados, repetidos, ignorados, com erro), com filtro por tipo (`PAYMENT_RECEIVED`, `SUBSCRIPTION_DELETED`...) e por espaço.
- **Integrações:** painel de estado do Asaas (conta principal e subcontas aprovadas, pendentes e com problema), MailerSend (entregas e recusas) e Supabase (uso de banco e armazenamento, quando houver API para isso).
- **Desempenho:** ações mais lentas do dia por espaço (a medição da fase de desempenho já registra tempos; expor só se houver custo baixo).

### 6.7 Receita e crescimento

(Os preços já estão aprovados em `product/13`: Profissional R$ 79,90/mês ou R$ 799/ano; Expansão R$ 199/mês ou R$ 1.990/ano. O que trava esta fase é o webhook da conta principal do Asaas, para conferir a receita.)

- **Assinantes:** total por plano, por intervalo e por área.
- **Movimento:** entradas (novos assinantes), saídas (cancelamentos e reversões ao Grátis) e trocas de plano, por mês.
- **Conversão:** quantos espaços Grátis viraram Profissional em 30/60/90 dias, e o tempo até a conversão.
- **Receita recorrente:** soma das assinaturas ativas (mensal e anual dividida por 12) e a taxa do Pix recebida pelo GestaraHub (split de R$ 1,99 e R$ 1,29), conferidas com o Asaas.
- **Retenção:** quantos espaços ativos há 30 dias seguem ativos hoje, e os que pararam de usar (sem acesso, sem chamada, sem cobrança).
- **Funil de ativação:** conta criada, configuração inicial concluída, primeira turma, primeiro aluno, primeira chamada, primeira cobrança, recebimento online ativo (alimenta o "primeiros passos" do app).

### 6.8 Dados e LGPD

- **Pedidos do titular:** registrar o pedido (acesso, correção, exclusão) com data, prazo de 15 dias e responsável; o painel só encaminha, o dono do espaço decide sobre os dados dos alunos dele (somos operadores).
- **Exportar os dados do espaço** (a pedido do dono, com ele autorizando): arquivo único, gerado no servidor, link com validade de 24 h.
- **Excluir espaço:** dois passos (inativar por 30 dias, depois excluir), com contagem de quantos alunos e cobranças serão apagados e exigindo a confirmação do nome do espaço. Cobranças pagas e documentos fiscais seguem a retenção do `product/24`.
- **Termos:** versão em vigor, quem já aceitou, quem falta (útil quando uma versão nova for publicada).

### 6.9 Comunicados

- **Criar comunicado:** título, texto curto, gravidade (informação, aviso, urgente), público (todos, por plano, por área, espaços escolhidos), início e fim.
- **Onde aparece:** faixa no topo do `apps/web` (como o aviso de renovação) e no sino, e opcionalmente por e-mail. O usuário pode dispensar; `announcement_reads` guarda quem viu.
- **Casos de uso:** manutenção programada, novidade, mudança de preço, termo novo, incidente em andamento.
- **Modelos prontos:** "Manutenção em {data}", "Parceiro de pagamentos instável".

### 6.10 Equipe do painel e auditoria

- **Usuários do painel:** convidar por e-mail, papel, ativar/desativar, redefinir a verificação em duas etapas. Última entrada e dispositivo.
- **Auditoria da plataforma:** lista filtrável (quem, ação, espaço, período) com o "antes e depois" e o motivo; só leitura e sem exclusão. Exportar CSV.
- **Alertas de segurança:** várias falhas de login, entrada de IP novo, "entrar como suporte" fora do horário comercial.

### 6.11 Configurações da plataforma

- **Parâmetros:** prazo da meta de resposta (2 dias úteis), dias de carência padrão, janela do resumo diário de erros, e-mail de suporte, limite de anexo.
- **Respostas prontas** do suporte e **modelos de comunicado**.
- **Modo de manutenção:** liga uma faixa no app dos clientes (via comunicado urgente).
- **Chaves e integrações:** só mostra se estão configuradas (sim/não); nunca exibe segredo.

## 7. Telas e navegação

```
Início
Suporte        (caixa de entrada, conversa, respostas prontas)
Espaços        (lista, ficha com abas)
Planos         (concessões, catálogo)
Saúde          (erros, rotinas, avisos do parceiro, integrações)
Receita        (assinantes, movimento, conversão, ativação)
Comunicados
Dados e LGPD   (pedidos, exportações, exclusões)
Equipe         (usuários do painel, auditoria)
Configurações
```

Padrões de tela: lista com busca, filtros e resumo no topo; ações de linha no menu "⋮"; confirmação para qualquer coisa que mexa em dinheiro, acesso ou exclusão; texto sem reticências cortando palavras; botões de 36 px. Reaproveitar os mesmos padrões de `docs/frontend/07`, adaptados a um painel denso.

## 8. Segurança e privacidade

1. **Autenticação:** senha forte (8+), TOTP obrigatório, bloqueio por tentativas (`rate_limits`), sessão de 8 h, sem "lembrar dispositivo".
2. **Autorização:** papel checado no servidor em toda ação (`requirePlatformRole`), nunca só na tela. Teste de unidade por papel.
3. **Chave de serviço:** só no servidor do admin; nunca em código de navegador, log ou mensagem de erro; rotacionável.
4. **Dados pessoais:** respostas de lista nunca trazem nome, CPF, telefone ou e-mail de aluno. Nome e e-mail do **dono** do espaço aparecem para contato. Telefones e CPFs mascarados (como em `lib/log`).
5. **Auditoria dupla:** o painel grava na sua auditoria e, em ações que tocam o espaço (acesso como suporte, plano concedido), também na do espaço, visível ao dono.
6. **Imutabilidade:** `platform.audit_logs` sem update e sem delete (mesmo padrão de `audit_logs`, migração `...44`).
7. **LGPD:** somos operadores dos dados de alunos e controladores dos dados de donos de espaço; o painel respeita essa divisão e registra a base legal de cada acesso (motivo).
8. **Cabeçalhos e rede:** CSP restrita, `X-Frame-Options`, domínio isolado do app dos clientes (cookie não compartilhado), opção de restringir por IP.
9. **Segredos e CPF** nunca em código, log, PR ou memória (regra do repositório).

## 9. Integrações do painel

- **Asaas:** consulta de assinatura e cobrança da conta principal, estado das subcontas, reenvio de cobrança. Somente leitura do Asaas pelo MCP de documentação; as chamadas reais são do código, em sandbox até a produção. Webhook da conta principal (pendência de produção) é pré-requisito para a receita da fase 4.
- **MailerSend:** envio das respostas do suporte e dos comunicados por e-mail (pendente a aprovação da conta; hoje entrega a 1 destinatário).
- **Supabase Auth (admin API):** último acesso, redefinir 2FA do painel.
- **Resumo diário de erros:** passa a incluir o link do painel (hoje vai só por e-mail).
- **PostHog:** só do app dos clientes; o painel não usa análise de uso de terceiros.

## 10. Fases e entregas

Cada fase tem um critério de pronto e pode ser lançada sozinha. Tamanho relativo: P (poucos dias), M (cerca de uma semana), G (mais de uma semana).

| Fase | Entrega | Pronto quando | Tam. |
| --- | --- | --- | --- |
| 0. Alicerce | `apps/admin` criado, login com TOTP, papel `platform_owner`, auditoria da plataforma, deploy de teste, lint e typecheck no CI | Você entra no painel vazio, com 2FA, e a ação de login aparece na auditoria | M |
| 1. Fale com a gente | Botão e janela de conversa no `apps/web`, tabelas de suporte no schema `platform`, caixa de entrada e conversa no painel, e-mail de resposta, ligação com o código de erro, aviso de urgente e resumo diário para você | Um cliente manda mensagem, você responde pelo painel e ele vê a resposta no app e no e-mail | M |
| 1B. Chatbot inteligente | Base de conhecimento a partir de `docs/`, busca por similaridade, resposta com origem, abrir chamado pelo bot, "Ajudou?", limites de custo e privacidade, rascunho de resposta para você | O bot responde dúvidas comuns citando a doc e abre chamado com resumo quando não sabe; nenhuma resposta traz dado de aluno | G |
| 2. Espaços (leitura) | Lista com filtros, ficha do espaço (resumo, assinatura, saúde, auditoria), anotações internas, último acesso | Achar qualquer espaço em segundos e ver plano, erros e histórico sem abrir o banco | M |
| 3. Planos e assinatura | Cortesia, carência estendida, correção de plano, cancelar e reenviar cobrança, catálogo em leitura, `plan_grants` | Conceder 30 dias de Profissional a um piloto e o espaço voltar ao Grátis sozinho no fim | M |
| 4. Saúde | Erros agrupados, busca por código, rotinas, avisos do parceiro, integrações, "marcar como conhecido" | Um erro novo aparece na tela do dia seguinte com os espaços afetados, e a busca por código acha o espaço | M |
| 5. Comunicados | Comunicados com público e faixa no app | Um aviso de manutenção aparece só para os públicos escolhidos e some no fim | M |
| 6. Equipe e LGPD | Convite de usuários do painel e papéis, pedidos do titular, exportação e exclusão de espaço, alertas de segurança | Um segundo atendente entra só com o papel de suporte e não vê plano nem receita | G |
| 7. Receita e crescimento | Assinantes, movimento, conversão, receita recorrente, retenção e funil de ativação | Os números batem com o Asaas em uma conferência manual | G |
| 8. Entrar como suporte | Sessão com motivo e validade, visão somente leitura, auditoria dupla | O dono do espaço vê no histórico quando o suporte entrou e por quê | G |

Ordem recomendada: 0, 1, 1B, 2, 4, 3, 5, 6, 8, 7. O WhatsApp como canal de resposta (fase 1C) entra quando a conta do WhatsApp da plataforma estiver aprovada. A 7 espera o webhook da conta principal do Asaas (os preços já estão aprovados).

## 11. Testes

- **Vitest (rápido):** regras puras (papéis, concessão e fim de cortesia, carência, cálculo de receita recorrente, mascaramento) e serviços sobre o mundo de testes.
- **`test:db`:** RLS das tabelas novas (usuário comum não lê nada), auditoria imutável, `plan_grants` e a rotina que reverte plano ao fim da cortesia.
- **Segurança:** teste que um perfil de tenant não acessa nenhuma rota nem tabela do painel, e que cada papel de plataforma só faz o que a matriz permite.
- **e2e (Playwright):** login com TOTP, caixa de suporte, ficha do espaço, concessão de plano. Só quando o dono pedir; entram na rodada final, não a cada mudança.
- **Manual:** roteiro por fase em `docs/guides/` (como foi feito com o teste geral), incluindo a conferência de receita com o Asaas.

## 12. O que preparar na infra (por conta do dono)

O código fica pronto no repositório; estes passos são de configuração:

| Item | Para quê |
| --- | --- |
| Projeto novo na hospedagem para `apps/admin` (preview e produção) | Deploy independente |
| Domínio e DNS de `admin.gestarahub.com.br` | Endereço do painel |
| Variáveis de ambiente do admin (chave de serviço, URL e chave pública do Supabase, e-mail, segredo de sessão) | Configuração sem segredo no código |
| Proteção da branch principal e CI do novo app | Mesmo padrão do `apps/web` |
| Aprovar a conta do MailerSend e o domínio de envio | E-mails de suporte e comunicados |
| No mesmo projeto Supabase: criar o schema `platform` e o papel `platform_app` (migração), sem expor o schema na API | Onde moram `platform.admins` e as tabelas do painel |
| Chave da API da Anthropic (só no servidor do admin) e teto de gasto | Chatbot inteligente |
| Linha de WhatsApp da plataforma na Meta (depois) | Resposta de suporte por WhatsApp |


## 13. Decisões e perguntas

**Decididas pelo dono em 24/10/2026:**

1. Perfil único hoje, com cadastro de outros administradores que só acessam o painel, nunca o `apps/web` (seção 3).
2. Chatbot inteligente que responde dúvidas de uso e ajuda a abrir chamado (6.5).
3. Resposta pelo app (primeiro), por e-mail e depois por WhatsApp, para quem abriu o chamado pelo app (6.5).
4. Mesmo projeto Supabase, schema próprio `platform`, com acesso de leitura ao `public` (seção 4).
6. Meta de resposta pensada para uma pessoa só (tabela em 6.5).
8. Preços já aprovados em `product/13` (a fase de receita só espera o webhook da conta principal).

5. "Entrar como suporte" fica para a fase 8, depois do chatbot (6.3).
7. Cortesias: só o `platform_owner` concede; os outros papéis ganham a permissão quando o dono configurar (6.4).
9. Teto de gasto com a IA: R$ 150 por mês, com alarme em 80% (6.5).
10. Meta de resposta: no máximo 2 dias úteis; sem horário de atendimento por enquanto (6.5).

**Em aberto:** nada que trave a fase 0. Ficam para quando chegarem: o texto da política de privacidade para as conversas do chatbot, e a conta do WhatsApp da plataforma.

## 14. Riscos

| Risco | Cuidado |
| --- | --- |
| Chave de serviço vazar ou ser usada sem rastro | Só no servidor do admin; toda ação passa por uma função que grava a auditoria; revisar as ações por papel |
| Painel virar atalho para ver dados de alunos | Dados pessoais fechados por padrão; acesso só com motivo, validade e auditoria dupla |
| Suporte sem fila e sem dono | Atribuição, meta de resposta e aviso de chamado parado no Início |
| Concessão de plano que "esquece" de acabar | A cortesia tem data de fim obrigatória e a rotina diária reverte, com o aviso ao dono |
| Receita divergente do Asaas | Conferência manual na fase 7 e o webhook da conta principal antes de confiar nos números |
| Custo de manter dois apps | Mesmo monorepo, mesma stack e pacotes compartilhados; o admin é propositalmente simples |

## 15. Documentos relacionados

[technical/17](17-verificacao-em-duas-etapas.md) (2FA), [technical/21](21-registro-de-erros.md) (erros), [technical/23](23-historico-em-segundo-plano.md) (rotinas e avisos), [technical/24](24-plano-gestarahub.md) (plano), [technical/25](25-pagamento-online.md) (pagamento online), [product/13](../product/13-modelo-de-negocio.md) (negócio e preço), [product/24](../product/24-diretrizes-exclusao-e-lgpd.md) (exclusão e LGPD).

## 16. Fase 0 feita (24/10/2026): o que existe e o que mudou do desenho

**Entregue:** `apps/admin` (Next 16, a mesma stack e o mesmo tema do web, com roxo da logo como cor de ação, menu lateral escuro e faixa de ambiente), login com senha e segundo fator obrigatório, sessão de 8 horas, auditoria, telas Início, Equipe (leitura) e Auditoria, schema `platform`, papel `platform_app` e o `pnpm admin:setup` / `pnpm admin:create-admin`.

**Decisões tomadas na construção**

- **Sem `service_role` no painel.** O painel só tem a conexão do papel `platform_app` (`PLATFORM_DATABASE_URL`). A chave de serviço do Auth aparece só no comando `admin:create-admin`, e nunca é gravada.
- **Marcador de plataforma** (`app_metadata.platform = true`): só o servidor grava (o teste confirma que o próprio usuário não consegue se promover). O `apps/web` recusa essas contas no login (`signInWithPasswordAction`), em `requireTenant` e em `getClientForTenant`.
- **E-mail único nos dois sentidos**, por gatilhos: `platform.admins` recusa e-mail de usuário de espaço e `public.users` recusa e-mail de administrador.
- **Cookies próprios** (`gestara-admin*`, `SameSite=Strict`) e um cookie assinado (HMAC) com o início da sessão para o limite de 8 horas; o painel confere sessão, marcador, linha ativa, tempo e AAL2 em cada página e action (`getAdminContext`).
- **Auditoria sem chave estrangeira** para o administrador: é um livro de registro e nada pode alterá-la, nem apagar um administrador. O nome de quem fez fica gravado na linha.
- **Limite de tentativas falha fechado** (se o banco não responde, recusa), ao contrário do app dos clientes.
- `public.organizations` é a única tabela do `public` que o painel lê hoje (uma política `TO platform_app`); cada fase acrescenta as suas.
- O convite de novos administradores continua na fase 6; por ora, `pnpm admin:create-admin`.
- Os componentes de UI foram copiados do `apps/web` (sem o "descartar alterações" do web); um pacote de UI compartilhado fica para quando houver um terceiro app.

**Não coberto ainda:** testes e2e (só quando você pedir) e a verificação visual das telas.

## 17. Fases 1 a 8 feitas (24/10/2026): o que existe

Tudo na branch `painel-admin`, sem commit nas fases 1 a 8. Migrações `…051` a `…057`. Testes: `pnpm --filter @gestarahub/admin test:db` (77) e os de banco do web (`support`, `platformAdmin`, `courtesy`, `announcements`).

**Fase 1 e 1B, Fale com a gente e assistente.** No app dos clientes, "Fale com a gente" no menu do usuário e nos Planos (`features/support`, `services/support/*`). O assistente busca nos artigos de `docs/ajuda/*.md` (índice gerado por `pnpm --filter @gestarahub/web help:build`), responde com regras fixas (nunca promete reembolso nem prazo, mascara CPF, e-mail, telefone e cartão, passa a pessoa para a equipe com `[[humano]]` ou quando parece urgente) e tem limites (30 por pessoa/dia, 150 por espaço/dia, R$ 150/mês em `platform.settings`). Sem `ANTHROPIC_API_KEY` o assistente não responde e a conversa vai direto para a equipe. No painel: caixa de entrada com meta de 2 dias úteis, respostas prontas, nota interna, urgente, encerrar/reabrir, aviso por e-mail ao cliente e resumo diário (`/api/cron/digest`).

**Fase 2, Espaços.** Lista com filtros, ordenação e exportação (CSV) e a ficha do espaço em abas (resumo, assinatura, saúde, recebimentos online, suporte e notas, auditoria do painel, dados e LGPD). O painel lê só visões agregadas (`platform.space_stats`, `space_owners`, `space_activity`, `space_online_30d`) e colunas liberadas de `organizations` (sem chaves do parceiro de pagamentos).

**Fase 3, Planos e cortesia.** Funções do banco gravam plano, histórico, Auditoria do espaço e auditoria do painel na mesma transação: cortesia (com fim obrigatório; no fim volta ao Grátis pela troca agendada que já existe), encerrar cortesia, mais dias para pagar e voltar ao Grátis. Só quem tem `plans:grant`. O app dos clientes mostra a cortesia no histórico e deixa o dono assinar durante ela.

**Fase 4, Saúde.** Erros por código (com "erro conhecido"), rotinas, avisos do parceiro de pagamentos e visão dos recebimentos online. Busca pelo código que o cliente informa.

**Fase 5, Comunicados.** `platform.announcements` (público: todos, por plano, por área ou espaços escolhidos; início e fim; aviso, atenção ou urgente). O app dos clientes mostra no topo (`AnnouncementBanner`), cada pessoa dispensa o seu e o urgente não se dispensa. No painel: criar, editar, arquivar, prévia de quantos espaços recebem e contagem de dispensas. A regra de público é uma função só do banco (`platform.audience_matches`), usada pelo painel e pelo app. Começar vazio usa a hora do banco (o relógio do app pode diferir).

**Fase 6, Equipe e LGPD.**
- Convite de administradores (só `platform_owner`): o único módulo com a chave de serviço do Auth é `lib/server/auth-admin.ts` (`ADMIN_SERVICE_ROLE_KEY`, opcional; sem ela o convite fica desligado). O convite cria o login sem senha, a linha "convidado" e manda um link de uso único; o aceite (`/accept`) confere o código só no envio da senha (para o programa de e-mail não gastar o link), vale só para quem está "convidado", define a senha, ativa e segue para o segundo fator. Sem e-mail configurado, o painel mostra o link uma vez. Mudar papel, desativar, reativar e reiniciar o 2FA têm confirmação e auditoria; ninguém mexe em si mesmo e o painel nunca fica sem proprietário ativo (regra em `lib/server/team.ts`).
- Pedidos do titular (`/privacy`): tipo, espaço, prazo de 15 dias, situação e o que foi feito (obrigatório para concluir ou recusar). A auditoria guarda só o tipo e o número, nunca nome nem e-mail do titular.
- Aba "Dados e LGPD" do espaço (só proprietário): exportar os dados do espaço em JSON (função `platform.export_space`: só tabelas de cadastro e operação, sem token, segredo, hash, senha nem chave) e inativar/reativar o espaço (`platform.set_space_status`). Espaço inativo: o app dos clientes derruba a sessão (`getCurrentUser`) e recusa as ações (`requireTenant`), e as rotinas diárias pulam o espaço. Nada é apagado.

**Fase 8, Visão de suporte.** Não é entrar no espaço: é uma visão **somente leitura**, com motivo e 30 minutos (`platform.support_access_sessions`), montada só de configuração e totais (plano, pessoas por perfil, alunos e matrículas por situação, turmas com lotação, planos de mensalidade, cobranças dos últimos 6 meses por total, recebimentos online por situação, termos aceitos pelo proprietário). Nenhum nome, telefone, e-mail ou CPF de aluno. Abrir registra na Auditoria do espaço (o dono vê "Suporte do GestaraHub abriu uma visão de suporte") e na do painel; só vale para quem abriu e termina ao encerrar ou expirar. Papéis: proprietário e suporte (`support:access`).

**Fase 7, Receita.** `/revenue`: receita mensal (anual dividido por 12, cortesia fora, preços de `@gestarahub/core/subscription-prices`), assinantes por plano, funil (criou espaço, cadastrou alunos, criou turmas, gerou cobranças, recebeu pelo app, paga plano), uso nos últimos 30 dias e movimento dos últimos 6 meses (novos, assinaram, subiram, reduziram, cancelaram, voltaram ao Grátis, pagamentos online e a taxa que fica com o GestaraHub). Só totais, por visões do banco (`…057`).

**Início** virou o painel de atenção: conversas esperando, erros de hoje, renovações atrasadas e pedidos LGPD, cada um leva à tela. O menu mostra o número de conversas esperando e de pedidos LGPD fora do prazo.

**Formulários (24/10, depois do teste do login).** Todos os formulários do painel usam React Hook Form + Zod, como o app dos clientes: erro por campo no navegador antes de enviar (`apps/admin/src/components/form`, hook `useActionForm`, schemas em `lib/form-schemas.ts`). A server action continua sendo a autoridade (valida de novo e grava), então as actions e os testes de banco não mudaram. Ficam sem RHF só os botões sem campo (reenviar convite, reiniciar 2FA, desativar/reativar pessoa, encerrar visão, arquivar) e o seletor de papel de uma linha da equipe.

**2FA dos usuários dos espaços.** Na aba "Dados e LGPD" do espaço o proprietário reinicia o 2FA de uma pessoa que perdeu o aplicativo e os códigos de recuperação (detalhes em [technical/17](17-verificacao-em-duas-etapas.md)); registra nos dois lugares e avisa a pessoa por e-mail.

**Recuperação do 2FA do painel.** Outro proprietário reinicia o 2FA de alguém pela tela Equipe (ninguém reinicia o próprio). Para o único proprietário que perdeu o aplicativo: `pnpm admin:reset-mfa -- --email ...` (`apps/admin/scripts/reset-mfa.mjs`), que exige acesso à infraestrutura, pede confirmação (`--yes` pula) e grava `admin.mfa_reset` na auditoria. Não há códigos de recuperação impressos.

**Decisões tomadas na construção (sem pergunta ao dono)**
- Cortesia reaproveita a troca agendada, sem mexer no motor de cobrança.
- Excluir espaço de vez **não foi feito**: só inativar (reversível). A exclusão definitiva pede um levantamento do que apagar (cascata das tabelas, logins do espaço, assinatura no parceiro) e fica nas pendências.
- Convite só pelo proprietário; o link do convite nunca é gravado nem registrado em log.
- Aviso urgente não pode ser dispensado; os outros, só pela pessoa que dispensa.

**Ainda não feito** (também em [pendencias](../pendencias.md)): "sugerir resposta" por IA na caixa de entrada, imagens no chat, reenviar cobrança e cancelar assinatura no parceiro pelo painel, rodar uma rotina de novo, resumo diário de erros do web ignorar "erro conhecido", resposta por e-mail do cliente voltar para a conversa, WhatsApp como canal (fase 1C, depende de conta Meta), exclusão definitiva de espaço, quais termos cada espaço aceitou na aba de dados (hoje só na visão de suporte), configurações da plataforma (seção 6.11) e e2e do painel.
