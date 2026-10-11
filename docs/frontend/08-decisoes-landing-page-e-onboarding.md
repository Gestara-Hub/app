# Decisões de Produto, Landing Page & Onboarding Setup

> **Documento de Contexto Estratégico & UI/UX**
> Registra o estado da arte das decisões recentes tomadas no produto GestaraHub, cobrindo o posicionamento de mercado, a nova Landing Page, o fluxo de Setup inicial (`/setup`), as preferências estéticas do usuário e o estado dos arquivos modificados.

---

## 1. Visão Geral & Posicionamento do Produto

O GestaraHub é um sistema moderno de gestão para quem ensina, com modelo **100% gratuito** na sua operação base.

### Pilares Fundamentais:
1. **Turmas Coletivas OU Aulas Particulares (Individuais / 1 a 1 / VIP)**:
   - O sistema **NÃO** é restrito a turmas em grupo. Ele suporta nativamente professores que dão aulas particulares individuais (ex.: personal fight, studio VIP de pilates, aulas de instrumentos/canto, idiomas particulares) com horários de 1 vaga ou turmas completas.
2. **Multi-Segmento**:
   - Abrange de forma nativa e comprovada:
     - **Lutas & Artes Marciais** (Jiu-Jitsu, Muay Thai, Judô, Boxe, Karatê)
     - **Pilates & Yoga** (Reformer, Solo, Studio VIP)
     - **Música & Idiomas** (Inglês, Espanhol, Violão, Piano, Canto)
     - **Dança & Movimento** (Ballet, Dança de Salão, Ritmos, Ginástica)
     - **Boxes & Funcional** (CrossFit, Treino Funcional, HIIT, Calistenia)
     - **Natação & Esportes** (Natação Infantil, Hidroginástica, Beach Tennis)
     - **Segmento Personalizado** (regras flexíveis sob medida)
3. **Controle de Progresso Configurável**:
   - Não se resume a "faixas de luta". É uma **trilha de evolução configurável**: faixas e graus em lutas, níveis técnicos no pilates/dança, módulos em música/idiomas, ou fases na natação/esportes. O sistema contabiliza presenças e sugere avanços automaticamente.

---

## 2. Filosofia de Design e Preferências Estéticas do Usuário

O usuário tem diretrizes estéticas rigorosas que devem ser respeitadas em qualquer nova tela ou componente:

1. **Anti-Poluição Visual**:
   - Proibido empilhar múltiplos formatos visuais diferentes em uma mesma seção.
   - Proibido usar mockups falsos de dashboard ou blocos cheios de números clichê de marketing (ex.: "+15h economizadas", "99% de satisfação").
2. **Micro-Cópia Ultra-Concisa**:
   - Textos escaneáveis, curtos e diretos (6 a 8 palavras por item).
   - Frases de 1 linha. Sem textão ou parágrafos redundantes.
3. **Zero Textos Truncados / Reticências**:
   - NUNCA usar `line-clamp` que corte palavras no meio gerando reticências feias (ex.: `"postura co..."`, `"Karatê e..."`). O layout e a cópia devem ser desenhados para que **100% do texto caiba visível**.
4. **Zero Duplicação de Informações**:
   - NUNCA renderizar duas listas que mostram os mesmos dados na mesma tela (ex.: no setup de modalidades, os chips interativos já mostram a seleção; não deve existir uma segunda caixa abaixo repetindo "Modalidades selecionadas").
5. **Tipografia e Rótulos Naturais**:
   - Labels de formulários devem ser concisas (ex.: usar **`Nome*`** em vez de *"Nome da sua academia, estúdio ou escola\*"*).
   - O asterisco de obrigatório deve ficar tipograficamente colado ao texto (**`Nome*`**), sem `gap` de flexbox afastando o caractere.

---

## 3. Decisões da Landing Page (`apps/web/src/features/landing/`)

### 3.1. Hero (`landing-hero.tsx`)
- **Pill superior**: *"Aulas em Grupo ou Individuais • Sistema 100% Gratuito"*.
- **Typewriter**: Alterna dinamicamente entre os nichos reais (*"Lutas & Artes Marciais."*, *"Pilates & Yoga."*, *"Música & Instrumentos."*, *"Idiomas & Línguas."*, *"Dança & Escolas."*, *"Boxes & Funcional."*).
- **Badges de confiança**: *"Em grupo ou aulas particulares"*, *"Sem limite de alunos ou horários"*, *"Chamada direta no celular"*.

### 3.2. Antes vs. Depois (`landing-problems.tsx`)
- **Título & Subtítulo**:
  - Overline: `MENOS DOR DE CABEÇA, MAIS TEMPO PARA ENSINAR`
  - Título: **A rotina desgastante de hoje vs. Com o GestaraHub**
  - Subtítulo: *Veja as dores reais do seu dia a dia que você elimina da sua rotina:*
- **Contraste em 3 Linhas Limpas**:
  1. *Negócio espalhado em vários sistemas, cadernos e planilhas* ➔ **Tudo em um só lugar: financeiro, comunicação e gerenciamento de turmas**
  2. *Perder tempo com prancheta de papel e mensagens no WhatsApp* ➔ **Chamada em 3 segundos no celular e turmas organizadas**
  3. *Mensalidades atrasadas e contas manuais para pagar professores* ➔ **Visão clara de quem pagou e repasse calculado em 1 clique**
- **O que foi removido**: Os blocos de "Passo a passo em 3 etapas" e a caixa de métricas genéricas (`+15h`, `0 listas`, `R$ 0`) foram eliminados por poluir a página e duplicar o que os 4 Pilares já explicam.

### 3.3. Modalidades (`landing-segments.tsx`)
- Substituiu a versão antiga com abas compridas e listas de 6 checks.
- Grid minimalista de **6 cards com micro-cópia exata**:
  - **Lutas & Artes Marciais** (`Jiu-Jitsu • Muay Thai • Judô • Boxe`): *"Chamada no tatame e esteira de faixas."* (Tag: `Turmas e Personal`)
  - **Pilates & Yoga** (`Reformer • Solo • Studio VIP`): *"Limite por aparelho e reposições organizadas."* (Tag: `Grupos ou 1 a 1`)
  - **Música & Idiomas** (`Inglês • Espanhol • Violão • Piano • Canto`): *"Aulas particulares ou turmas por módulos."* (Tag: `VIP ou em Grupo`)
  - **Dança & Movimento** (`Ballet • Salão • Ritmos • Ginástica`): *"Turmas por nível e ensaios particulares."* (Tag: `Coletivo ou VIP`)
  - **Boxes & Funcional** (`CrossFit • Funcional • HIIT • Calistenia`): *"Bloqueio ao lotar e fila de espera automática."* (Tag: `Lotação e Fila`)
  - **Outra modalidade?** (`Natação • Tênis • Cursos Livres`): *"Regras flexíveis para o seu jeito de ensinar."* (Tag: `Personalizado` + Link *"Criar conta gratuita →"*)
- Subtítulo: *"Turmas coletivas ou aulas particulares (1 a 1) no mesmo sistema."*
- Âncora de navegação: `#modalidades`.

### 3.4. Recursos & 4 Pilares (`landing-features.tsx`)
- 4 pilares limpos em 4 cards:
  1. **Gestão Financeira**: Mensalidades, controle de pagamentos e repasse de professores sem calculadora.
  2. **Turmas & Aulas Particulares**: Grade coletiva ou VIP, chamada em 3 segundos e limite de vagas.
  3. **Controle de Progresso**: Trilha configurável (faixas, níveis ou fases) com avanço por presença/tempo.
  4. **Comunicação & Vagas**: Reposições na grade, aula experimental e avisos sem bagunça no WhatsApp.
- Âncora: `#recursos`.

### 3.5. Cadastro Rápido (`landing-signup-section.tsx`)
- Formulário minimalista de 30 segundos solicitando apenas **Nome** e **E-mail**.
- Cria a conta, define o tenant ativo e redireciona imediatamente para o fluxo `/setup`.
- Âncora: `#cadastro`.

### 3.6. Dúvidas Frequentes (`landing-faq.tsx`)
- Perguntas e respostas objetivas reforçando gratuidade permanente sem cartão de crédito, suporte a aulas 1 a 1 particulares e turmas em grupo, música/idiomas, chamada no celular, trilhas de evolução e repasses a professores.

### 3.7. Fluidez no Scroll & Animações
- Componente nativo [`ScrollReveal`](file:///Users/mhmj/workspace/gestarahub/apps/web/src/features/landing/components/scroll-reveal.tsx):
  - Baseado em `IntersectionObserver` do browser + aceleração de hardware pela GPU (`translate3d` e `opacity`).
  - Suporte a `prefers-reduced-motion`.
  - **Bidirecional contínuo (`once: false`)**: Reanima suavemente em cascata (*stagger*) tanto na descida quanto na subida da página, com reset instantâneo ao sair do viewport.
- **Barra de Progresso**: Linha de 2px na cor primária na base do `LandingHeader` fixo que acompanha a porcentagem da página (0% a 100%).

---

## 4. Decisões do Fluxo de Setup Inicial (`/setup` & `BusinessSetupWizard`)

Localização: `apps/web/src/features/onboarding/components/business-setup-wizard.tsx` e `apps/web/src/app/(setup)/setup/page.tsx`.

### 4.1. Estrutura do Stepper Superior
- Cabeçalho com espaçamento superior generoso (`pt-6 sm:pt-8`) para não cortar em nenhum monitor.
- Stepper de 3 etapas com feedback de progresso: `1 Espaço → 2 Segmento → 3 Modalidades`.
- Permite navegação direta clicando nos passos já concluídos.
- Sem badges repetitivos de passo embaixo do título.

### 4.2. Passo 1 — Identificação do Espaço
- Título: **Como se chama o seu espaço?**
- Subtítulo: *Vamos personalizar o seu painel e as turmas com a sua marca.*
- Campo 1: **`Nome*`** (com `inline-block` para garantir proximidade tipográfica imediata do asterisco). Placeholder: `Ex.: Tatame Prime, Studio Equilíbrio, Box 71...`.
- Campo 2: **`Unidade ou filial (opcional)`**. Placeholder: `Ex.: Matriz, Unidade Centro, Sala 102...`.
- Botão: **`Continuar →`**.

### 4.3. Passo 2 — Área do Negócio / Segmentos
- Título: **Qual é a área do seu espaço?**
- Subtítulo: *Adaptamos as opções de turmas, regras e chamada para o seu formato.*
- Grid simétrico de 6 cards principais (presets configurados em `apps/web/src/lib/business-segment-presets.ts`):
  1. `martial_arts`: Lutas & Artes Marciais (*Tatame & Faixas* | *Chamada no tatame e esteira de faixas.*)
  2. `fitness_wellness`: Pilates & Yoga (*Aparelhos & VIP* | *Limite por aparelho e reposições organizadas.*)
  3. `education_courses`: Música & Idiomas (*Grupo ou VIP* | *Aulas particulares ou turmas por módulos.*)
  4. `dance_arts`: Dança & Movimento (*Níveis & Turmas* | *Turmas por nível e ensaios particulares.*)
  5. `crossfit_functional`: Boxes & Funcional (*Lotação & Fila* | *Bloqueio ao lotar e fila de espera automática.*)
  6. `aquatics_sports`: Natação & Esportes (*Turmas & Raia* | *Turmas por idade e controle de presença.*)
- **Zero cortes**: Nenhuma reticência nem texto quebrado. Todo o conteúdo cabe 100% no card.
- Opção 7 (Personalizado): Card com borda tracejada, discreto e simétrico. Ao clicar, abre o campo para digitar a modalidade exclusiva.

### 4.4. Passo 3 — Modalidades Oferecidas
- Título: **Quais aulas você oferece?**
- Subtítulo: *Selecione as modalidades para criar suas primeiras turmas.*
- **Pílulas Interativas Unificadas**:
  - Uma única lista de pílulas. Clicar alterna entre selecionado (`✓`, fundo primário) e desmarcado (`+`).
  - Contador no cabeçalho: `2 selecionadas`.
  - **Eliminada a caixa secundária redundante** de "Modalidades selecionadas".
- **Campo de Adição Contextual**:
  - Placeholder dinâmico conforme o segmento escolhido no Passo 2 (ex.: Lutas sugere *Karatê/Capoeira*; Pilates sugere *Mat Pilates/Pilates Clínico*; Música sugere *Piano/Canto/Bateria*).
  - Ao adicionar, a nova aula entra direto como uma pílula ativa com ícone de exclusão `x`.
- **Finalização**: Salva dados da organização e unidade, pré-cria as modalidades marcadas e redireciona para `/dashboard`.

---

## 5. Mapeamento de Arquivos Atuais no Working Tree

### Arquivos Novos (Criados):
- `apps/web/src/app/(setup)/`: Estrutura de rotas do wizard isolado.
- `apps/web/src/features/onboarding/components/business-setup-wizard.tsx`: Wizard de 3 etapas com validação e UX polida.
- `apps/web/src/features/onboarding/components/setup-guard.tsx`: Guardião de redirecionamento.
- `apps/web/src/lib/business-segment-presets.ts`: Presets de segmentos e micro-cópias padronizadas.
- `apps/web/src/features/landing/components/landing-signup-section.tsx`: Cadastro rápido de 30s na LP.
- `apps/web/src/features/landing/components/scroll-reveal.tsx`: Utilitário de scroll reveal com aceleração por GPU.

### Arquivos Modificados:
- `apps/web/src/features/landing/components/landing-*.tsx`: Todos os blocos da nova Landing Page unificada.
- `apps/web/src/features/landing/index.ts`: Exportações do módulo de landing.
- `packages/contracts/src/organization.ts`: Tipos do tenant e segmentos de turmas.
- `apps/web/src/features/onboarding/*`: Banners e diálogos pós-setup no dashboard.

---

## 6. Regras Críticas de Operação (MANDATÓRIO PARA O CLAUDE)

1. **Git**: **NUNCA execute `git commit` ou `git push` automaticamente.** Qualquer commit ou push deve ser explicitamente ordenado pelo usuário. Deixe sempre as alterações no working tree.
2. **Testes**: **NUNCA execute suítes pesadas de testes (`pnpm test` ou `pnpm e2e`) automaticamente.** Apenas execute `pnpm --filter @gestarahub/web typecheck` e `pnpm --filter @gestarahub/web lint` para validar ausência de erros.
3. **Idioma**:
   - Código, identificadores, tipos e variáveis: **100% em Inglês**.
   - Interface com o Usuário, textos e labels: **100% em Português do Brasil (`pt-BR`)**.
