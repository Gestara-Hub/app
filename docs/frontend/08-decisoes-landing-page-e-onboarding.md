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

### 3.0. Ordem e navegação (17/10/2026)
- Ordem: Hero → A parte chata → O sistema → Áreas → Recursos → Dúvidas → Cadastro → Rodapé (Planos fora por enquanto, seção 3.5). O cadastro passou para o fim: quem lê as dúvidas encontra o formulário logo abaixo, sem rolar de volta.
- Menu (topo e rodapé, mesma lista `LANDING_NAV_LINKS` em `landing-header.tsx`): *Parte chata* (`#parte-chata`), *O sistema* (`#o-sistema`), *Áreas* (`#areas`), *Recursos* (`#recursos`), *Dúvidas* (`#faq`). Os links levam `/` na frente para funcionar também em Termos e Privacidade. "Modalidades" saiu do menu: no sistema, modalidade é outra coisa.
- O menu completo aparece a partir de `lg` (1024px); abaixo disso, menu do celular (com `aria-expanded` e rótulo "Abrir/Fechar menu"). Em 768px os 5 links não cabiam.
- **Topo no celular** (17/10/2026): botão **"Criar conta"** sempre à vista ao lado do menu (antes ficava escondido dentro do menu); o botão de tema passou para dentro do menu ("Tema escuro" / "Tema claro"), junto do "Entrar".
- Um só texto de botão para criar conta em toda a página: **"Criar conta grátis"**. Entrar é sempre **"Entrar"** (o rodapé dizia "Acessar Plataforma").
- Títulos com só a primeira letra maiúscula ("Perguntas frequentes", "Financeiro") e `text-balance` para não sobrar uma palavra sozinha na última linha.

### 3.1. Hero (`landing-hero.tsx`)
- **Pill superior**: *"Plano grátis • Sem cartão de crédito"*. Trocado em 14/10/2026: "grátis para sempre" dava a impressão de que tudo é grátis, e o plano Pro (cobrança online, WhatsApp automático) é pago. A página não promete "para sempre" em nenhum lugar; o FAQ explica o que o grátis cobre. Desde 17/10/2026 a página não cita o Pro (seção 3.5).
- **Título** (11/10/2026, opção escolhida entre 4): *"Chega de caderno e planilha. Gestão simples para"* + digitação, sempre fechando a frase. Palavras (17/10/2026): *"academias de luta."*, *"estúdios de pilates."*, *"aulas particulares."*, *"escolas de música."*, *"escolas de idiomas."*, *"escolas de dança."*, *"cursos de confeitaria."*, *"cursos livres."*. Entrou "aulas particulares." (o professor autônomo não aparecia); "estúdios de pilates e yoga." e "escolas de confeitaria." encurtaram para caber em uma linha no celular.
- **Altura fixa** (17/10/2026): `TypewriterText` empilha todas as palavras invisíveis na mesma célula da grade e reserva a altura da mais longa. Antes, no celular, a palavra que quebrava linha empurrava os botões a cada troca.
- **Acessibilidade**: o leitor de tela ouve *"Gestão simples para quem ensina."* (`sr-only`); a digitação fica com `aria-hidden`. Com movimento reduzido, mostra a primeira palavra parada e sem cursor.
- **Sem subtítulo**: os botões vêm logo após o título. Botões: *"Criar conta grátis"* (`#cadastro`) e *"Ver o sistema"* (`#o-sistema`, antes "Ver recursos").
- **Badges de confiança**: *"Em grupo ou aulas particulares"*, *"Sem limite de alunos ou horários"*, *"Chamada direta no celular"*.
- **Metadados**: título, descrição e frase vêm de `config/site.ts`. Sem "teste de 14 dias"; reforçam "plano grátis, sem cartão de crédito".

### 3.2. A parte chata (`landing-chores.tsx`, 17/10/2026)
- Substituiu o "Antes e depois" (3 linhas de dor ➔ solução). As duas seções contariam a mesma história, então ficou uma só, mais completa.
- Overline: `MENOS DOR DE CABEÇA, MAIS TEMPO PARA ENSINAR`. Título: **A parte chata, a gente resolve**, sem subtítulo.
- **6 cards** (1 coluna no celular, 2 em `sm`, 3 em `lg`): ícone, a tarefa chata em negrito e a solução em uma linha.
  1. **Cobrar aluno atrasado**: *Lembrete pronto no WhatsApp, você só envia.*
  2. **Saber quem já pagou**: *Mensalidades lançadas sozinhas. Quem atrasou aparece em vermelho.*
  3. **Calcular o pagamento**: *O sistema faz a conta pela regra de cada professor.*
  4. **Perceber aluno sumindo**: *O painel avisa quem faltou várias aulas seguidas.*
  5. **Controlar pacotes de aulas**: *A chamada desconta cada aula do pacote.*
  6. **Saber quem sobe de nível**: *O sistema conta as presenças e avisa.*
- **Textos revistos (17/10/2026)** por clareza: "Lembrar quem pagou" (ninguém lembra, quer saber) e "atrasadas em destaque" (vago); "repasse" (jargão); "saldo do pacote" (só faz sentido para quem já vende pacote) e "desconta a aula sozinha" (ambíguo); "graduar" (palavra de luta, a página fala com todas as áreas). Títulos curtos o bastante para caber em uma linha nas 3 colunas.
- Todos são do plano grátis e existem no produto. Outras tarefas que o sistema resolve e podem trocar de lugar com estas: conferir Pix no extrato (Pro, baixa automática), bolsa e desconto, contas fixas (despesa recorrente), troca de faixa pela idade, lista de espera, aniversariantes, certificado (Pro). **Fora até existir**: reposição de aula, contrato assinado e nota fiscal.
- Âncora: `#parte-chata`; no menu, *"Parte chata"*.
- **O que foi removido antes**: os blocos de "Passo a passo em 3 etapas" e a caixa de métricas genéricas (`+15h`, `0 listas`, `R$ 0`), por poluir a página e duplicar o que os 4 pilares já explicam.

### 3.3. Áreas (`landing-segments.tsx`)
- 14/10/2026: **11 cards** (10 áreas + "Outra área"), só ícone, nome e uma linha de exemplos. Saíram a tag e a frase de cada card: com 10 áreas, viravam ruído.
- Nome, exemplos e ícone vêm da mesma fonte do setup (`business-segment-presets.ts` e `business-segment-icons.ts`, em `lib`), então LP e setup nunca divergem.
- Último card, tracejado e em 2 colunas: **"Sua área não está aqui?"** + *"Também serve: teatro, xadrez, autoescola"* + link *"Criar conta grátis →"*. Com 2 colunas, a grade fecha sem buraco em 2, 3 ou 4 colunas.
- Título: *"Para quem ensina, em qualquer área"*. Overline e subtítulo mantidos (*"Turmas coletivas ou aulas particulares (1 a 1) no mesmo sistema."*).
- Âncora: `#areas` (antes `#modalidades`).

### 3.4. Recursos e 4 pilares (`landing-features.tsx`)
- Overline *"Recursos"*, título *"Os 4 pilares da gestão do seu espaço"*, sem subtítulo. Cada card: ícone colorido, título, **uma linha** de descrição e **chips neutros** (borda fina, texto discreto, sem ícone) logo abaixo, sem divisor.
- **Chips em vez de checks** (17/10/2026): os 12 checks verdes poluíam os cards, a lista era alinhada ao fundo (o divisor ficava em alturas diferentes) e o primeiro ponto do Financeiro quebrava em 2 linhas. Os chips quebram linha sem cortar palavra. Opções avaliadas: chips, linha com separadores (" · ") e lista simples com marcador; ficou chips.
- **Sem repetir**: os chips não repetem a descrição nem a seção "A parte chata" (saíram repasse calculado e aviso de quem pode avançar).
  1. **Financeiro**: *"Entradas, saídas e o resultado do mês."* Chips: Mensalidade, Curso fechado, Pacote de aulas, Despesas fixas.
  2. **Turmas e aulas particulares**: *"Grade da semana, em grupo ou 1 a 1."* Chips: Chamada no celular, Limite de vagas, Aula experimental, Lista de espera.
  3. **Evolução dos alunos**: *"Faixas, níveis, módulos ou fases, do seu jeito."* Chips: Trilha por modalidade, Graduação, Registro de aula, Metas.
  4. **Comunicação**: *"Mensagens prontas, enviadas do seu número."* Chips: Cobrança, Lembrete, Aniversário. (Antes "Comunicação e vagas": experimental e lista de espera foram para Turmas.)
- **A página só promete o que o produto faz** (17/10/2026): saiu "reposição de aula" (pilar 4 e dois itens do FAQ): o modelo de turmas não tem reposição, só aluno avulso, experimental e lista de espera. Saiu também "sem a bagunça do WhatsApp", que contradizia o produto (o lembrete sai pelo WhatsApp do próprio espaço).
- Âncora: `#recursos`.

### 3.5. Planos (`landing-plans.tsx`, 17/10/2026): fora da página por enquanto
- **Decisão do dono (17/10/2026):** a seção saiu da página, junto com o item "Planos" do menu e toda menção ao Pro (FAQ, Termos, Privacidade). O preço do Pro e a forma de cobrar o envio do WhatsApp e o pagamento online ainda não foram definidos: o custo das mensagens provavelmente fica com o espaço, e o pagamento online pode valer também no grátis, com taxa por cobrança automática (doc 13, "Em aberto"). Os dois fluxos ainda precisam ser validados.
- O componente fica pronto em `landing-plans.tsx`, fora da `LandingView`. **Quando a cobrança for definida**: revisar os itens dos dois cards (o pagamento online pode sair do Pro), pôr o preço no topo do card do Pro e devolver a seção e o item do menu.
- Como estava quando saiu:
- Overline *"Planos"*, título *"Grátis para o dia a dia"*, subtítulo *"Pague só se quiser automatizar."*.
- Dois cards, conteúdo do doc 13 (2.1 e 2.2):
  - **Grátis**, *R$ 0 por mês*: alunos e turmas sem limite; chamada no celular e evolução; mensalidade, curso e pacote de aulas; financeiro e repasse dos professores; lembrete no WhatsApp, enviado por você. Botão *"Criar conta grátis"*.
  - **Pro**, selo *"Opcional"*: **Tudo do Grátis** (em negrito, primeiro item: o Pro soma, não substitui); pagamento online com baixa automática; lembretes automáticos no WhatsApp; relatórios avançados; certificado de conclusão de curso. Na base, faixa tracejada *"Ative quando precisar, dentro do sistema."*, da altura do botão do Grátis.
- **Equilíbrio**: lado a lado (a partir de `md`), o topo dos dois cards tem a mesma altura mínima, então as listas começam na mesma linha; os cards fecham na mesma base (botão e faixa). Os dois sobem e ganham sombra no hover, como nas outras seções.
- **Sem preço do Pro**: ainda não foi definido; quando for, entra no espaço do topo do card. Scale (multiunidade) fica fora da página por enquanto.

### 3.6. Dúvidas frequentes (`landing-faq.tsx`)
- Título *"Perguntas frequentes"*, sem subtítulo. Respostas de 1 ou 2 frases, sem exclamação (17/10/2026).
- Perguntas: gratuidade e limites (*"Sim. O dia a dia é grátis, sem limite de alunos ou turmas: grade, chamada, evolução, mensalidades e financeiro básico."*, sem citar o Pro); aulas particulares ou turmas; música e idiomas; chamada no celular (aluno avulso ou experimental entra na hora); evolução dos alunos; curso com valor fechado ou pacote de aulas; repasse dos professores; cartão de crédito.
- **Professores e alunos** (17/10/2026): *"Meus professores podem usar?"* ➔ *"Sim. Cada professor entra pelo mesmo link, com o próprio acesso: vê as turmas e faz a chamada, sem ver o financeiro."* (perfil Profissional: `classes:view`, `attendance:mark`, `grades:manage`). *"Meus alunos precisam baixar algum app?"* ➔ *"Não. Os avisos chegam pelo seu WhatsApp, sem instalar nada."* A resposta não promete "vê só as turmas dele": esse recorte só existe na Agenda (modelo de agendamentos). **Direção do dono**: aluno e professor vão entrar pelo mesmo link, cada um com um layout próprio (o atual é do dono); quando existir, as duas respostas citam isso.
- **Repasse** (17/10/2026): as 4 formas reais da regra do professor: valor fixo no mês, por aula dada, por aluno ativo ou percentual do que os alunos pagaram (o texto antigo citava "percentual por aluno", que não existe).

### 3.7. Cadastro rápido (`landing-signup-section.tsx`)
- Formulário só com **Nome** e **E-mail**. Cria a conta, define o tenant ativo e redireciona para `/setup`. Âncora: `#cadastro`, último bloco antes do rodapé.
- **Layout (17/10/2026)**: **card estreito e centralizado** (`max-w-md`), só o essencial. Acima do card, o título *"Comece a organizar suas aulas hoje"* e o subtítulo *"Grátis, sem cartão e sem limite de alunos."*; no card, os campos empilhados, o botão *"Criar conta grátis"* de largura toda (*"Criando sua conta…"* enquanto envia) e o aceite dos Termos e da Privacidade; abaixo do card, *"Já tem conta? Entrar"*.
  - **Como chegou aqui:** o primeiro redesenho (painel na cor primária à esquerda e formulário à direita) ficou agressivo, com o bloco preto no claro e o branco no escuro. Foram comparadas 5 versões numa página de prévia temporária (atual, card central, duas colunas sem bloco de cor, faixa com os campos em linha e painel suave) e o dono escolheu o **card central**. A prévia e as outras versões foram removidas.
  - Saíram também o selo *"Crie sua conta em 30 segundos"* (com estrelinhas, soava como truque), o brilho cinza no topo e os ícones dentro dos campos.
  - Formulário em `components/signup-form.tsx` (`SignupForm` + `SignupLoginLink`); a seção só monta o layout.
- **Validação**: React Hook Form + Zod (`features/landing/signup-schema.ts`) com o `InputText` compartilhado: erro em cada campo (*"Informe seu nome."*, *"Informe seu e-mail."*, *"Informe um e-mail válido."*, mesma regra do cadastro de usuários), `aria-invalid` no campo. O botão fica **sempre ativo** (antes ficava cinza e desabilitado até preencher, parecendo quebrado); a validação acontece ao enviar.
- Labels **`Nome*`** e **`E-mail*`** com o asterisco colado (padrão do `FieldShell`); placeholders *"Informe seu nome"* / *"Informe seu e-mail"*; preenchimento automático do navegador (`autoComplete` name/email, nova prop do `InputText`).
- Campos em `16px` no celular (o `Input` já é `text-base md:text-sm`).

### 3.8. Termos de uso e Política de privacidade (17/10/2026)
- Rotas públicas `/terms` e `/privacy` (`app/(marketing)`), com o mesmo topo e rodapé da landing (`LandingLegalPage`); textos em `legal-documents.tsx`.
- **Primeira versão**, curta e fiel ao produto: dados da conta, do espaço e dos alunos; o espaço é o controlador dos dados dos alunos e o GestaraHub, o operador (LGPD); um cookie de sessão e preferências no navegador, sem cookies de publicidade. **Revisar com apoio jurídico antes de abrir o cadastro de verdade.**
- **E-mail de contato pendente**: `SUPPORT_EMAIL` em `config/site.ts` está vazio. Preenchido, aparece a seção "Contato" nas duas páginas e o link "Contato" no rodapé.
- Rodapé: links do menu + *Termos de uso*, *Privacidade*, *Entrar*.
- A Privacidade cita a análise de uso (PostHog, seção 3.12): páginas, cliques e gravações, sem o que se digita e com os textos da área logada ocultos.

### 3.9. Prévia do link (17/10/2026)
- `app/(marketing)/opengraph-image.tsx` gera a imagem de 1200 x 630 (logo, *"Gestão simples para quem ensina"* e o selo do plano grátis) que aparece ao compartilhar o link no WhatsApp e nas redes.
- `metadataBase` vem de `NEXT_PUBLIC_SITE_URL` (sem ela, `http://localhost:3000`): **definir em produção**, senão a prévia aponta para o localhost.
- O grupo de rotas gera a imagem em `/opengraph-image-<hash>`; o `proxy.ts` libera esse caminho sem sessão, junto com `/terms` e `/privacy`.
- A descrição padrão do site (`app/layout.tsx`) deixou de citar "agenda, clientes, equipe e serviços" (modelo antigo).

### 3.10. Fluidez no scroll e animações
- Componente nativo [`ScrollReveal`](../../apps/web/src/features/landing/components/scroll-reveal.tsx):
  - Baseado em `IntersectionObserver` do browser + aceleração de hardware pela GPU (`translate3d` e `opacity`).
  - Suporte a `prefers-reduced-motion`.
  - **Bidirecional contínuo (`once: false`)**: reanima suavemente em cascata (*stagger*) tanto na descida quanto na subida da página, com reset instantâneo ao sair do viewport.
- **Barra de progresso**: linha de 2px na cor primária na base do `LandingHeader` fixo que acompanha a porcentagem da página (0% a 100%).
- Seções com `scroll-mt-16`: o topo fixo não cobre o título ao clicar no menu.

### 3.11. O sistema (`landing-showcase.tsx`, 17/10/2026)
- Overline *"O sistema"*, título *"Veja o sistema por dentro"*. Logo depois de "A parte chata": a página mostra a dor e em seguida o sistema resolvendo.
- Três abas (botões com `role="tab"`): **Chamada** (*"Presença em um toque, direto no celular."*, em moldura de celular), **Cobranças** (*"Quem pagou e quem atrasou, mês a mês."*) e **Ficha do aluno** (*"Faixa, frequência e pagamentos num lugar só."*), as duas em moldura de navegador.
- **Telas reais, não mockups** (a regra da seção 2 proíbe mockup falso): capturas do próprio app com dados de demonstração, em `src/assets/landing/` (`*-light.png` e `*-dark.png`). A página mostra a do tema atual (`dark:hidden` / `hidden dark:block`).
- **Recapturar** quando as telas mudarem (o app no ar em `:3000`), a partir de `apps/web`: `npx playwright test --config=scripts/landing-screenshots/playwright.config.ts`. O roteiro cria o "Espaço Movimento" pelo assistente (Lutas, com a trilha de faixas), grava alunos, turmas (Jiu-Jitsu, Muay Thai, Yoga), presenças e mensalidades em volta da data de hoje e captura as 3 telas nos 2 temas. Usa o relógio real: com o relógio congelado do e2e, servidor e navegador discordam da data, a hidratação falha e o menu lateral perde a cor.
- As datas aparecem nas imagens (mês da competência, "Hoje"): recapturar de tempos em tempos.

### 3.12. Análise de uso (17/10/2026)
- PostHog na landing e no sistema (páginas, cliques, mapa de calor, gravação e funis). Detalhes, privacidade e variáveis: [../technical/09-analise-de-uso.md](../technical/09-analise-de-uso.md). Sem `NEXT_PUBLIC_POSTHOG_KEY`, nada é enviado.
- **Aviso de cookies** (LGPD): só depois de "Aceitar" o PostHog liga; "Recusar" tem o mesmo peso; a escolha pode ser revista na Política de privacidade. Detalhes no doc técnico 09.

### 3.13. Próximo passo: páginas por área
- Ideia aprovada pelo dono (17/10/2026), a refinar depois dos itens acima: páginas como `/lutas` e `/pilates`, cada uma com a língua da área (faixas e graus, níveis, módulos), reaproveitando `business-segment-presets.ts`, para busca e anúncios. Os cards da seção Áreas passariam a levar para elas.

---

## 4. Decisões do Fluxo de Setup Inicial (`/setup` & `BusinessSetupWizard`)

Localização: `apps/web/src/features/onboarding/components/business-setup-wizard.tsx` e `apps/web/src/app/(setup)/setup/page.tsx`.

### 4.1. Formato: uma pergunta por tela (17/10/2026)
- Escolhido entre 3 opções comparadas numa página de prévia temporária (refino do formato antigo, painel lateral com resumo ao vivo e uma pergunta por tela); a prévia foi removida.
- **Sem cards e sem stepper**: barra de progresso fina no topo da página (`role="progressbar"`), logo, e uma coluna estreita (`max-w-xl`) igual nos 3 passos (antes a largura mudava a cada passo e a tela "pulava"). Acima da pergunta: **"Voltar"** (do passo 2 em diante) e **"{n} de 3"**.
- Pergunta grande (`text-3xl`/`4xl`) alinhada à esquerda, subtítulo de uma linha e o conteúdo logo abaixo. No rodapé: *"Tudo pode ser mudado depois em Configurações."*
- **Botões no padrão do projeto** (17/10/2026): "Continuar" e "Concluir" iguais ao "Continuar" dos primeiros passos do Dashboard (`size="sm"`, `text-xs`, `font-semibold`, seta de 14px).
- **Botões sempre ativos**: antes o "Continuar" ficava cinza e desabilitado (parecia quebrado). Agora avançar sem o obrigatório mostra o erro **logo abaixo do campo**, no lugar da dica (padrão do `FieldShell`; `role="alert"`, `aria-invalid` e `aria-describedby` no campo): *"Informe o nome do espaço."* / *"Informe o que você ensina."*
- Saíram o stepper de círculos, os brilhos de fundo e o rodapé "Configuração inicial • GestaraHub Sistema Gratuito".

### 4.2. Passo 1 — Identificação do Espaço
- Título: **Como se chama o seu espaço?**
- Subtítulo: *É o nome que você e seus alunos vão ver.*
- Campo **`Nome*`** igual aos outros campos do assistente (`h-10` e a fonte padrão do `Input`, como "Informe o nome da aula" no passo 3; 17/10/2026, antes `h-14` destoava), assim como a unidade e o "O que você ensina?" da Outra área:, placeholder *"Nome da escola, estúdio ou o seu"*. Dica abaixo, com ícone de lâmpada: *"Dá aula sozinho? Pode usar o seu nome."* (professor autônomo não tem "escola" e travava aqui).
- Prévia ao vivo, sem caixa: avatar com as iniciais + *"Assim aparece no topo: {nome}"* (sem nome: "Seu espaço").
- **Unidade ou filial** fica escondida atrás do link *"+ Tenho mais de um endereço"*: a maioria tem um endereço só. Clicar mostra o campo opcional (grava no nome da unidade, como antes).
- Foco automático no nome só com teclado físico; no celular (`pointer: coarse`) o teclado não abre sozinho.
- **`Continuar →`** + *"ou pressione Enter ↵"* (desktop). Enter no nome ou na unidade avança.

### 4.3. Passo 2 — Área
- Título: **O que você ensina?**
- Subtítulo: *Ajustamos turmas, evolução e textos para a sua área.*
- **Lista** (`radiogroup` "Área do espaço") com as 10 áreas e, por último, **"Outra área"**: **só ícone e nome** (17/10/2026: os exemplos de cada área saíram da lista, o dono pediu só os títulos; continuam nos cards da landing), seta à direita (a escolhida mostra ✓). Nenhuma vem marcada.
- **Escolher uma das 10 já avança** para o passo 3 (sem "Continuar"). Voltar mostra a escolha marcada; escolher a mesma de novo mantém as aulas marcadas, escolher outra troca as sugestões.
- A **confirmação** da área (*"Seus alunos avançam por {faixas e graus | níveis | módulos | fases}. Dá para trocar depois."*; sem trilha: *"Sem etapas de evolução por enquanto. Dá para ligar depois."*, de `segmentProgressionSummary`) passou para o topo do passo 3, junto de *"Aulas de {área}"* (`role="status"` só na frase).
- **Outra área** abre abaixo da lista (a página rola até os campos): `O que você ensina?*` (placeholder *"Nome da sua área ou atividade"*), chips que preenchem o campo (*Teatro, Xadrez, Fotografia, Autoescola*), **"Como seus alunos avançam?"** (*Faixas, Níveis, Módulos, Não avançam*; padrão *Não avançam*; dica *"Na dúvida, escolha “Não avançam”. Dá para mudar depois."*) e **"Como você cobra?"** (*Mensalidade, Curso com valor fechado, Pacote de aulas, Não cobro*; padrão *Mensalidade*; dica *"É só o padrão: cada turma pode cobrar diferente."*), ambos em grade 2 x 2. Aqui há **`Continuar`** (Enter no nome também avança). Grava `customSegmentName`, `customSegmentProgression` e `customSegmentBilling` (`CUSTOM_BILLING_OPTIONS` em `business-segment-presets.ts`).

#### Por que orientação embutida e não tour (14/10/2026)
- O setup tem 3 telas curtas; um tour (balões apontando campos) cobriria justamente o que a pessoa precisa ler e teria de ser fechado antes de usar.
- A dúvida aparece no momento da decisão ("uso meu nome?", "minha área não está aqui", "o que muda?"). Por isso cada resposta fica no próprio passo: dica sob o campo, prévia ao vivo, confirmação ao escolher a área e a opção "Não avançam" como saída segura.
- Tudo o que o setup grava pode ser trocado em Configurações; as frases dizem isso ("Dá para trocar depois") para tirar o peso da escolha.

### 4.4. Passo 3 — Aulas
- Título: **Quais aulas você oferece?**
- Subtítulo: *Marque as aulas que você dá. Dá para mudar depois.*
- No topo: *"Aulas de {área}"* · a confirmação de como os alunos avançam (ver 4.3). Na Outra área, usa o nome digitado.
- **Chips** (arredondados): clicar alterna entre marcado (`✓`, fundo primário) e desmarcado (`+`). As 2 primeiras sugestões da área já vêm marcadas. Contador abaixo: *"2 selecionadas"*; sem nenhuma: *"Nenhuma modalidade selecionada. Você poderá cadastrar turmas depois no painel."*
- **Adicionar**: *"Não encontrou sua aula? Adicione abaixo:"*, placeholder *"Informe o nome da aula"* (sem "Ex.:", regra do doc 07, seção 2.3). A nova aula entra marcada, com o `x` para remover.
- Botão **"Concluir"** (antes "Concluir e Começar"; *"Configurando..."* enquanto salva).
- **Finalização**: Salva dados da organização (incluindo `classSegment`) e unidade, pré-cria as modalidades marcadas com a trilha padrão da área e redireciona para `/dashboard`.
- **Revisão das modalidades do setup** (11/10/2026): quando o setup cria modalidades, grava `settings.modalitiesReviewed = false`. O passo "Cadastrar modalidades" do passo a passo fica em **"Falta revisar"** (selo âmbar, botão "Revisar"): não conta como concluído, mas já libera os passos que dependem dele. A tela de Modalidades mostra um aviso explicando a trilha de evolução, com "Está tudo certo". Clicar no aviso ou salvar uma modalidade (nome ou trilha) fecha a revisão. Sem modalidades no setup, nada muda. O setup não cria modalidade que não foi marcada (nem o nome da "Outra área", nem "Turma Geral"). **Onde confirmar (15/10/2026):** o aviso amarelo sozinho travava quem não percebia o botão (o aviso de primeiros passos do topo não tinha ação nessa tela). Agora, para o dono, o "Está tudo certo" fica no aviso de primeiros passos do topo, pulsando até o clique, com "Confira as modalidades e confirme."; o aviso amarelo fica só com a explicação e a linha "Quando estiver tudo certo, confirme em “Está tudo certo” no aviso acima.". Outros perfis (que não veem o aviso de primeiros passos) continuam com o botão no aviso amarelo.

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
- **Outra área**: o preset efetivo sai de `getSegmentPreset(classSegment, customSegmentProgression, customSegmentBilling)`; os hooks `useBusinessSegment`/`useSegmentVocabulary` já usam a escolha. A trilha e as palavras seguem a primeira; a forma de cobrança padrão (`defaultBillingMode`) segue a segunda (ausente = mensalidade). Os presets são pré-calculados (trilha x cobrança) para devolver sempre o mesmo objeto.

Onde aparece:
- **Setup**: trilha das modalidades criadas no passo 3.
- **Modalidade**: título da trilha e trilha sugerida ao ligar o switch.
- **Nova turma**: vagas, duração do horário e atalho de duração da área.
- **Telas de aluno, turma, aula e relatórios**: "Faixa" ou "Nível/Módulo/Fase", "Graduar" ou "Avançar", conforme a **trilha da modalidade** (ver "Palavras pela trilha da modalidade" abaixo). "Aluno" não muda.
- **Comunicação**: Lutas fala em treino e tatame; as demais, em aulas. Ao trocar de área, só os modelos ainda no texto padrão mudam; os editados ficam como estão.
- **Configurações**: campo "Área do espaço" em Identificação do Negócio. Na "Outra área", aparecem "O que você ensina?" e "Como seus alunos avançam?" (as mesmas 4 opções do setup). "Como você cobra?" entra no mesmo bloco (pendente em 14/10/2026: usa `CUSTOM_BILLING_OPTIONS` e grava `customSegmentBilling`). Trocar muda só padrões e palavras daí em diante; modalidades, trilhas e turmas existentes não mudam.
- **Primeiros passos e cadastro do aluno**: seguem a forma de cobrança da área (ver abaixo).

#### Primeiros passos pela forma de cobrança (14/10/2026)

As regras da mensalidade e os planos só fazem sentido onde há mensalidade. Áreas que cobram por curso fechado (`defaultBillingMode === "course"`: Gastronomia, Artes e artesanato, Beleza e cursos livres) começam sem eles. "Outra área" segue a resposta de "Como você cobra?" (sem resposta, mensalidade): pode ser de mensalidade, curso, pacote ou sem cobrança.
- **Área de mensalidade**: Definir horário de funcionamento → Definir regras da mensalidade → Cadastrar modalidades → **Criar planos ou pacotes** → Cadastrar professores e instrutores → Cadastrar alunos → Criar a primeira turma (15/10/2026: antes "Criar planos de mensalidade").
  - "Criar planos ou pacotes" conclui com um plano ativo **ou** um pacote de aulas ativo; leva a `/classes/plans`.
  - "Definir regras da mensalidade" conclui com as regras salvas **ou** quando o espaço só tem pacotes (pacote ativo e nenhum plano ativo): as regras só valem para a mensalidade. Criado um plano, o passo volta a pedir as regras.
  - Fase 1 do checklist: "Horário de funcionamento, regras da mensalidade, modalidades e planos ou pacotes."; boas-vindas: *"turmas, planos e pacotes, alunos e configurações"* e *"horários de funcionamento, planos ou pacotes e turmas"*.
  - **Explicação em "Planos e pacotes" (revisto em 15/10/2026):** sem card próprio no topo, que repetia as abas e o estado vazio. As abas já são a escolha, e o estado vazio de cada uma explica quando usar: **"Nenhum plano de mensalidade ainda."** / "Para quem paga todo mês. Dá para usar junto com pacotes." e **"Nenhum pacote de aulas ainda."** / "Para quem compra um número de aulas. Dá para usar junto com mensalidades." O botão do topo segue a aba ("+ Novo plano" / "+ Novo pacote"). **Tour das abas (15/10/2026):** no primeiro acesso com o passo "Criar planos ou pacotes" pendente, um tour de 2 passos aponta "Planos de mensalidade" ("Para quem paga um valor todo mês. As mensalidades são geradas sozinhas, pelas regras da mensalidade.") e "Pacotes de aulas" ("Para quem compra um número de aulas. Cada presença na chamada usa uma aula. Dá para usar os dois."). Mostrado uma vez (`gestarahub_tour_plans_tabs` no navegador); ligado na rota (`app/(app)/classes/plans/plans-screen.tsx`) com o `ProductTour` (sem o passo do menu no celular).
- **Área de curso**: Definir horário de funcionamento → Cadastrar modalidades → Cadastrar professores e instrutores → Cadastrar alunos → **Criar o primeiro curso** → **Matricular alunos no curso**. A fase 3 do checklist vira "Cursos & Matrículas".
  - "Criar o primeiro curso" conclui com qualquer turma criada; "Matricular alunos no curso" (requer o curso) conclui quando algum curso (`billingMode: "course"`) tem matrícula ativa, e o "Continuar" abre a matrícula do curso ativo (`/classes/{id}?enroll=true`).
  - "Cadastrar alunos" continua: cadastrar e matricular são ações diferentes.
  - **Se houver turma ativa cobrando mensalidade** (ou turma antiga sem `billingMode`), "Definir regras da mensalidade" e "Criar planos de mensalidade" voltam ao checklist.
  - Criar o curso com só a matrícula faltando mostra só o aviso "Turma criada" com a ação "Matricular alunos". A comemoração ("Seu espaço está pronto!") vem na 1ª matrícula do curso, quando a configuração inicial está mesmo 100% concluída, e leva às cobranças geradas.
  - O título da comemoração é "Seu espaço está pronto!" em todas as áreas (antes "Sua academia está pronta!").
- **Área de pacote** (só "Outra área" com "Pacote de aulas"): Definir horário de funcionamento → Cadastrar modalidades → **Criar um pacote de aulas** → Cadastrar professores e instrutores → Cadastrar alunos → Criar a primeira turma. O passo do pacote conclui quando existe um pacote no catálogo e leva a `/classes/plans?tab=packages`. A nova turma já vem em "Pacote de aulas".
- **Área sem cobrança** (só "Outra área" com "Não cobro"): Definir horário de funcionamento → Cadastrar modalidades → Cadastrar professores e instrutores → Cadastrar alunos → Criar a primeira turma. A nova turma já vem em "Sem cobrança".
- Em pacote e sem cobrança, como no curso, turma ativa cobrando mensalidade traz "Definir regras da mensalidade" e "Criar planos de mensalidade" de volta (fora da área de mensalidade o passo é só de planos, e ter pacote não dispensa as regras). A fase 1 do checklist cita só os passos que existem ("Horário de funcionamento, modalidades e pacotes.").
- Boas-vindas, tour e checklist não citam mensalidade na área de curso ("cursos, alunos, cobranças e configurações"; "horários de funcionamento, cursos e matrículas").
- O checklist só esconde passos: mensalidade, planos e regras continuam disponíveis em qualquer área.
- Boas-vindas na área de pacote: *"turmas, pacotes de aulas, alunos e configurações"*; sem cobrança: *"turmas, alunos, chamada e configurações"*.
- **Cadastro do aluno**: áreas de mensalidade começam em "Paga mensalidade"; área de pacote em **"Pacote de aulas"** (15/10/2026); curso e sem cobrança em "Não paga mensalidade". Editar mantém a forma salva (sem plano e com pacote em uso abre em "Pacote de aulas").
- Código: `buildClassesOnboardingSteps` (pura, recebe `areaBillingMode` e `lessonPackagesCount`, em `features/onboarding/onboarding-steps.ts`, testada em `features/onboarding/__tests__/onboarding-steps.test.ts`); o hook `useOnboardingSteps` só junta os dados. Padrão do aluno: `defaultPaymentMode({ areaBillingMode })` em `features/clients/client-schema.ts`.

#### Estilo da trilha (11/10/2026)

O visual vem da **trilha** (`ModalityProgressionTrack.style`), não da área, porque uma academia de luta pode ter Yoga e uma escola de dança pode ter Capoeira:
- **`belt` (faixa)**: barra de faixa/corda, até 2 cores (faixa e ponta) e graus. Modelos de luta.
- **`levels` (nível)**: etiqueta simples, **uma cor opcional** (padrão: sem cor) e **sem subníveis**. Demais modelos.
- Trilhas antigas sem `style` são resolvidas por `resolveTrackStyle` (modelo; se personalizada, nomes como "Faixa", "Kruang", "Corda") e gravam o estilo no próximo salvar.
- O editor tem o campo **Modelo**, com os modelos da área primeiro ("Sugeridos") e o resto em "Outros modelos". Trocar um modelo personalizado pede confirmação.
- Modelos: Jiu-Jitsu, Judô, Muay Thai, Karatê, Taekwondo, Capoeira, Kickboxing (faixa); Níveis (Iniciante, Intermediário, Avançado), Módulos, Idiomas A1 a C2, Fases da natação, Categorias (Iniciante, Scaled, RX) e Do zero (nível).
- Textos do editor seguem o estilo: "Quando troca de faixa ou grau" ou "Quando avança de nível/módulo/fase", "Adicionar fase" etc.
- Sugestões rápidas de nome de modalidade seguem a área (Lutas mantém a lista de lutas; "Outra área" não mostra sugestões).

#### Palavras pela trilha da modalidade (14/10/2026)

As palavras da evolução seguem a **trilha de cada modalidade**, não a área: Pilates (níveis) numa academia de lutas fala em "Nível atual" e "Avançar"; Muay Thai (faixas) num estúdio de pilates fala em "Faixa atual" e "Graduar".
- Regra (`vocabularyForTrack` em `business-segment-presets.ts`): estilo faixa → Faixa/Graduação/Graduar; modelo `swim_stages` → Fase; `modules` → Módulo; demais trilhas de níveis (níveis gerais, idiomas, categorias, do zero, personalizada) → Nível + Avançar. Sem trilha, trilha desligada ou sem etapas → palavras da área. Devolve sempre o mesmo objeto por tipo (referência estável).
- Hook `useModalityVocabulary(modalidade ou trilha)` (barrel de `features/settings`) em toda tela com **uma** modalidade em contexto: modal de Graduação (modalidade aberta, incluindo Graduar e Ponto de partida), chamada da aula e lista da turma (modalidade da turma), editor da modalidade (trilha em edição), lista de chamada nos relatórios (modalidade da turma).
- Listas que misturam modalidades usam `sharedVocabularyFor`: a palavra delas quando todas as que têm trilha falam igual, senão a da área. Vale para o título "trocar de faixa/nível pela idade" do painel e para o item "Graduação/Níveis" do menu do aluno na lista de Alunos. O botão de cada aluno no painel segue a modalidade dele.
- Ficam com a palavra da **área**: textos sem modalidade (aluno sem trilha em "Definir faixa/nível", relação geral de alunos, aviso de revisão das modalidades, título do formulário de nova modalidade, navegação, configurações e modelos de mensagem do WhatsApp). A área segue como padrão da trilha de uma nova modalidade.
- Graus e etapas seguem o estilo da trilha ("Graus" na faixa, "Etapas" no nível).

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

### 4.6. Pulsos de atenção no onboarding (15/10/2026)

- **Pulso contínuo até interagir.** O que chama para o próximo passo pulsa sem parar enquanto se aplica e para quando o usuário interage. Ao sair e voltar à situação, pulsa de novo.
- **"Continuar" do banner e do checklist:** pulsa enquanto o passo pendente não é o da tela atual; para no clique.
- **Seções destacadas na chegada** (Horários em Configurações, "Regras da mensalidade" em Geral): **sem pulso desde 15/10/2026.** Usam um destaque com o resto da tela escuro (`SectionSpotlight`, `components/shared/section-spotlight.tsx`), como o tour, mas a seção continua clicável e o escuro é só visual (o clique passa: "Salvar horários" salva de primeira). Sem balão flutuante desde 17/10/2026 (ele cobria o card de cima): a orientação fica dentro da própria área destacada.
- **Regras da mensalidade na 1a configuração (17/10/2026)**: a caixa dentro da seção é a única orientação (*"Este é o modelo mais comum. Se servir para você, é só confirmar."*, sem repetir o resumo do cabeçalho "Antecipado • Proporcional • Vence todo dia 10"). Status curto *"● Falta confirmar"*. O botão continua no passo enquanto ele está pendente: *"Confirmar regras recomendadas"* sem mudanças e *"Confirmar regras"* com alguma alteração (antes virava "Salvar configurações" e o passo "sumia", embora salvar também confirme). O botão **treme de leve até o clique**, como o "Salvar horários". Textos: *"Só para mensalidades. Curso, pacote e avulso têm valor e vencimento próprios."* e *Mês cheio · "Vence no dia da matrícula"* (antes "Ciclo a partir da entrada").
- **Horários na 1a configuração (17/10/2026)**: sem o balão flutuante (ficava em cima da descrição da aba). A orientação virou uma **faixa dentro da área destacada**, no topo da lista, enquanto o espaço não salvou nenhum horário:
  - **Dica por estágio**: sem dia ligado, *"Ligue os dias em que o espaço abre."*; com dias ligados, *"Horário diferente de 08:00 às 18:00? Use Editar. Depois, salve."*
  - **"Comece rápido:"** *Seg a sex*, *Seg a sáb*, *Todos os dias*: um clique liga esses dias com 08:00 às 18:00 e fecha os outros (o atalho escolhido fica marcado). Os atalhos não pulsam.
  - O **"Salvar horários" treme de leve desde a chegada** até o clique (`animate-attention-soft-infinite`: gira no máximo 2°, sem crescer, com um anel suave; a versão que cresce passava do recorte). O recorte do `SectionSpotlight` tem 12px de folga para o anel caber. Clicar sem nenhum dia ligado não salva: aparece *"Ligue pelo menos um dia antes de salvar."* e o botão segue tremendo.
  - O status mostra *"Nenhum dia aberto ainda"* em vez de "Todas as alterações estão salvas" (que enganava antes de qualquer configuração).
  - Depois do 1o salvar, a faixa some e tudo volta ao normal. A descrição da aba virou *"Dias e horários em que o espaço funciona. Turmas e agenda seguem esse horário."* (antes falava em "agendamentos", termo do modelo de barbearia). Fecha num clique fora da seção, com Esc ou ao concluir o passo; menus e modais abertos pela seção não fecham. O recorte cobre a seção **e o botão que conclui o passo** ("Salvar horários" / "Confirmar regras recomendadas", com mais de um alvo quando estão separados) e acompanha a seção crescendo (mede a cada quadro enquanto aberto).
- **Primeira etapa concluída (15/10/2026):** ao concluir a **primeira** etapa da configuração inicial (o contador vai a 1), o aviso de primeiros passos do topo ganha o mesmo destaque, com "Etapa concluída! Siga para a próxima.", e a tela rola até ele. Enquanto o destaque está aberto o "Continuar" não pulsa; ao fechar (clique fora, Esc, trocar de tela ou continuar) volta a pulsar até o clique. Só na primeira etapa: dali em diante o pulso do "Continuar" basta.
- **Passo atual no Dashboard (15/10/2026):** logo depois de fechar as boas-vindas (uma vez, e não quando a pessoa escolhe o tour guiado), o cartão do passo atual da lista de primeiros passos ganha o mesmo destaque, com "Comece por aqui.". Enquanto o destaque está aberto, o "Continuar" do cartão não pulsa; depois de fechado, volta a pulsar.
- **Botão principal da tela do passo** ("Novo plano", "Novo pacote", "Novo profissional", "Novo aluno", "Nova turma", "Matricular alunos", "Novo serviço", "Novo" da agenda): pulsa até o clique enquanto aquele passo é o pendente. Marcado com `data-onboarding-cta="<passo>"`; o banner liga `data-onboarding-cta-attention` no `<html>` e desliga no clique.
- **Exceção, Modalidades:** "Nova modalidade" pulsa só 2 ciclos ao entrar e **só quando ainda não há nenhuma modalidade** (15/10/2026). Com pelo menos uma (ex.: as criadas no setup), não pulsa.
- **"+ Gerenciar categorias"** (lançamento financeiro) segue pulsando uma vez só, até o primeiro clique.
- Movimento reduzido (`prefers-reduced-motion`) não anima nada.
- Código: `useAttentionUntilInteraction(active, key)` em `apps/web/src/lib/use-attention-until-interaction.ts` (regra pura em `lib/attention.ts`, testada) e as animações `animate-attention-loop-infinite` e `animate-attention-ring-infinite` em `globals.css`. As de 2 ciclos continuam para os outros usos.

### 4.7. Depois da configuração inicial: Descubra o dia a dia (15/10/2026)

Concluídos os primeiros passos, o Dashboard mostra no mesmo lugar um card **opcional**, **"Descubra o dia a dia"**, com o que se faz na rotina. Só no modelo de turmas, para o dono e o gerente.
- **Cabeçalho**: título, "2 de 6 feitos" e uma barra fina de progresso. **"Fechar"** esconde o card de vez (por organização e usuário, no navegador: `gestarahub_discovery_dismissed:<orgId>:<userId>`). Com tudo feito, o card some sozinho (sem tela de "tudo pronto").
- **Item**: ícone, título, uma dica curta e **"Fazer agora →"**. Feito: check e "Feito". Bloqueado: "Requer: matrícula", como no checklist, e sem link.
- **Itens** (cada um se marca sozinho pelo dado real):
  1. **Matricular alunos na turma** ("no curso" na área de curso): "Quem já frequenta, em poucos cliques." Feito com alguma matrícula ativa. Leva à primeira turma ativa (por nome) com `?enroll=true`; sem turma ativa, a `/classes`.
  2. **Fazer a primeira chamada**: "Presença em um toque, no celular." Feito com alguma presença marcada. Bloqueado até a primeira matrícula (chamada já feita não volta a bloquear). Leva ao Calendário (`/classes/calendar`, semana atual).
  3. **Dinheiro, pela forma de cobrança da área** (`defaultBillingMode`; na "Outra área", a resposta de "Como você cobra?"):
     - Mensalidade: **Registrar um pagamento**, "Marque pago em Cobranças." Feito com alguma cobrança paga. Leva a `/classes/billing`.
     - Curso: **Ver as parcelas do curso**, "E emitir o certificado ao terminar." Feito ao abrir Cobranças filtrando curso (`?kind=course`, marca no navegador) ou com alguma parcela de curso paga. Leva a `/classes/billing?kind=course`.
     - Pacote: **Vender um pacote de aulas**, "O saldo aparece na chamada." Feito com algum pacote vendido. Leva a Alunos (`/clients`), onde fica "Vender pacote".
     - Sem cobrança: sem item de dinheiro.
  4. **Mandar um lembrete no WhatsApp**: "Mensagem pronta, sai do seu número." Feito com alguma mensagem registrada. Leva a `/communication`.
  5. **Registrar a evolução de um aluno**: "Registro de aula, meta ou graduação." Feito com algum registro de aula, meta ou graduação na ficha. Leva a Alunos.
  6. **Ver o resultado do mês**: "O que entrou, saiu e falta." Feito ao abrir o Financeiro (marca no navegador). Leva a `/finance`.
- **Permissões**: item sem a permissão da ação fica de fora (matrícula `enrollment:manage`, chamada `attendance:mark`, pagamento e pacote `billing:manage`, parcelas `billing:view`, WhatsApp `communication:view`, evolução `clients:manage`, resultado `finance:view`).
- **Atualização**: qualquer mutação bem-sucedida refaz a leitura dos marcos se o card está na tela (`createQueryClient`, em `lib/providers.tsx`); fora dela, a leitura fica velha e refaz ao voltar ao Dashboard. As marcas de "tela aberta" reagem na hora (`useSyncExternalStore`).
- Código: marcos em `onboardingService.getDiscoveryMilestones()` (uma leitura, contrato `DiscoveryMilestones`), itens em `buildDiscoveryItems` (pura, `features/onboarding/discovery-items.ts`, testada), card em `features/onboarding/components/discovery-checklist.tsx`, marcas do navegador em `lib/discovery-flags.ts` (com try/catch; gravadas por `BillingView` com `kind=course` e por `FinanceView`).

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
