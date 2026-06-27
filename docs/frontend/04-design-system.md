# Design System

## Decisao

O GestaraHub adota o Chakra UI v3 como design system. O tema e centralizado em um `system` Chakra (criado via `defineConfig` + `createSystem` sobre o `defaultConfig`), expondo tokens de marca, neutros, tipografia, espacamento e radii. As cores de status de agendamento sao tokens semanticos, com mapa fixo chave -> cor, para que Agenda, listas e detalhe usem a MESMA fonte de cor.

O tom visual segue a Corte Nobre (barbearia classica): sobrio, masculino, profissional. A interface e um painel operacional de alta densidade: o operador de balcao precisa ver muita informacao por tela sem rolagem excessiva.

Abordagem desktop-first, mas utilizavel em tablet/celular de balcao.

Referencias oficiais:

- Chakra UI v3 + TanStack Router (guia de integracao oficial): https://chakra-ui.com/docs/get-started/frameworks/tanstack-router
- Chakra UI v3 - customizacao de tema (defineConfig / createSystem / defaultConfig): https://chakra-ui.com/docs/theming/customization/overview
- Chakra UI v3 - semantic tokens: https://chakra-ui.com/docs/theming/semantic-tokens

## Contexto

- O frontend e mockado (ver `docs/frontend/00-estrategia-frontend.md`); o design system precisa estar pronto para todas as telas do MVP da Corte Nobre antes do backend.
- Os estados e textos das telas vem de `docs/product/10-estados-e-mensagens.md`. Este documento define COMO esses estados sao apresentados (cores, componentes, toasts), nao o texto (que ja esta fixado no doc 10).
- Os status de agendamento e suas chaves vem de `docs/product/04-mvp-barbearia.md` e `docs/product/08-barbearia-corte-nobre.md`.
- O Chakra v3 usa CSS variables e e SSR-friendly, o que resolve os problemas de SSR da v2 e combina com o TanStack Start.

## Escopo

- Tema base: paleta (marca + neutros), tipografia, espacamento, radii, sombras.
- Tokens semanticos (cores de superficie, texto, borda, foco) e modo claro/escuro.
- Mapa de cores de status de agendamento + estilo distinto de bloqueio de horario.
- App shell: sidebar + topbar, densidade de painel operacional.
- Convencoes de componentes: formularios, modais, tabelas, toasts.
- Responsividade desktop-first com adaptacao para tablet/celular de balcao.

## Fora de escopo

- Implementacao final dos componentes (este doc fixa convencoes e tokens, nao codigo de producao).
- Sistema de rotulos por segmento (label overrides) - apenas previsao conceitual no MVP.
- Tematizacao por organizacao/white-label - futuro; a estrutura de tokens ja deixa o caminho aberto.
- Microtexto e copy (definidos no doc 10).

## Tom da marca: Corte Nobre

Barbearia classica. A linguagem visual deve transmitir:

- Sobriedade: poucas cores fortes; cor reservada para significado (status, acao primaria, alerta).
- Masculinidade classica: neutros quentes/grafite, um dourado/ambar discreto como cor de marca (referencia a navalha, latao, couro).
- Profissionalismo de painel: tipografia limpa, alto contraste de leitura, densidade controlada.

Decisao de cor de marca: grafite escuro como cor estrutural (sidebar, topbar) + um ambar/dourado fosco como acento de marca e acao primaria. Evitar tons saturados/joviais.

## Tema base (tokens)

Os tokens abaixo sao a paleta concreta de referencia. Hex sao exemplos aprovaveis; ajustes finos de tonalidade podem ocorrer no ajuste de contraste, sem mudar a intencao.

### Cores de marca (brand - ambar/dourado fosco)

| Token | Hex | Uso |
| --- | --- | --- |
| brand.50 | #FBF6EC | fundo de destaque muito sutil |
| brand.100 | #F3E6C9 | hover/selecao clara |
| brand.200 | #E6CD97 | bordas de destaque |
| brand.300 | #D6B266 | |
| brand.400 | #C49A41 | |
| brand.500 | #A87C2A | cor de marca base |
| brand.600 | #8A6420 | acao primaria (botao solido) |
| brand.700 | #6B4D19 | hover da acao primaria |
| brand.800 | #4D3712 | |
| brand.900 | #2E210B | texto sobre fundo claro |

### Neutros (grafite quente - estrutura e texto)

| Token | Hex | Uso |
| --- | --- | --- |
| neutral.50 | #F7F7F6 | fundo de pagina (light) |
| neutral.100 | #EDEDEB | superficie sutil / faixas de tabela |
| neutral.200 | #DCDCD8 | bordas |
| neutral.300 | #C2C2BC | bordas fortes / divisores |
| neutral.400 | #9C9C95 | texto desabilitado / placeholder |
| neutral.500 | #74746E | texto secundario |
| neutral.600 | #54544F | |
| neutral.700 | #3A3A36 | texto forte |
| neutral.800 | #26261F | superficie escura (sidebar/topbar dark) |
| neutral.900 | #16160F | fundo estrutural (sidebar) |

### Cores funcionais (feedback)

Usadas em toasts, validacoes e badges genericos (independem de status de agendamento).

| Papel | Token base | Hex |
| --- | --- | --- |
| success | green.solid | #2F7A4D |
| warning | amber.solid | #B7791F |
| danger | red.solid | #C0392B |
| info | blue.solid | #2C5F8A |

### Tipografia

Fontes do sistema, sem peso de download externo no MVP (pode evoluir para uma fonte serifada de marca em titulos, se o design quiser reforcar o tom classico).

| Token | Valor |
| --- | --- |
| fonts.heading | "Inter", "Segoe UI", system-ui, sans-serif |
| fonts.body | "Inter", "Segoe UI", system-ui, sans-serif |
| fonts.mono | "JetBrains Mono", ui-monospace, monospace |

Escala de tamanho (densidade de painel: base 14px no corpo operacional):

| Token | rem | px aprox | Uso |
| --- | --- | --- | --- |
| fontSizes.xs | 0.75 | 12 | metadados, legendas, badges |
| fontSizes.sm | 0.8125 | 13 | corpo de tabela denso |
| fontSizes.md | 0.875 | 14 | corpo padrao do app |
| fontSizes.lg | 1 | 16 | enfase / labels de form |
| fontSizes.xl | 1.25 | 20 | titulos de secao |
| fontSizes.2xl | 1.5 | 24 | titulos de pagina |

Pesos: `normal` 400, `medium` 500, `semibold` 600, `bold` 700. Titulos usam semibold; numeros de indicadores no dashboard podem usar bold.

### Espacamento

Escala base 4px (multiplos do token Chakra `1` = 0.25rem). Densidade operacional usa padding interno menor que o default.

| Contexto | Espacamento de referencia |
| --- | --- |
| padding de celula de tabela | 2 (8px) vertical, 3 (12px) horizontal |
| gap entre campos de form | 4 (16px) |
| padding de card | 4 a 5 (16-20px) |
| gap de secoes da pagina | 6 (24px) |
| padding do conteudo principal | 4 (mobile) a 6 (desktop) |

### Radii

Cantos discretos, coerentes com o tom sobrio (nada muito arredondado).

| Token | Valor | Uso |
| --- | --- | --- |
| radii.sm | 4px | inputs, badges |
| radii.md | 6px | botoes, cards |
| radii.lg | 8px | modais, popovers |
| radii.full | 9999px | avatar, dot de status |

### Sombras

Sombras suaves; o painel se apoia mais em bordas do que em elevacao.

| Token | Uso |
| --- | --- |
| shadows.sm | cards e linhas com leve elevacao |
| shadows.md | dropdowns, popovers |
| shadows.lg | modais |

### Tokens semanticos (superficie, texto, borda, foco)

Tokens semanticos referenciam os tokens base e respondem ao modo claro/escuro. A UI deve consumir SEMPRE os semanticos, nunca o hex direto.

| Token semantico | Light | Dark |
| --- | --- | --- |
| bg.canvas | neutral.50 | neutral.900 |
| bg.surface | white | neutral.800 |
| bg.subtle | neutral.100 | neutral.700 |
| bg.sidebar | neutral.900 | neutral.900 |
| bg.topbar | bg.surface | neutral.800 |
| fg.default | neutral.700 | neutral.50 |
| fg.muted | neutral.500 | neutral.300 |
| fg.onBrand | white | white |
| border.default | neutral.200 | neutral.700 |
| border.strong | neutral.300 | neutral.600 |
| brand.solid | brand.600 | brand.500 |
| brand.fg | brand.700 | brand.300 |
| focusRing | brand.500 | brand.400 |

## Cores de status de agendamento

Mapa fixo chave -> cor. Cada status tem um par (cor de superficie clara para fundo de bloco/badge + cor de contorno/solido para a barra lateral, dot e texto do badge). As chaves sao EXATAMENTE as do canon: `pendente`, `confirmado`, `em_atendimento`, `concluido`, `cancelado`, `nao_compareceu`. O `bloqueio` de horario NAO e um status de agendamento, mas tem estilo proprio definido aqui.

Requisitos: distinguiveis entre si (matiz diferente, nao so tonalidade) e acessiveis (texto sobre o fundo claro do badge com contraste AA >= 4.5:1; cor nunca e o unico sinal - sempre acompanha rotulo).

| Chave | Rotulo | Significado visual | solid (barra/dot/texto) | surface (fundo do bloco) | contraste texto/surface |
| --- | --- | --- | --- | --- | --- |
| pendente | Pendente | aguardando confirmacao | #B7791F (ambar) | #FBF1DC | AA ok |
| confirmado | Confirmado | confirmado, vai acontecer | #2C5F8A (azul) | #E1ECF5 | AA ok |
| em_atendimento | Em atendimento | acontecendo agora | #2F7A4D (verde) | #DEF0E5 | AA ok |
| concluido | Concluido | finalizado | #54544F (grafite) | #ECECEA | AA ok |
| cancelado | Cancelado | cancelado pelo cliente/equipe | #C0392B (vermelho) | #F7E2DF | AA ok |
| nao_compareceu | Nao compareceu | no-show | #7A3FA0 (roxo) | #EFE3F5 | AA ok |

Regras de aplicacao:

- Os 6 status usam 6 matizes distintos (ambar, azul, verde, grafite, vermelho, roxo) para serem separaveis a primeira vista no day view, inclusive por daltonicos quando combinados ao rotulo.
- `concluido` e neutro/dessaturado (cinza) de proposito: o passado "recua" visualmente e nao compete com o que ainda vai acontecer.
- `em_atendimento` (verde, "ao vivo") pode ganhar um indicador extra de "agora" (ex.: leve pulso/borda mais forte) ja que e o estado mais acionavel no dia.
- Na Agenda (react-big-calendar), o evento usa `surface` como fundo, `solid` como barra lateral esquerda (4px) e dot, e o texto do evento em `fg.default` ou no proprio `solid` quando couber.
- Em badges de lista/detalhe: fundo `surface`, texto `solid`, e um dot `solid`.

### Bloqueio de horario (estilo distinto)

Bloqueio NAO e agendamento e precisa ser inconfundivel (ver doc 10, "Horario bloqueado"). Estilo proprio: aparencia "hachurada/neutra", sem matiz de status.

| Item | Definicao |
| --- | --- |
| Fundo do slot | neutral.100 com padrao de listras diagonais (hachura) sobre `bg.subtle` |
| Borda | tracejada (dashed) border.strong |
| Texto | fg.muted, "Bloqueado" + motivo opcional (ex.: "Bloqueado - Almoco") |
| Cursor / interacao | nao clicavel para agendar; tentativa dispara o erro de bloqueio do doc 10 |

### Tokens semanticos de status (chaves para o tema)

Sugestao de nomeacao no `system` para consumo direto pela UI:

```ts
// conceitual: tokens semanticos definidos no defineConfig do Chakra v3
// referencia: https://chakra-ui.com/docs/theming/semantic-tokens
const statusTokens = {
  "status.pendente.solid":         { value: "#B7791F" },
  "status.pendente.surface":       { value: "#FBF1DC" },
  "status.confirmado.solid":       { value: "#2C5F8A" },
  "status.confirmado.surface":     { value: "#E1ECF5" },
  "status.em_atendimento.solid":   { value: "#2F7A4D" },
  "status.em_atendimento.surface": { value: "#DEF0E5" },
  "status.concluido.solid":        { value: "#54544F" },
  "status.concluido.surface":      { value: "#ECECEA" },
  "status.cancelado.solid":        { value: "#C0392B" },
  "status.cancelado.surface":      { value: "#F7E2DF" },
  "status.nao_compareceu.solid":   { value: "#7A3FA0" },
  "status.nao_compareceu.surface": { value: "#EFE3F5" },
  "status.bloqueio.surface":       { value: "#EDEDEB" },
  "status.bloqueio.border":        { value: "#C2C2BC" },
};
```

A UI consome esses tokens por chave de status (ex.: um helper `statusColor(status)`), nunca repetindo hex em componente. Trocar a paleta = mudar so o tema.

## App shell (sidebar + topbar)

Layout de painel operacional: sidebar fixa a esquerda + topbar fixa no topo + area de conteudo rolavel. Login fica FORA do app shell (rota propria, sem sidebar/topbar).

```
+---------+-------------------------------------------------+
| SIDEBAR |  TOPBAR (unidade, busca, perfil, novo agend.)   |
|         +-------------------------------------------------+
| Logo    |                                                 |
| ------- |                                                 |
| Dashboard|   CONTEUDO (rolavel, densidade de painel)      |
| Agenda  |                                                 |
| Agendam.|                                                 |
| Clientes|                                                 |
| Equipe  |                                                 |
| Servicos|                                                 |
| ------- |                                                 |
| Config. |                                                 |
+---------+-------------------------------------------------+
```

### Sidebar

- Fundo `bg.sidebar` (grafite escuro), texto claro; reforca o tom sobrio e cria contraste com o conteudo claro.
- Itens de navegacao (ordem e rotulos do canon): Dashboard, Agenda, Agendamentos, Clientes, Equipe, Servicos, Configuracoes.
- Item ativo: faixa/realce com `brand` (barra lateral ou fundo `brand` sutil) + texto em destaque.
- Largura: ~248px expandida; colapsavel para ~64px (so icones) em telas menores ou por preferencia.
- Configuracoes ancorado na base (separado dos modulos operacionais).

### Topbar

- Altura compacta (~56px), fundo `bg.topbar`, borda inferior `border.default`.
- Conteudo: seletor de unidade (Corte Nobre - Matriz, unica no MVP), busca global opcional, acao primaria "Novo agendamento" (botao `brand` solido), menu de perfil/sessao (logout mockado).
- A acao primaria fica sempre visivel no topo, pois "Novo agendamento" e o fluxo mais frequente.

### Area de conteudo

- Fundo `bg.canvas`. Cabecalho de pagina com titulo (`fontSizes.2xl`), subtitulo opcional e acoes contextuais a direita.
- Densidade de painel: paddings menores, tabelas compactas, menos espaco morto. Preferir mostrar mais linhas a mais respiro.

## Convencoes de componentes (Chakra v3)

Usar os componentes primitivos do Chakra v3 e os snippets gerados pelo `@chakra-ui/cli` (botao, dialog/modal, toaster, field etc.), conforme o guia oficial. Convencoes especificas do GestaraHub:

### Botoes

- Acao primaria: `colorPalette="brand"`, variante solida. Uma unica acao primaria por contexto.
- Acao secundaria: variante `outline` ou `subtle`.
- Acao destrutiva (cancelar agendamento, excluir serie): variante solida/`outline` com `colorPalette` de `danger` (vermelho), sempre atras de confirmacao (ver Modais).
- Tamanho padrao no painel: `sm` (compacto); `md` em formularios.

### Formularios

- Usar o componente `Field` (snippet do Chakra v3) para label + controle + texto de erro + texto de ajuda.
- Validacao na confirmacao e, quando ajudar, no blur (alinhado ao doc 10). Mensagem de erro abaixo do campo, em `danger`, com o texto EXATO do doc 10.
- Botao salvar desabilitado ou retornando erro enquanto houver campo invalido (doc 10).
- Campos obrigatorios marcados com indicador de obrigatorio (asterisco) e `required` semantico.
- Formularios densos: layout em coluna unica no mobile; ate duas colunas em desktop quando os campos forem curtos (ex.: data + horario lado a lado).
- Money input: exibir em reais (R$), armazenar em centavos (`precoCentavos`); nunca aceitar negativo (doc 10).
- Selects dependentes: ao escolher profissional, filtrar servicos que ele realiza; ao escolher servico, derivar `fim` por `inicio + duracaoMinutos` (campo `fim` nao editavel).

### Modais (Dialog)

- Usar o `Dialog` do Chakra v3 para criar/editar agendamento, bloqueio e confirmacoes sensiveis.
- Dialogos de confirmacao seguem o doc 10: titulo, corpo e dois botoes (acao primaria / "Voltar"). A acao destrutiva usa `danger`.
- Para escopo de serie ("Somente esta ocorrencia" / "Esta e as futuras"), usar um passo de selecao de escopo antes da confirmacao final, conforme doc 10.
- Foco inicial no primeiro campo (form) ou na acao menos destrutiva (confirmacao). Fechar por ESC/overlay nos forms; em confirmacao destrutiva, exigir clique explicito.
- Modais de form: largura media; em mobile, ocupar tela cheia (full-screen sheet) para usabilidade de balcao.

### Tabelas (listas)

- Aplicar a Clientes, Equipe, Servicos, Agendamentos. Densidade compacta (linhas baixas, `fontSizes.sm`).
- Cabecalho fixo (sticky) quando a lista rola; zebra sutil opcional com `bg.subtle`.
- Coluna de status renderiza o badge de status (mapa acima).
- Acoes por linha em menu "..." (overflow) para nao poluir; acao mais comum pode ser botao direto.
- Cada lista representa os 4+1 estados do doc 10: carregando (skeleton de linhas), com dados, vazio sem dados (empty state com CTA), vazio por filtro/busca ("Limpar busca/filtros"), erro simulado ("Tentar novamente").
- Busca e filtros acima da tabela; ordenacao por data/horario onde aplicavel.
- Em mobile/tablet estreito, a tabela colapsa para lista de cards (uma linha = um card com os campos essenciais), preservando o badge de status.

### Toasts (mensagens do doc 10)

- Usar o `toaster`/`Toaster` (snippet do Chakra v3) para feedback transitorio de acoes.
- Mapeamento por tipo:
  - sucesso (`success`/verde): acao concluida (ex.: "Agendamento criado", "Cliente salvo").
  - aviso (`warning`/ambar): atencao sem bloqueio (ex.: ocorrencias de serie em conflito nao criadas - "[N] ocorrencia(s) em conflito nao foram criadas. Resolva manualmente.").
  - erro (`danger`/vermelho): falha simulada de carregamento ou acao invalida.
  - info (`info`/azul): confirmacoes neutras.
- Toast e para feedback efemero; NAO substitui:
  - validacao de campo (fica no proprio campo, doc 10);
  - confirmacao de acao sensivel (fica em Dialog, doc 10);
  - estados de erro de lista (ficam na area da lista com "Tentar novamente", doc 10).
- Posicao: canto inferior direito (desktop) / topo (mobile). Duracao curta para sucesso; erro pode exigir dispensar manualmente.

### Badges e indicadores

- Badge de status: fundo `surface`, texto/dot `solid` do status. Sempre com rotulo textual (cor nunca sozinha).
- Badge de origem (`manual` / `recorrencia`): estilo neutro discreto; ocorrencia de serie pode exibir um icone de recorrencia.
- Dashboard: indicadores numericos com numero em bold e label `fg.muted`.

## Responsividade

Desktop-first (operacao acontece no balcao/recepcao em tela maior), mas utilizavel em tablet e celular de balcao.

Breakpoints (Chakra v3 default):

| Token | Largura | Alvo |
| --- | --- | --- |
| base | < 480px | celular de balcao |
| sm | >= 480px | celular grande |
| md | >= 768px | tablet |
| lg | >= 992px | desktop pequeno |
| xl | >= 1280px | desktop padrao (alvo principal) |
| 2xl | >= 1536px | telas amplas |

Adaptacoes:

- Sidebar: fixa e expandida em `lg+`; colapsada (icones) em `md`; em `base/sm` vira drawer (menu hamburguer na topbar).
- Topbar: "Novo agendamento" pode virar botao so com icone (FAB/icone) em telas estreitas.
- Tabelas: viram cards empilhados abaixo de `md` (ver Tabelas).
- Agenda (react-big-calendar): day view por padrao em mobile (semana/mes ficam apertados); week/month a partir de `md/lg`. Em mobile, o filtro por profissional reduz colunas e o evento prioriza horario + cliente + dot de status.
- Modais de form: full-screen sheet em `base/sm`; centralizados em `md+`.
- Toques: alvos minimos de ~40px em telas touch (balcao), mesmo com densidade compacta no desktop.

## Convencoes de uso do tema

- Consumir SEMPRE tokens semanticos e tokens de status por chave; nunca hex literal em componente.
- Status de agendamento renderizado por helper unico que recebe a chave do canon e devolve `solid`/`surface` (garante consistencia Agenda x listas x detalhe).
- Modo claro e o padrao do MVP; o modo escuro fica preparado pelos tokens semanticos (ativacao e refinamento ficam como pendencia).
- Tema definido em um unico `system` (defineConfig + createSystem sobre defaultConfig) e injetado pelo `Provider` na raiz, conforme o guia Chakra v3 + TanStack Router.

## Pendencias

- Validar contraste AA real de cada par status `solid`/`surface` com ferramenta de contraste e ajustar hex se algum par ficar abaixo de 4.5:1 para texto.
- Decidir se titulos usam uma fonte serifada de marca (reforco do tom classico) ou mantem Inter.
- Definir o set de icones (ex.: lucide) e os icones de cada item de navegacao e de origem/recorrencia.
- Ativar e revisar o modo escuro (hoje apenas previsto nos tokens semanticos).
- Confirmar a API exata dos snippets do Chakra v3 (`Field`, `Dialog`, `Toaster`) no momento da implementacao, contra a doc oficial.
- Definir o indicador visual de "agora" para `em_atendimento` (borda/pulso) sem prejudicar a leitura da Agenda.
