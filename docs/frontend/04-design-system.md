# Design System

## Decisao

O GestaraHub adota shadcn/ui + Tailwind CSS v4 + Radix como design system. O estilo do registry e `new-york` e a base color e `neutral` (ver `components.json`). O tema e centralizado em variaveis CSS do shadcn declaradas em `src/app/globals.css` (`:root` para o modo claro e `.dark` para o escuro), expostas ao Tailwind v4 via bloco `@theme inline`. A paleta de marca Corte Nobre, os neutros grafite e as cores de status de agendamento sao definidos como variaveis CSS, consumidas por classes utilitarias do Tailwind e por um mapa unico chave -> cor.

O tom visual segue a Corte Nobre (barbearia classica): sobrio, masculino, profissional. A interface e um painel operacional de alta densidade: o operador de balcao precisa ver muita informacao por tela sem rolagem excessiva. Abordagem desktop-first, mas utilizavel em tablet/celular de balcao.

Referencias oficiais:

- shadcn/ui (instalacao, `components.json`, blocks): https://ui.shadcn.com/docs
- shadcn/ui - tema e variaveis CSS: https://ui.shadcn.com/docs/theming
- Tailwind CSS v4 (`@theme`, `@custom-variant`, tokens): https://tailwindcss.com/docs
- React Hook Form: https://react-hook-form.com/
- Zod + @hookform/resolvers (zodResolver): https://github.com/react-hook-form/resolvers
- sonner (toasts): https://sonner.emilkowal.ski/

## Contexto

- O frontend e mockado (ver `docs/frontend/00-estrategia-frontend.md`); o design system precisa estar pronto para todas as telas do MVP da Corte Nobre antes do backend.
- Os estados e textos das telas vem de `docs/product/10-estados-e-mensagens.md`. Este documento define COMO esses estados sao apresentados (cores, componentes, toasts), nao o texto (que ja esta fixado no doc 10).
- Os status de agendamento e suas chaves vem de `docs/product/04-mvp-barbearia.md` e `docs/product/08-barbearia-corte-nobre.md`.
- shadcn/ui nao e uma lib de runtime: os componentes sao copiados para `src/components/ui/` e ficam sob controle do projeto. Tailwind v4 e Radix sao as dependencias reais; lucide-react fornece os icones.
- A referencia visual e de componentes vive em `old/gestarahub-web` (Next + shadcn, fora do git): reusar `components/ui`, `components/form` (field-shell + wrappers) e o `globals.css` como ponto de partida.

## Escopo

- Tema base: variaveis CSS do shadcn (background, foreground, primary, muted, border, ring, card, popover, sidebar...) mapeadas para a paleta Corte Nobre.
- Paleta de marca (ambar/dourado) + neutros grafite + cores funcionais (success/warning/danger/info).
- Mapa de cores de status de agendamento (variaveis CSS + classes utilitarias) + estilo distinto de bloqueio de horario.
- App shell: sidebar + topbar, densidade de painel operacional.
- Convencoes de componentes shadcn: Button, Dialog, Select, Input, Textarea, Switch, Badge, Card, DropdownMenu, Breadcrumb, Toaster (sonner).
- Formularios: React Hook Form + Zod (zodResolver) com componentes de campo Controller-based.
- Responsividade desktop-first com adaptacao para tablet/celular de balcao.

## Fora de escopo

- Implementacao final de cada componente (este doc fixa convencoes e tokens, nao codigo de producao).
- Sistema de rotulos por segmento (label overrides) - apenas previsao conceitual no MVP.
- Tematizacao por organizacao/white-label - futuro; a estrutura de variaveis CSS ja deixa o caminho aberto.
- Microtexto e copy (definidos no doc 10).

## Tom da marca: Corte Nobre

Barbearia classica. A linguagem visual deve transmitir:

- Sobriedade: poucas cores fortes; cor reservada para significado (status, acao primaria, alerta).
- Masculinidade classica: neutros quentes/grafite, um dourado/ambar discreto como cor de marca (referencia a navalha, latao, couro).
- Profissionalismo de painel: tipografia limpa, alto contraste de leitura, densidade controlada.

Decisao de cor de marca: grafite escuro como cor estrutural (sidebar, topbar) + um ambar/dourado fosco como acento de marca e acao primaria (`--primary`). Evitar tons saturados/joviais.

## Tema: variaveis CSS do shadcn (globals.css)

O tema vive em `src/app/globals.css`. A estrutura segue o padrao shadcn/Tailwind v4:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* expoe as variaveis CSS como cores/raios do Tailwind v4 */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

As variaveis de cor usam o formato OKLCH (padrao do shadcn). Os valores abaixo sao a paleta de referencia (hex aprovaveis; a conversao final para OKLCH ocorre na implementacao, preservando a intencao de matiz/contraste). A regra de ouro: **a UI consome SEMPRE as variaveis/classes do tema (`bg-primary`, `text-muted-foreground`, ...), nunca hex literal em componente.**

### Cores de marca (ambar/dourado fosco)

Servem de base para `--primary` e para realces de marca.

| Papel | Hex de referencia | Uso |
| --- | --- | --- |
| brand-50 | #FBF6EC | fundo de destaque muito sutil |
| brand-100 | #F3E6C9 | hover/selecao clara |
| brand-200 | #E6CD97 | bordas de destaque |
| brand-300 | #D6B266 | |
| brand-400 | #C49A41 | |
| brand-500 | #A87C2A | cor de marca base |
| brand-600 | #8A6420 | `--primary` (acao primaria solida) |
| brand-700 | #6B4D19 | hover da acao primaria |
| brand-800 | #4D3712 | |
| brand-900 | #2E210B | texto de marca sobre fundo claro |

### Neutros (grafite quente - estrutura e texto)

Base para `--background`, `--foreground`, `--muted`, `--border` e para a sidebar grafite.

| Papel | Hex de referencia | Uso |
| --- | --- | --- |
| neutral-50 | #F7F7F6 | `--background` (light) |
| neutral-100 | #EDEDEB | `--muted` / faixas de tabela |
| neutral-200 | #DCDCD8 | `--border` (light) |
| neutral-300 | #C2C2BC | bordas fortes / divisores |
| neutral-400 | #9C9C95 | placeholder / desabilitado |
| neutral-500 | #74746E | `--muted-foreground` |
| neutral-600 | #54544F | |
| neutral-700 | #3A3A36 | `--foreground` (light) |
| neutral-800 | #26261F | superficie escura |
| neutral-900 | #16160F | `--sidebar` (grafite estrutural) |

### Mapeamento para as variaveis do shadcn

| Variavel CSS | Light (referencia) | Dark (referencia) |
| --- | --- | --- |
| --background | neutral-50 | neutral-900 |
| --foreground | neutral-700 | neutral-50 |
| --card | white | neutral-800 |
| --card-foreground | neutral-700 | neutral-50 |
| --popover | white | neutral-800 |
| --popover-foreground | neutral-700 | neutral-50 |
| --primary | brand-600 | brand-500 |
| --primary-foreground | white | neutral-900 |
| --secondary | neutral-100 | neutral-800 |
| --secondary-foreground | neutral-700 | neutral-50 |
| --muted | neutral-100 | neutral-800 |
| --muted-foreground | neutral-500 | neutral-300 |
| --accent | neutral-100 | neutral-800 |
| --accent-foreground | neutral-700 | neutral-50 |
| --destructive | #C0392B (danger) | #E15B4C |
| --border | neutral-200 | neutral-700 |
| --input | neutral-200 | neutral-700 |
| --ring | brand-500 | brand-400 |
| --sidebar | neutral-900 | neutral-900 |
| --sidebar-foreground | neutral-100 | neutral-100 |
| --sidebar-primary | brand-500 | brand-500 |
| --sidebar-primary-foreground | neutral-900 | neutral-900 |
| --sidebar-accent | neutral-800 | neutral-800 |
| --sidebar-accent-foreground | neutral-50 | neutral-50 |
| --sidebar-border | neutral-800 | neutral-800 |
| --sidebar-ring | brand-400 | brand-400 |

### Cores funcionais (feedback)

Usadas em toasts, validacoes e badges genericos (independem de status de agendamento). sonner herda `--popover`/`--border`; os tipos de toast usam estas cores.

| Papel | Hex de referencia |
| --- | --- |
| success | #2F7A4D (verde) |
| warning | #B7791F (ambar) |
| danger | #C0392B (vermelho) |
| info | #2C5F8A (azul) |

### Tipografia

Fonte padrao do projeto via variavel `--font-sans` (no `old/`, Geist Sans; Inter e alternativa equivalente). Mono via `--font-mono`. Sem peso de download externo critico no MVP.

| Token | Valor de referencia |
| --- | --- |
| --font-sans | var(--font-geist-sans), "Inter", system-ui, sans-serif |
| --font-mono | var(--font-geist-mono), ui-monospace, monospace |

Escala (Tailwind v4, densidade de painel - base 14px no corpo operacional):

| Classe | px aprox | Uso |
| --- | --- | --- |
| text-xs | 12 | metadados, legendas, badges |
| text-sm | 14 | corpo padrao do app, tabelas densas |
| text-base | 16 | enfase / labels de form |
| text-lg | 18-20 | titulos de secao |
| text-xl / text-2xl | 20-24 | titulos de pagina |

Pesos: `font-normal` 400, `font-medium` 500, `font-semibold` 600, `font-bold` 700. Titulos usam semibold; numeros de indicadores no dashboard podem usar bold.

### Espacamento

Escala base 4px do Tailwind (`p-2` = 8px). Densidade operacional usa padding interno menor que o default.

| Contexto | Espacamento de referencia |
| --- | --- |
| padding de celula de tabela | `py-2 px-3` (8/12px) |
| gap entre campos de form | `space-y-4` (16px) |
| padding de card | `p-4` a `p-5` (16-20px) |
| gap de secoes da pagina | `space-y-6` (24px) |
| padding do conteudo principal | `p-4` (mobile) a `p-6` (desktop) |

### Radii

Cantos discretos via `--radius` (referencia: `0.625rem`). As classes `rounded-sm/md/lg/xl` derivam de `--radius` no `@theme inline`.

| Classe | Valor (derivado) | Uso |
| --- | --- | --- |
| rounded-sm | --radius - 4px | inputs, badges |
| rounded-md | --radius - 2px | botoes, cards |
| rounded-lg | --radius | modais, popovers |
| rounded-full | 9999px | avatar, dot de status |

### Sombras

Sombras suaves; o painel se apoia mais em bordas do que em elevacao. Usar `shadow-sm` (cards), `shadow-md` (dropdowns/popovers), `shadow-lg` (modais).

## Cores de status de agendamento

Mapa fixo chave -> cor, definido como variaveis CSS proprias em `globals.css` (independentes do tema shadcn base, para garantir contraste consistente). Cada status tem um par: `solid` (barra lateral, dot e texto do badge) + `surface` (fundo do bloco/badge). As chaves sao EXATAMENTE as do canon: `pendente`, `confirmado`, `em_atendimento`, `concluido`, `cancelado`, `nao_compareceu`. O `bloqueio` de horario NAO e um status de agendamento, mas tem estilo proprio definido aqui.

Requisitos: distinguiveis entre si (matiz diferente, nao so tonalidade) e acessiveis (texto sobre o fundo claro do badge com contraste AA >= 4.5:1; cor nunca e o unico sinal - sempre acompanha rotulo).

| Chave | Rotulo | Significado visual | solid | surface |
| --- | --- | --- | --- | --- |
| pendente | Pendente | aguardando confirmacao | #B7791F (ambar) | #FBF1DC |
| confirmado | Confirmado | confirmado, vai acontecer | #2C5F8A (azul) | #E1ECF5 |
| em_atendimento | Em atendimento | acontecendo agora | #2F7A4D (verde) | #DEF0E5 |
| concluido | Concluido | finalizado | #54544F (grafite) | #ECECEA |
| cancelado | Cancelado | cancelado pelo cliente/equipe | #C0392B (vermelho) | #F7E2DF |
| nao_compareceu | Nao compareceu | no-show | #7A3FA0 (roxo) | #EFE3F5 |

Regras de aplicacao:

- Os 6 status usam 6 matizes distintos (ambar, azul, verde, grafite, vermelho, roxo) para serem separaveis a primeira vista no day view, inclusive por daltonicos quando combinados ao rotulo.
- `concluido` e neutro/dessaturado (cinza) de proposito: o passado "recua" visualmente e nao compete com o que ainda vai acontecer.
- `em_atendimento` (verde, "ao vivo") pode ganhar um indicador extra de "agora" (ex.: leve pulso/borda mais forte) ja que e o estado mais acionavel no dia.
- Na Agenda (react-big-calendar), o evento usa `surface` como fundo, `solid` como barra lateral esquerda (4px) e dot, e o texto do evento em `foreground` ou no proprio `solid` quando couber.
- Em badges de lista/detalhe: fundo `surface`, texto `solid`, e um dot `solid`.

### Definicao em CSS + classes utilitarias

Declarar as variaveis em `globals.css` e expor classes utilitarias para consumo direto pela UI e pelo react-big-calendar:

```css
:root {
  --status-pendente-solid: #b7791f;
  --status-pendente-surface: #fbf1dc;
  --status-confirmado-solid: #2c5f8a;
  --status-confirmado-surface: #e1ecf5;
  --status-em-atendimento-solid: #2f7a4d;
  --status-em-atendimento-surface: #def0e5;
  --status-concluido-solid: #54544f;
  --status-concluido-surface: #ececea;
  --status-cancelado-solid: #c0392b;
  --status-cancelado-surface: #f7e2df;
  --status-nao-compareceu-solid: #7a3fa0;
  --status-nao-compareceu-surface: #efe3f5;
  --status-bloqueio-surface: #ededeb;
  --status-bloqueio-border: #c2c2bc;
}
```

No TypeScript, um mapa unico expoe a chave do canon -> par de variaveis, e um helper devolve as classes/estilos (garante Agenda x listas x detalhe identicos):

```ts
// src/features/appointments/status-style.ts (conceitual)
export const STATUS_STYLE = {
  pendente:       { solid: "var(--status-pendente-solid)",       surface: "var(--status-pendente-surface)" },
  confirmado:     { solid: "var(--status-confirmado-solid)",     surface: "var(--status-confirmado-surface)" },
  em_atendimento: { solid: "var(--status-em-atendimento-solid)", surface: "var(--status-em-atendimento-surface)" },
  concluido:      { solid: "var(--status-concluido-solid)",      surface: "var(--status-concluido-surface)" },
  cancelado:      { solid: "var(--status-cancelado-solid)",      surface: "var(--status-cancelado-surface)" },
  nao_compareceu: { solid: "var(--status-nao-compareceu-solid)", surface: "var(--status-nao-compareceu-surface)" },
} as const;

export function statusStyle(status: keyof typeof STATUS_STYLE) {
  return STATUS_STYLE[status];
}
```

A UI consome por chave (`statusStyle(status)`), nunca repetindo hex em componente. Trocar a paleta = mudar so as variaveis CSS.

### Bloqueio de horario (estilo distinto)

Bloqueio NAO e agendamento e precisa ser inconfundivel (ver doc 10, "Horario bloqueado"). Estilo proprio: aparencia "hachurada/neutra", sem matiz de status.

| Item | Definicao |
| --- | --- |
| Fundo do slot | `--status-bloqueio-surface` com padrao de listras diagonais (hachura via `repeating-linear-gradient`) |
| Borda | tracejada (`border-dashed`) usando `--status-bloqueio-border` |
| Texto | `text-muted-foreground`, "Bloqueado" + motivo opcional (ex.: "Bloqueado - Almoco") |
| Cursor / interacao | nao clicavel para agendar; tentativa dispara o erro de bloqueio do doc 10 |

## App shell (sidebar + topbar)

Layout de painel operacional: sidebar fixa a esquerda + topbar fixa no topo + area de conteudo rolavel. Implementado em `src/components/layout/` (AppShell, Sidebar, Topbar) e montado em `src/app/(app)/layout.tsx`. Login fica FORA do app shell: rota `src/app/(auth)/login/page.tsx`, sem sidebar/topbar.

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

A guarda de sessao (mock) protege `(app)/*` via cookie + `middleware.ts` (redireciona para `/login`), ou via checagem no `(app)/layout.tsx`. Por ser mock, manter simples.

### Sidebar

- Usar o bloco `sidebar` do shadcn (`components/ui/sidebar.tsx`) com `SidebarProvider`. Cores do tema `--sidebar*` (fundo grafite escuro, texto claro), reforcando o tom sobrio e o contraste com o conteudo claro.
- Itens de navegacao (ordem e rotulos do canon): Dashboard, Agenda, Agendamentos, Clientes, Equipe, Servicos, Configuracoes. Cada item com icone lucide-react.
- Item ativo: realce com `--sidebar-primary` (barra lateral ou fundo de marca sutil) + texto em destaque; derivar do pathname (`usePathname`).
- Largura: ~248px expandida; colapsavel para ~64px (so icones, `collapsible="icon"`) em telas menores ou por preferencia.
- Configuracoes ancorado na base (`SidebarFooter`), separado dos modulos operacionais.

### Topbar

- Altura compacta (~56px), fundo `--background`/`--card`, borda inferior `--border`.
- Conteudo: `SidebarTrigger` (hamburguer em telas estreitas), seletor de unidade (Corte Nobre - Matriz, unica no MVP), busca global opcional, acao primaria "Novo agendamento" (Button `default`/primary), menu de perfil/sessao (DropdownMenu, logout mockado).
- Breadcrumb opcional abaixo/junto ao titulo da pagina (componente Breadcrumb do shadcn).
- A acao primaria fica sempre visivel no topo, pois "Novo agendamento" e o fluxo mais frequente.

### Area de conteudo

- Fundo `--background`. Cabecalho de pagina com titulo (`text-2xl`), subtitulo opcional e acoes contextuais a direita.
- Densidade de painel: paddings menores, tabelas compactas, menos espaco morto. Preferir mostrar mais linhas a mais respiro.

## Formularios (React Hook Form + Zod)

Stack de formularios: React Hook Form 7 + Zod 4 via `@hookform/resolvers` (`zodResolver`). Padrao de validacao:

- `mode: "onSubmit"` (valida na confirmacao) + `reValidateMode: "onChange"` (revalida no change apos o primeiro submit) - alinhado ao doc 10.
- Foco no primeiro campo invalido no submit: usar `shouldFocusError: true` (default do RHF) e garantir `ref` encaminhado em todo campo.
- Mensagem de erro abaixo do campo com o texto EXATO do doc 10 (mensagens definidas no schema Zod).
- Submit desabilitado/erro enquanto houver campo invalido (doc 10); botao salvar pode usar `isSubmitting`.
- Campos obrigatorios com indicador (asterisco) e `required`/`aria-required` semantico; `aria-invalid` no controle quando invalido.

### Componentes de campo (Controller-based)

Reusar os wrappers de `old/src/components/form` em `src/components/form/`. Padrao: um `FieldShell` (label + erro + hint) envolvendo o controle shadcn via `Controller` e `useFormContext`. Componentes: `InputText`, `InputPassword`, `InputPhone`, `InputNumber`, `InputMask`, `InputCurrency`, `Select`, `Dropdown`, `ComboboxField`/`MultiComboboxField`, `TextArea`, `Checkbox`, `RadioGroup`, `Switch`, `InputFile`, `DatePicker`, `DatetimePicker`, `TimePicker`, `AddressFieldsSection`.

```tsx
// padrao do wrapper (resumo do old/): Controller + FieldShell + controle shadcn
export function InputText<T extends FieldValues>({ name, label, required, ... }) {
  const { control } = useFormContext<T>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={String(name)} label={label} error={fieldState.error?.message} required={required}>
          <Input {...field} aria-invalid={fieldState.invalid} value={field.value ?? ""} />
        </FieldShell>
      )}
    />
  );
}
```

`InputCurrency`: exibir em reais (R$), armazenar em centavos (`precoCentavos`); parse de digitos / 100; nunca aceitar negativo (doc 10).

Alternativa: primitivos `Form` do shadcn (`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`), tambem Controller-based, integrados ao RHF. Os wrappers de campo do `old/` sao o caminho preferido por ja encapsularem label+erro+hint num shell consistente; os primitivos shadcn ficam disponiveis para casos pontuais.

### Layout de form

- Coluna unica no mobile; ate duas colunas em desktop quando os campos forem curtos (ex.: data + horario lado a lado).
- Selects dependentes: ao escolher profissional, filtrar servicos que ele realiza; ao escolher servico, derivar `fim` por `inicio + duracaoMinutos` (campo `fim` nao editavel).

## Convencoes de componentes (shadcn/ui)

Usar os componentes copiados para `src/components/ui/` (gerados pela CLI do shadcn, estilo new-york). Convencoes especificas do GestaraHub:

### Button

- Acao primaria: variante `default` (usa `--primary`, ambar). Uma unica acao primaria por contexto.
- Acao secundaria: variante `outline` ou `secondary`.
- Acao destrutiva (cancelar agendamento, excluir serie): variante `destructive`, sempre atras de confirmacao (ver Dialog).
- Acao discreta: variante `ghost` (icones de topbar, acoes de linha). Tamanho padrao no painel: `sm`; `default` em formularios.

### Dialog

- Usar `Dialog` para criar/editar agendamento, bloqueio e confirmacoes sensiveis.
- Confirmacoes seguem o doc 10: titulo, corpo e dois botoes (acao primaria / "Voltar"); a acao destrutiva usa `destructive`. (Pode-se usar `AlertDialog` para confirmacoes que nao devem fechar por overlay/ESC.)
- Para escopo de serie ("Somente esta ocorrencia" / "Esta e as futuras"), usar um passo de selecao de escopo antes da confirmacao final, conforme doc 10.
- Foco inicial no primeiro campo (form) ou na acao menos destrutiva (confirmacao). Fechar por ESC/overlay nos forms; em confirmacao destrutiva, exigir clique explicito.
- Modais de form: largura media; em mobile, ocupar tela cheia (usar `Sheet` full-screen) para usabilidade de balcao.

### Select, Input, Textarea, Switch

- `Select` (Radix) para escolha unica; o wrapper de form adiciona placeholder, clearable e `aria-invalid`. Para muitas opcoes ou busca, usar `Combobox` (Command + Popover).
- `Input` / `Textarea`: bordas `--input`, foco com `ring` (`--ring`, ambar). `Textarea` para campos longos (ex.: observacoes, motivo de bloqueio).
- `Switch` para flags booleanas (ex.: ativo/inativo, profissional aceita agendamento online).

### Badge

- Badge de status: fundo `surface`, texto/dot `solid` do status (via `statusStyle`). Sempre com rotulo textual (cor nunca sozinha).
- Badge de origem (`manual` / `recorrencia`): variante `outline`/`secondary` neutra; ocorrencia de serie pode exibir icone de recorrencia (lucide).

### Card

- Card para indicadores do dashboard, blocos de detalhe e agrupamento de form. `CardHeader`/`CardContent`/`CardFooter`. Indicadores: numero em `font-bold`, label em `text-muted-foreground`.

### DropdownMenu (kebab de acoes)

- Acoes por linha em tabelas/cards via `DropdownMenu` acionado por um botao kebab (icone `MoreVertical` da lucide, Button `ghost size-icon`), para nao poluir a linha. Acao mais comum pode ser botao direto.
- Itens destrutivos no menu com estilo `text-destructive`; acoes sensiveis ainda abrem confirmacao em Dialog.

### Breadcrumb

- Componente `Breadcrumb` do shadcn em paginas de detalhe (ex.: Clientes > [Nome], Equipe > [Nome]). Ultimo item e a pagina atual (`BreadcrumbPage`), nao clicavel.

### Toaster (sonner)

- Usar `<Toaster />` do sonner montado no root layout (`src/app/layout.tsx`), tematizado pelos tokens shadcn. Disparar via `toast.success` / `toast.warning` / `toast.error` / `toast.info`.
- Mapeamento por tipo:
  - `toast.success` (verde): acao concluida (ex.: "Agendamento criado", "Cliente salvo").
  - `toast.warning` (ambar): atencao sem bloqueio (ex.: "[N] ocorrencia(s) em conflito nao foram criadas. Resolva manualmente.").
  - `toast.error` (vermelho): falha simulada de carregamento ou acao invalida.
  - `toast.info` (azul): confirmacoes neutras.
- Toast e para feedback efemero; NAO substitui:
  - validacao de campo (fica no proprio campo, doc 10);
  - confirmacao de acao sensivel (fica em Dialog, doc 10);
  - estados de erro de lista (ficam na area da lista com "Tentar novamente", doc 10).
- Posicao: canto inferior direito (desktop) / topo (mobile). Duracao curta para sucesso; erro pode exigir dispensar manualmente.

### Tabelas (listas)

- Aplicar a Clientes, Equipe, Servicos, Agendamentos. Densidade compacta (linhas baixas, `text-sm`). Pode-se usar o componente `Table` do shadcn ou layout proprio com Tailwind.
- Cabecalho fixo (sticky) quando a lista rola; zebra sutil opcional com `bg-muted`.
- Coluna de status renderiza o badge de status (mapa acima). Acoes por linha no DropdownMenu kebab.
- Cada lista representa os 4+1 estados do doc 10: carregando (`Skeleton` de linhas), com dados, vazio sem dados (empty state com CTA), vazio por filtro/busca ("Limpar busca/filtros"), erro simulado ("Tentar novamente").
- Busca e filtros acima da tabela; ordenacao por data/horario onde aplicavel.
- Em mobile/tablet estreito, a tabela colapsa para lista de Cards (uma linha = um card com os campos essenciais), preservando o badge de status.

## Responsividade

Desktop-first (operacao acontece no balcao/recepcao em tela maior), mas utilizavel em tablet e celular de balcao.

Breakpoints (Tailwind v4 default):

| Prefixo | Largura | Alvo |
| --- | --- | --- |
| (base) | < 640px | celular de balcao |
| sm | >= 640px | celular grande |
| md | >= 768px | tablet |
| lg | >= 1024px | desktop pequeno |
| xl | >= 1280px | desktop padrao (alvo principal) |
| 2xl | >= 1536px | telas amplas |

Adaptacoes:

- Sidebar: fixa e expandida em `lg+`; colapsada (icones, `collapsible="icon"`) em `md`; em base/`sm` vira off-canvas (Sheet) acionado pelo `SidebarTrigger` na topbar.
- Topbar: "Novo agendamento" pode virar botao so com icone em telas estreitas.
- Tabelas: viram cards empilhados abaixo de `md` (ver Tabelas).
- Agenda (react-big-calendar): day view por padrao em mobile (semana/mes ficam apertados); week/month a partir de `md/lg`. Em mobile, o filtro por profissional reduz colunas e o evento prioriza horario + cliente + dot de status.
- Modais de form: `Sheet` full-screen em base/`sm`; `Dialog` centralizado em `md+`.
- Toques: alvos minimos de ~40px em telas touch (balcao), mesmo com densidade compacta no desktop.

## Convencoes de uso do tema

- Consumir SEMPRE classes/variaveis do tema (`bg-primary`, `text-muted-foreground`, `border-border`...) e o helper de status por chave; nunca hex literal em componente.
- Status de agendamento renderizado por helper unico (`statusStyle`) que recebe a chave do canon e devolve `solid`/`surface` (garante consistencia Agenda x listas x detalhe).
- Modo claro e o padrao do MVP; o modo escuro fica preparado pelas variaveis `.dark` (ativacao via ThemeProvider/`next-themes` e refinamento ficam como pendencia).
- Tema definido num unico `globals.css` (variaveis `:root`/`.dark` + `@theme inline`), importado no root layout; Providers (QueryClient, ThemeProvider, `<Toaster/>`) montados em `src/app/layout.tsx`.
- `cn` (`src/lib/utils.ts`, clsx + tailwind-merge) para compor classes condicionais.

## Pendencias

- Validar contraste AA real de cada par status `solid`/`surface` apos a conversao para OKLCH e ajustar se algum par ficar abaixo de 4.5:1 para texto.
- Decidir se titulos usam uma fonte serifada de marca (reforco do tom classico) ou mantem a sans padrao.
- Definir os icones lucide de cada item de navegacao e de origem/recorrencia.
- Ativar e revisar o modo escuro (hoje apenas previsto nas variaveis `.dark`).
- Converter a paleta de referencia (hex) para os valores OKLCH finais em `globals.css`, mantendo a intencao de matiz/contraste.
- Definir o indicador visual de "agora" para `em_atendimento` (borda/pulso) sem prejudicar a leitura da Agenda.
</content>
</invoke>
