# Decisões de Produto, Landing Page & Onboarding Setup

> **Documento de Contexto Estratégico & UI/UX**
> Registra o estado da arte das decisões recentes tomadas no produto GestaraHub, cobrindo o posicionamento de mercado, a nova Landing Page, o fluxo de Setup inicial (`/setup`), as preferências estéticas do usuário e o estado dos arquivos modificados.

---

## 1. Visão Geral & Posicionamento do Produto

O GestaraHub é um sistema moderno de gestão para quem ensina, com modelo **100% gratuito** na sua operação base.

### Pilares Fundamentais:
1. **Turmas Coletivas OU Aulas Particulares (Individuais / 1 a 1 / VIP)**:
   - O sistema **NÃO** é restrito a turmas em grupo. Ele suporta nativamente professores que dão aulas particulares individuais (ex.: personal fight, studio VIP de pilates, aulas de instrumentos/canto, idiomas particulares) com horários de 1 vaga ou turmas completas.
2. **Para quem ensina, em qualquer área** (14/10/2026: de 6 para 10 áreas + "Outra área"):
   - **Lutas** (jiu-jitsu, judô, muay thai)
   - **Pilates e yoga** (solo, aparelho, meditação)
   - **Funcional e crossfit** (funcional, HIIT, calistenia)
   - **Dança** (balé, salão, ritmos)
   - **Música** (violão, piano, canto)
   - **Idiomas e reforço** (inglês, reforço, cursinho)
   - **Natação e esportes** (natação, futebol, tênis)
   - **Gastronomia** (confeitaria, pães, culinária)
   - **Artes e artesanato** (cerâmica, pintura, costura)
   - **Beleza e cursos livres** (maquiagem, unhas, oratória)
   - **Outra área** (teatro, xadrez, fotografia, autoescola...), com nome livre e a escolha de como os alunos avançam.
   - Rótulos usam "e", nunca "&".
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
- **Pill superior**: *"Plano grátis • Sem cartão de crédito"*. Trocado em 14/10/2026: "grátis para sempre" dava a impressão de que tudo é grátis, e o plano Pro (cobrança online, WhatsApp automático) é pago. A página não promete "para sempre" em nenhum lugar; o FAQ explica o que o grátis cobre e o que fica no Pro.
- **Título** (11/10/2026, opção escolhida entre 4): *"Chega de caderno e planilha. Gestão simples para"* + digitação com o tipo de negócio, sempre fechando a frase: *"academias de luta."*, *"estúdios de pilates e yoga."*, *"escolas de música."*, *"escolas de idiomas."*, *"escolas de dança."*, *"escolas de confeitaria."*, *"cursos livres."* (14/10/2026: saiu "boxes e funcional." para mostrar o público mais amplo).
- **Sem subtítulo**: os botões vêm logo após o título.
- **Badges de confiança**: *"Em grupo ou aulas particulares"*, *"Sem limite de alunos ou horários"*, *"Chamada direta no celular"*.
- **Metadados (título e descrição da página)**: sem "teste de 14 dias"; reforçam "plano grátis, sem cartão de crédito". A descrição fala em "quem dá aula em grupo ou particular" e cita lutas, pilates, dança, música, idiomas, confeitaria, artesanato e cursos livres.

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

### 3.3. Áreas (`landing-segments.tsx`)
- 14/10/2026: **11 cards** (10 áreas + "Outra área"), só ícone, nome e uma linha de exemplos. Saíram a tag e a frase de cada card: com 10 áreas, viravam ruído.
- Nome, exemplos e ícone vêm da mesma fonte do setup (`business-segment-presets.ts` e `business-segment-icons.ts`, em `lib`), então LP e setup nunca divergem.
- Último card, tracejado e em 2 colunas: **"Sua área não está aqui?"** + *"Também serve: teatro, xadrez, autoescola"* + link *"Criar conta gratuita →"*. Com 2 colunas, a grade fecha sem buraco em 2, 3 ou 4 colunas.
- Título: *"Para quem ensina, em qualquer área"*. Overline e subtítulo mantidos (*"Turmas coletivas ou aulas particulares (1 a 1) no mesmo sistema."*).
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
- Stepper de 3 etapas com feedback de progresso: `1 Espaço → 2 Área → 3 Modalidades` ("Segmento" virou "Área" em 14/10/2026).
- Permite navegação direta clicando nos passos já concluídos.
- Sem badges repetitivos de passo embaixo do título.

### 4.2. Passo 1 — Identificação do Espaço
- Título: **Como se chama o seu espaço?**
- Subtítulo: *É o nome que você e seus alunos vão ver.*
- Campo: **`Nome*`**, placeholder *"Nome da escola, estúdio ou o seu"*. Dica abaixo, com ícone de lâmpada: *"Dá aula sozinho? Pode usar o seu nome."* (professor autônomo não tem "escola" e travava aqui).
- Prévia ao vivo: avatar com as iniciais + *"Assim aparece no topo: {nome}"* (sem nome: "Seu espaço").
- **Unidade ou filial** fica escondida atrás do link *"+ Tenho mais de um endereço"*: a maioria tem um endereço só. Clicar mostra o campo opcional (grava no nome da unidade, como antes).
- Foco automático no nome só com teclado físico; no celular (`pointer: coarse`) o teclado não abre sozinho.
- Botão: **`Continuar →`**.

### 4.3. Passo 2 — Área
- Título: **O que você ensina?**
- Subtítulo: *Ajustamos turmas, evolução e textos para a sua área.*
- Nenhuma área vem marcada: `Continuar` só libera depois da escolha.
- Grade compacta de 10 cards (2 colunas no celular, 3 a partir de `sm`): ícone, nome e uma linha de exemplos. Saíram o selo e a descrição dos cards antigos.
- **"Outra área"**: card tracejado em 2 colunas, *"Escolha se não achou a sua"*. No celular ocupa a largura toda; a partir de `sm` fecha a última linha (10 áreas em 3 colunas deixariam um card sozinho).
- **Confirmação ao escolher** (faixa verde, `role="status"`): *"Seus alunos avançam por {faixas e graus | níveis | módulos | fases}. Dá para trocar depois."*; área sem trilha: *"Sem etapas de evolução por enquanto. Dá para ligar depois."* Texto vem de `segmentProgressionSummary(preset)`.
- **Outra área** abre: `O que você ensina?*` (placeholder *"Nome da sua área ou atividade"*), chips que preenchem o campo (*Teatro, Xadrez, Fotografia, Autoescola*) e **"Como seus alunos avançam?"** com 4 opções: *Faixas, Níveis, Módulos, Não avançam* (padrão *Não avançam*), com a dica *"Na dúvida, escolha “Não avançam”. Dá para mudar depois."*. `Continuar` só libera com o nome. Grava `customSegmentName` e `customSegmentProgression`.

#### Por que orientação embutida e não tour (14/10/2026)
- O setup tem 3 telas curtas; um tour (balões apontando campos) cobriria justamente o que a pessoa precisa ler e teria de ser fechado antes de usar.
- A dúvida aparece no momento da decisão ("uso meu nome?", "minha área não está aqui", "o que muda?"). Por isso cada resposta fica no próprio passo: dica sob o campo, prévia ao vivo, confirmação ao escolher a área e a opção "Não avançam" como saída segura.
- Tudo o que o setup grava pode ser trocado em Configurações; as frases dizem isso ("Dá para trocar depois") para tirar o peso da escolha.

### 4.4. Passo 3 — Modalidades Oferecidas
- Título: **Quais aulas você oferece?**
- Subtítulo: *Selecione as modalidades para criar suas primeiras turmas.*
- **Pílulas Interativas Unificadas**:
  - Uma única lista de pílulas. Clicar alterna entre selecionado (`✓`, fundo primário) e desmarcado (`+`).
  - Contador no cabeçalho: `2 selecionadas`.
  - **Eliminada a caixa secundária redundante** de "Modalidades selecionadas".
- **Campo de Adição**:
  - Placeholder único *"Informe o nome da aula"* (14/10/2026: os placeholders "Ex.: ..." por área saíram, regra do doc 07, seção 2.3). As sugestões da área já aparecem como pílulas.
  - Título do bloco: *"Aulas de {área}"*; na Outra área, usa o nome digitado.
  - Ao adicionar, a nova aula entra direto como uma pílula ativa com ícone de exclusão `x`.
- **Finalização**: Salva dados da organização (incluindo `classSegment`) e unidade, pré-cria as modalidades marcadas com a trilha padrão da área e redireciona para `/dashboard`.
- **Revisão das modalidades do setup** (11/10/2026): quando o setup cria modalidades, grava `settings.modalitiesReviewed = false`. O passo "Cadastrar modalidades" do passo a passo fica em **"Falta revisar"** (selo âmbar, botão "Revisar"): não conta como concluído, mas já libera os passos que dependem dele. A tela de Modalidades mostra um aviso explicando a trilha de evolução, com "Está tudo certo". Clicar no aviso ou salvar uma modalidade (nome ou trilha) fecha a revisão. Sem modalidades no setup, nada muda. O setup não cria modalidade que não foi marcada (nem o nome da "Outra área", nem "Turma Geral").

### 4.5. O que a área (segmento) muda no sistema

Decisão de 11/10/2026: a área é um **pacote de padrões e vocabulário**. Não liga nem desliga recursos; todo recurso vale para qualquer área. Fonte única: `apps/web/src/lib/business-segment-presets.ts`. Tenants sem área salva seguem como Lutas.

| Área | Trilha padrão | Nova turma | Palavra | Avanço |
|---|---|---|---|---|
| Lutas | Pelo nome da modalidade (BJJ, Judô, Muay Thai...) | 60 min, 20 vagas | Faixa | Graduar |
| Pilates e yoga | Sem trilha (liga depois) | 50 min, 6 vagas | Nível | Avançar |
| Funcional e crossfit | Sem trilha | 60 min, 15 vagas | Nível | Avançar |
| Dança | Níveis gerais | 60 min, 15 vagas | Nível | Avançar |
| Música | Módulos (Básico → Avançado) | 60 min, 6 vagas | Módulo | Avançar |
| Idiomas e reforço | Níveis gerais (sugere também A1 a C2 e Módulos) | 60 min, 10 vagas | Nível | Avançar |
| Natação e esportes | Fases (Adaptação → Treinamento) | 45 min, 8 vagas | Fase | Avançar |
| Gastronomia | Módulos | 120 min, 12 vagas | Módulo | Avançar |
| Artes e artesanato | Módulos | 120 min, 10 vagas | Módulo | Avançar |
| Beleza e cursos livres | Módulos | 120 min, 12 vagas | Módulo | Avançar |
| Outra área: Faixas | Judô (faixas) | 60 min, 10 vagas | Faixa | Graduar |
| Outra área: Níveis | Níveis gerais | 60 min, 10 vagas | Nível | Avançar |
| Outra área: Módulos | Módulos | 60 min, 10 vagas | Módulo | Avançar |
| Outra área: Não avançam | Sem trilha | 60 min, 10 vagas | Nível | Avançar |

- **Divisão de "Música & Idiomas" (14/10/2026, migração v32)**: quem tinha `music_languages` vira `languages` se alguma modalidade tem nome de idioma ou reforço (inglês, espanhol, francês, alemão, italiano, japonês, libras, reforço, português, redação); senão vira `music`. O rótulo antigo "Música & Idiomas" acompanha.
- **Outra área**: o preset efetivo sai de `getSegmentPreset(classSegment, customSegmentProgression)`; os hooks `useBusinessSegment`/`useSegmentVocabulary` já usam a escolha.

Onde aparece:
- **Setup**: trilha das modalidades criadas no passo 3.
- **Modalidade**: título da trilha e trilha sugerida ao ligar o switch.
- **Nova turma**: vagas, duração do horário e atalho de duração da área.
- **Telas de aluno, turma, aula e relatórios**: "Faixa" ou "Nível/Módulo/Fase", "Graduar" ou "Avançar". "Aluno" não muda.
- **Comunicação**: Lutas fala em treino e tatame; as demais, em aulas. Ao trocar de área, só os modelos ainda no texto padrão mudam; os editados ficam como estão.
- **Configurações**: campo "Área do espaço" em Identificação do Negócio. Na "Outra área", aparecem "O que você ensina?" e "Como seus alunos avançam?" (as mesmas 4 opções do setup). Trocar muda só padrões e palavras daí em diante; modalidades, trilhas e turmas existentes não mudam.

#### Estilo da trilha (11/10/2026)

O visual vem da **trilha** (`ModalityProgressionTrack.style`), não da área, porque uma academia de luta pode ter Yoga e uma escola de dança pode ter Capoeira:
- **`belt` (faixa)**: barra de faixa/corda, até 2 cores (faixa e ponta) e graus. Modelos de luta.
- **`levels` (nível)**: etiqueta simples, **uma cor opcional** (padrão: sem cor) e **sem subníveis**. Demais modelos.
- Trilhas antigas sem `style` são resolvidas por `resolveTrackStyle` (modelo; se personalizada, nomes como "Faixa", "Kruang", "Corda") e gravam o estilo no próximo salvar.
- O editor tem o campo **Modelo**, com os modelos da área primeiro ("Sugeridos") e o resto em "Outros modelos". Trocar um modelo personalizado pede confirmação.
- Modelos: Jiu-Jitsu, Judô, Muay Thai, Karatê, Taekwondo, Capoeira, Kickboxing (faixa); Níveis (Iniciante, Intermediário, Avançado), Módulos, Idiomas A1 a C2, Fases da natação, Categorias (Iniciante, Scaled, RX) e Do zero (nível).
- Textos do editor seguem o estilo: "Quando troca de faixa ou grau" ou "Quando avança de nível/módulo/fase", "Adicionar fase" etc.
- Sugestões rápidas de nome de modalidade seguem a área (Lutas mantém a lista de lutas; "Outra área" não mostra sugestões).

#### Faixa etária por nível (12/10/2026)

- Cada nível pode ter **idade de / até** (`ProgressionLevelStep.minAge` / `maxAge`, opcionais). No editor da trilha, o interruptor "Idade por faixa/nível" mostra os campos; desligar apaga as idades.
- Modelo Jiu-Jitsu com as idades da IBJJF/CBJJ: Branca (todas), Cinza 4–15, Amarela 7–15, Laranja 10–15, Verde 13–15, Azul 16+, Roxa 16+, Marrom 18+, Preta 19+. Trilhas `bjj_adult` já salvas ganharam essas idades (migração v27).
- Na ficha do aluno, "Nova faixa" e "Faixa atual" mostram só os níveis da idade **na data escolhida** (data de nascimento do cadastro). "Mostrar todas" libera as exceções, com o aviso "fora da idade". Sem data de nascimento, mostra tudo com a dica para cadastrá-la.
- O próximo nível sugerido e o "Apto" pulam os níveis de outra idade (16 anos na Verde → Azul).
- Quem passou da idade do nível atual aparece com o selo **"Trocar faixa"** na lista de chamada e na turma, no aviso da ficha e no Dashboard ("N alunos precisam trocar de faixa pela idade").

Fora de escopo (recurso novo, não configuração): capacidade por aparelho, raia, turmas por faixa etária e o card "Prontos para graduar/avançar" no dashboard.

#### Pontos fortes e metas: sugestões aprendidas (12/10/2026)

- **Sem listas fixas.** As sugestões de "Pontos fortes" e de metas (antes "Pontos a Melhorar") nos Registros de aula não dependem da área nem do nome da modalidade (a lista única de Jiu-Jitsu foi removida). Listas por área ou por tipo de modalidade foram avaliadas e descartadas: o nome da modalidade é texto livre e não identifica o tipo com segurança.
- **Só a mesma modalidade:** os termos já usados **nesta modalidade** com os alunos, os mais usados antes. Termos de outra modalidade não entram (Jiu-Jitsu não sugere no Muay Thai), nem como complemento. Sem nenhum termo, a linha de sugestões não aparece (só o campo).
- **Do espaço inteiro (tenant), não do usuário:** conta o que **qualquer** usuário do espaço preencheu em qualquer aluno daquela modalidade, e vale para todos os usuários do espaço. Nunca mistura espaços diferentes. A sugestão mostra só o termo, nunca de qual aluno veio, então o professor que vê só os próprios alunos também aproveita o vocabulário da equipe. No mock, os dados do espaço ficam no navegador (como todo o resto); com o backend, a consulta agrupa por termo filtrando `organizationId` e `modalityId`.
- **Até 6 sugestões**, sem as que o aluno já tem. Digitando, as sugestões passam a ser as que contêm o texto.
- Maiúsculas e acentos não diferenciam: "guarda fechada" e "Guarda Fechada" são o mesmo termo, exibido e salvo com a grafia mais usada. Cada aluno conta uma vez por termo.
- Código: `clientsService.getProgressionTermSuggestions(modalityId)` → `ProgressionTermSuggestions` (`strengths`, `goals`); telas em `ProgressionTermsEditor` (pontos fortes) e "Nova meta". Modais da evolução: doc 11, seção "Evolução do aluno".

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
