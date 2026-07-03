# Agenda com react-big-calendar

> ⚠️ **DESATUALIZADO / SUPERSEDED.** A Agenda foi implementada **à mão** (React +
> Tailwind), **sem** `react-big-calendar` nem qualquer lib externa de calendario.
> `date-fns` é usado apenas para cálculos/formatos de data. Este documento
> descreve a decisão original (avaliada e revertida) e permanece como registro de
> contexto/requisitos. Implementação real:
> `apps/web/src/features/appointments/components/` (`calendar-panel.tsx`,
> `schedule-day-grid.tsx` — views Dia/Semana/Mês). Motivos da reversão: controle
> total do layout/UX, zero dependência externa e sem risco de features pagas.

## Decisao

A Agenda do MVP usa a biblioteca **react-big-calendar** (gratuita) como motor de
calendario. Ela atende a todos os requisitos do MVP sem custo:

- Views de dia, semana e mes (e agenda/lista).
- Colunas por profissional (resources) no day view, recurso gratuito.
- Localizacao pt-BR via localizer date-fns.
- Customizacao visual por status (cor) e por bloqueio (background events) atraves
  de callbacks de estilo e de overrides de componentes.

Nao usamos Schedule-X (a resource view e paga) nem FullCalendar (a resource view
tambem e paga). Ver STACK CANON.

No Next App Router a Agenda e um **client component** (`'use client'`):
react-big-calendar depende de APIs de browser (DOM, medidas de layout, eventos de
ponteiro), entao a tela da Agenda e o componente de calendario rodam no cliente.
Os dados continuam vindo da camada mockada via hooks (TanStack Query), tambem em
client components. RSC pode envolver a pagina (shell, metadados), mas o grid do
calendario fica sob a fronteira `'use client'`.

Docs oficiais (consultar quando a API exata for necessaria):

- Site de docs/demos: https://bigcalendar.github.io/react-big-calendar/index.html
- Repositorio: https://github.com/jquense/react-big-calendar

A assinatura EXATA de cada prop deve ser confirmada nas docs oficiais antes de
implementar; aqui o tratamento e conceitual e contratual, alinhado ao produto.

## Contexto

A Agenda e a tela central do MVP (`docs/product/04-mvp-barbearia.md`). Ela precisa:

- Comunicar com clareza horario, profissional, cliente, servico e status.
- Exibir bloqueios destacados e impedir agendar sobre eles.
- Mostrar ocorrencias de series recorrentes como eventos normais, com indicacao
  visual de que pertencem a uma serie.
- Bloquear sobreposicao para o mesmo profissional (sem encaixe no MVP).
- Cobrir os estados da Agenda definidos em
  `docs/product/10-estados-e-mensagens.md` (dia vazio, profissional sem horarios,
  bloqueio, conflito).

A Agenda nunca le mocks direto. Ela consome **hooks (TanStack Query) -> services
mockados -> store em memoria**, conforme o principio central do STACK CANON. O
componente de calendario apenas recebe eventos ja mapeados e dispara callbacks de
intencao (selecionar slot, selecionar evento) que abrem dialogs.

## Escopo

- Views: dia, semana, mes e agenda (lista).
- Colunas por profissional (resources) no day view + filtro por profissional.
- Mapeamento Agendamento -> evento do calendario.
- Cor do evento por status (alinhada ao design system do frontend).
- Bloqueios como background events, destacados e nao agendaveis.
- Series recorrentes com indicacao visual de pertencimento a uma serie.
- Bloqueio de conflito (sobreposicao para o mesmo profissional).
- Criacao/edicao via Dialog (shadcn/ui), sem drag-and-drop no MVP.
- Localizacao pt-BR (localizer date-fns) e expediente da Corte Nobre.
- Estados da Agenda conforme `docs/product/10-estados-e-mensagens.md`.

## Fora de escopo (MVP)

- Drag-and-drop e resize de eventos (addon `react-big-calendar/lib/addons/dragAndDrop`).
  Remarcacao acontece por dialog, nao por arrastar.
- Encaixe manual / confirmacao de sobreposicao. Conflito do mesmo profissional e
  SEMPRE bloqueado.
- Resource view em week/month. Colunas por profissional sao usadas apenas no day
  view; week/month exibem a agenda agregada (com filtro por profissional).
- Server functions / SSR de dados da Agenda. No MVP os dados vem da camada mockada
  via hooks em client components; o calendario nao e renderizado no servidor.
- Origens `online` e `whatsapp`.

## Client component (Next App Router)

- O arquivo da rota (ex.: `src/app/(app)/schedule/page.tsx`) pode ser RSC, mas o
  componente que renderiza `<Calendar />` declara `'use client'` no topo.
- O `localizer` (date-fns) e construido no modulo client; nao depende de runtime
  de servidor.
- Para evitar mismatch de SSR/hidratacao, manter o grid do calendario dentro da
  fronteira client. Se necessario, montar o calendario apenas apos o mount do
  cliente (ex.: `dynamic(..., { ssr: false })` ou guarda de `mounted`), confirmando
  a estrategia na doc da lib e do Next.
- O CSS base do react-big-calendar e importado uma vez no modulo client (ex.:
  `import "react-big-calendar/lib/css/react-big-calendar.css"`) e sobrescrito com
  as variaveis CSS do design system (Tailwind v4 + shadcn). Confirmar o caminho do
  CSS na doc oficial.

## Views

| View | Chave (constante `Views`) | Uso no MVP |
| --- | --- | --- |
| Dia | `Views.DAY` | Visao operacional principal; suporta colunas por profissional (resources). |
| Semana | `Views.WEEK` | Visao do planejamento da semana (agregada; filtro por profissional). |
| Mes | `Views.MONTH` | Visao panoramica; eventos compactos por dia. |
| Agenda/Lista | `Views.AGENDA` | Lista cronologica do periodo; complementa a Agenda visual. |

A lista textual de agendamentos completa (com filtros por status, profissional,
periodo e cliente) e a tela **Agendamentos**, separada da Agenda. A view
`Views.AGENDA` aqui e apenas a lista nativa do calendario para o periodo corrente.

Props relevantes (confirmar nas docs):

- `views` define o conjunto habilitado (ex.: dia, semana, mes, agenda).
- `defaultView` / `view` controla a view atual (controlado via estado da rota/URL
  para permitir deep-link, ex.: `?view=day&date=2026-06-26`, usando os search
  params do App Router).
- `date` / `onNavigate` controlam a data corrente.
- `min` / `max` limitam a faixa de horas exibida nos time views (alinhar ao
  expediente; ver "Expediente").
- `step` / `timeslots` definem a granularidade dos slots (sugestao: `step={15}`,
  `timeslots={2}` -> blocos de 30 min, coerente com a menor duracao de servico de
  15 min como meio-slot).

## Colunas por profissional (resources)

No day view, cada profissional vira uma coluna (resource). Suporte gratuito do
react-big-calendar.

- `resources`: lista de profissionais a exibir como colunas.
- `resourceIdAccessor`: como extrair o id do resource (ex.: `id`).
- `resourceTitleAccessor`: como extrair o titulo da coluna (ex.: `nome`).
- Cada evento aponta para seu resource por uma chave de resource no proprio
  evento (ex.: `resourceId`), tipicamente `profissionalId`.

Confirmar nomes exatos dos accessors nas docs oficiais.

```ts
type CalendarResource = {
  id: string;        // profissionalId
  title: string;     // nome do profissional (rotulo da coluna)
};
```

Regras das colunas:

- So profissionais **ativos** viram coluna por padrao.
- Profissionais sem dias de trabalho no dia exibido aparecem com a coluna
  destacada como "fora do expediente" (ver "Expediente" e "Estados").
- A ordem das colunas segue a ordem da Equipe (estavel entre reloads do seed).

### Filtro por profissional

- Um seletor de profissional acima do calendario filtra a Agenda.
- "Todos" (default no day view): mostra todas as colunas de resources.
- Um profissional especifico: no day view mostra so a coluna dele; no week/month
  filtra os eventos para o profissional escolhido.
- O filtro e estado de UI; pode viver na URL (deep-link, via search params do App
  Router) ou em estado local. Os dados continuam vindo dos hooks/services (a
  filtragem pode ser feita no service por parametro, simulando query string de API).

## Mapeamento Agendamento -> evento

O calendario recebe **eventos ja mapeados** a partir dos Agendamentos retornados
pelos hooks. O mapeamento e puro (sem efeitos) e vive numa funcao utilitaria.

Campos de Agendamento (ver `docs/product/04-mvp-barbearia.md`):
`id, clienteId, profissionalId, servicoId, data, inicio, fim, status,
observacoes, origem, serieId?`.

```ts
type AgendaEvent = {
  id: string;              // id do agendamento
  title: string;          // "Cliente - Servico" (ex.: "Carlos Mendes - Combo Corte + Barba")
  start: Date;            // data + inicio
  end: Date;              // data + fim (fim = inicio + duracaoMinutos do servico)
  resourceId: string;     // profissionalId (coluna no day view)
  // metadados para estilo/interacao (nao sao props nativas do RBC):
  kind: "agendamento";
  status: StatusAgendamento;       // pendente | confirmado | ... | nao_compareceu
  origem: OrigemAgendamento;       // manual | recorrencia
  serieId?: string;                // presente => pertence a uma serie
};
```

Regras de mapeamento:

- `title`: `"{nomeCliente} - {nomeServico}"`. O nome do cliente e do servico sao
  resolvidos via lookups (clienteId/servicoId) na camada de dados, nao na UI.
- `start`/`end`: combinam `data` com `inicio`/`fim`. O `fim` e derivado do
  `inicio + duracaoMinutos` do servico (regra de
  `docs/product/05-regras-negocio.md`); nunca digitado.
- `resourceId`: `profissionalId`, usado pelo day view para posicionar na coluna.
- Agendamentos `cancelado` e `nao_compareceu` continuam no historico, mas na
  Agenda visual sao exibidos esmaecidos (cor de status) e podem ser ocultados por
  um toggle "mostrar cancelados/no-shows" (default: ocultos no day/week para
  reduzir ruido; visiveis na tela Agendamentos).

## Cor do evento por status

A cor de cada evento e definida pelo **status do agendamento**. As cores sao
definidas no design system em `frontend/04-design-system.md` (tokens semanticos
`status.*`), que e a fonte unica da paleta de status; este documento apenas as
referencia e nao redefine a paleta. O mapeamento abaixo descreve a intencao de
cada cor (o hex final esta no `frontend/04`):

| Status (`StatusAgendamento`) | Rotulo | Intencao de cor |
| --- | --- | --- |
| pendente | Pendente | Neutro/aviso suave (aguardando confirmacao). |
| confirmado | Confirmado | Cor de marca/info (compromisso firme). |
| em_atendimento | Em atendimento | Destaque ativo (acontecendo agora). |
| concluido | Concluido | Sucesso/esmaecido (encerrado no passado). |
| cancelado | Cancelado | Neutro esmaecido + tachado/borda tracejada. |
| nao_compareceu | Nao compareceu | Erro/alerta esmaecido (perda operacional). |

A aplicacao da cor usa `eventPropGetter`, que retorna `className` e/ou `style` por
evento. Preferir `className` mapeado as **variaveis CSS do design system**
(tokens `status.*` expostos como CSS variables via Tailwind v4 + shadcn) em vez de
cores hardcoded.

```ts
// conceitual; confirmar assinatura exata na doc oficial
const eventPropGetter = (event: AgendaEvent) => ({
  className: `rbc-status-${event.status}`,
  // 'aria-label' e dataset podem ser usados para testes/acessibilidade
});
```

Indicadores adicionais no proprio evento (via `components.event`, override do
render do evento):

- Origem `recorrencia` ou presenca de `serieId`: icone/badge de serie (ver
  "Series recorrentes"). Icone via lucide-react.
- `cancelado`/`nao_compareceu`: titulo tachado quando exibidos.

## Bloqueios de horario

Bloqueios (entidade Bloqueio: `profissionalId, data, inicio, fim, motivo?`) sao
representados como **background events** (eventos de fundo), nao como eventos
clicaveis de agendamento.

- Marcar o evento de bloqueio com uma flag (ex.: `kind: "bloqueio"`) e renderiza-lo
  via a prop de eventos de fundo do calendario (a faixa de horas fica destacada
  atras dos slots).
- Estilo via `eventPropGetter` (e/ou o getter especifico de background events,
  conforme a doc): faixa hachurada/cinza, rotulo "Bloqueado" + motivo quando
  houver (ex.: "Bloqueado - Almoco"), conforme
  `docs/product/10-estados-e-mensagens.md`.
- No day view, o bloqueio aparece na coluna do profissional dono do bloqueio.

```ts
type BlockEvent = {
  id: string;            // id do bloqueio
  title: string;        // "Bloqueado" ou "Bloqueado - {motivo}"
  start: Date;
  end: Date;
  resourceId: string;    // profissionalId
  kind: "bloqueio";
};
```

Comportamento (regra de negocio):

- Horario bloqueado **nao aceita agendamento**.
- Selecionar um slot que cai sobre um bloqueio NAO abre o Dialog de criacao; exibe
  a mensagem de bloqueio: "Este horario esta bloqueado e nao aceita agendamento."
- Bloqueios participam das verificacoes de conflito (ver "Conflito").

## Series recorrentes

Series recorrentes (Frequencia: semanal | quinzenal | mensal) geram N ocorrencias
finitas ligadas por `serieId`, com origem `recorrencia`
(`docs/product/05-regras-negocio.md`).

Na Agenda:

- Cada ocorrencia e um **evento normal** de agendamento (mesmo mapeamento acima).
- Indicacao visual de que pertence a uma serie: badge/icone de recorrencia no
  evento (via `components.event`), acionado por `serieId` presente (ou
  `origem === "recorrencia"`).
- Ao abrir o detalhe/edicao de uma ocorrencia, o Dialog oferece o escopo da acao
  quando aplicavel: "Somente esta ocorrencia" ou "Esta e as futuras"
  (edicao, cancelamento e remarcacao), conforme
  `docs/product/10-estados-e-mensagens.md`.
- Ocorrencias de uma serie que cairiam em conflito (ocupado, fora do expediente,
  bloqueio) NAO sao criadas automaticamente; ficam sinalizadas como conflito para
  resolucao manual. A Agenda nao inventa essas ocorrencias; ela so renderiza o que
  o service retornou.

## Conflito (sobreposicao bloqueada)

No MVP nao ha encaixe: qualquer sobreposicao para o **mesmo profissional** e
sempre bloqueada (`docs/product/05-regras-negocio.md`).

A validacao de conflito NAO mora no componente de calendario; mora na **camada de
service** (e e re-checada pelo backend futuro). O calendario apenas:

1. Captura a intencao via `onSelectSlot` (selecionar um intervalo livre) ou
   `onSelectEvent` (abrir um existente) e abre o Dialog.
2. O Dialog/servico valida antes de confirmar.

Regras de bloqueio (mensagens em `docs/product/10-estados-e-mensagens.md`):

- Sobreposicao com outro agendamento do mesmo profissional:
  "Este horario ja esta ocupado para [Profissional]." (acao bloqueada, sem
  "confirmar mesmo assim").
- Fora do expediente: "Horario fora do expediente para esta data."
- Sobre bloqueio: "Este horario esta bloqueado e nao aceita agendamento."

A remarcacao usa exatamente as mesmas validacoes (expediente, bloqueio,
sobreposicao); se houver conflito, a remarcacao e impedida.

## Criacao/edicao via Dialog (sem drag-and-drop)

Os modais de criar/editar usam o **Dialog do shadcn/ui** (Radix por baixo),
montados na tela da Agenda (client component). O calendario apenas emite a intencao
e a tela controla o estado de abertura do Dialog.

- `selectable` habilita a selecao de slots livres -> `onSelectSlot` abre o Dialog
  de **novo agendamento** ja com data, horario e profissional (resource)
  pre-preenchidos.
- `onSelectEvent` abre o Dialog de **detalhe/edicao** do agendamento (status,
  remarcacao, cancelamento, conclusao, no-show).
- O formulario dentro do Dialog usa React Hook Form + Zod (zodResolver), conforme
  o padrao de forms do CANON; as validacoes de conflito vivem no service.
- Drag-and-drop e resize NAO sao habilitados no MVP (o addon de DnD nao e usado).
  Mover horario/profissional = remarcacao via Dialog.
- Selecionar um slot sobre bloqueio ou fora do expediente nao abre o Dialog de
  criacao; mostra a mensagem correspondente (ex.: via toast sonner ou inline).

## Estados da Agenda

Alinhados a `docs/product/10-estados-e-mensagens.md`. Estes estados sao da Agenda,
alem dos estados de lista (carregando/erro simulado) que se aplicam ao carregar os
dados via hooks.

| Estado | Quando | O que mostrar |
| --- | --- | --- |
| Carregando | Hooks (TanStack Query) buscando os dados mockados. | Skeleton/spinner sobre a area do calendario; nao renderizar como "dia vazio". |
| Erro simulado | O mock simula falha. | "Nao foi possivel carregar os agendamentos. Tente novamente." + acao "Tentar novamente". |
| Dia sem agendamentos | O dia/periodo filtrado nao tem eventos. | Empty state: "Nenhum agendamento neste dia." + acao "Novo agendamento". |
| Profissional sem horarios livres | O profissional filtrado nao tem horario disponivel no periodo. | Aviso: "Sem horarios livres para [Profissional] neste periodo." + sugerir trocar data/profissional. |
| Horario bloqueado | Existe bloqueio cobrindo o horario. | Faixa destacada (background event) "Bloqueado" + motivo; nao aceita agendamento. |
| Conflito de horario | Acao tentaria sobrepor agendamento do mesmo profissional, cair fora do expediente ou sobre bloqueio. | Mensagem que impede a confirmacao (textos da secao "Conflito"). |

Notas de implementacao dos estados:

- O empty state do "dia sem agendamentos" e renderizado por cima/no lugar do grid
  quando a lista de eventos do periodo esta vazia (decidido na camada da tela, nao
  pelo calendario).
- "Profissional sem horarios livres" combina expediente do profissional + eventos
  + bloqueios; e calculado na camada de dados (helper de disponibilidade), nao no
  componente visual.

## Localizacao pt-BR (localizer date-fns)

Usar `dateFnsLocalizer` com locale pt-BR do date-fns. O localizer e criado no
modulo client da Agenda.

```ts
// conceitual; confirmar imports/assinatura na doc oficial
"use client";

import { dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "pt-BR": ptBR },
});
```

- Semana comeca na segunda? react-big-calendar usa `startOfWeek` do localizer;
  com pt-BR o padrao do date-fns coloca o inicio da semana no domingo. Como o
  domingo e fechado, podemos exibir a semana iniciando na segunda passando a
  opcao adequada ao `startOfWeek` (confirmar via opcoes do localizer/`culture`).
- Rotulos de toolbar, dias e meses devem aparecer em portugues. Textos fixos da UI
  (botoes "Hoje", "Anterior", "Proximo", nomes das views) podem ser traduzidos via
  a prop `messages` do calendario.
- Formatos de hora em 24h (ex.: `09:00`), coerente com o cenario brasileiro; ajustar
  via `formats` quando necessario.

## Expediente

Funcionamento da Corte Nobre - Matriz (`docs/product/08-barbearia-corte-nobre.md`):

| Dia | Funcionamento |
| --- | --- |
| Segunda a Sexta | 09:00 - 20:00 |
| Sabado | 08:00 - 18:00 |
| Domingo | Fechado |

Aplicacao na Agenda:

- `min`/`max` definem a faixa de horas dos time views. Como o expediente varia por
  dia (sabado abre as 08:00), usar a faixa mais ampla para nao cortar slots
  validos: `min = 08:00`, `max = 20:00`.
- O **expediente efetivo do dia** (e o do profissional) e destacado/desabilitado
  fora da faixa via `slotPropGetter` (estilo por slot) e/ou `dayPropGetter` (estilo
  por dia), marcando horas fora do expediente como nao agendaveis (cor neutra,
  cursor bloqueado).
- Domingo: dia fechado. Marcar como nao agendavel; selecionar slot no domingo cai na
  validacao "Horario fora do expediente para esta data."
- Horarios de trabalho por profissional (entidade Profissional:
  `horariosDeTrabalho`, dias de trabalho do CANON) refinam o expediente por coluna
  no day view: fora do horario do profissional tambem e nao agendavel, mesmo dentro
  do funcionamento da unidade. Ex.: Diego Santos trabalha Qua a Sab; nas seg/ter a
  coluna dele aparece como fora do expediente.

## Regras / Convencoes

- A Agenda e um client component (`'use client'`); o grid do calendario nao roda no
  servidor.
- A UI nunca le mocks direto: Agenda -> hooks (TanStack Query) -> services -> store
  em memoria. O componente de calendario recebe eventos ja mapeados e emite apenas
  intencoes (`onSelectSlot`, `onSelectEvent`, `onNavigate`, troca de view).
- Validacao de conflito/disponibilidade vive no service (e sera reexecutada pelo
  backend futuro), nunca no componente visual.
- Cores de status vem do design system do frontend (`frontend/04`); este doc nao
  fixa hex. Usar as variaveis CSS do design system (tokens `status.*` via Tailwind
  v4 + shadcn) por `className` no `eventPropGetter`, evitando cores hardcoded.
- Bloqueios = background events nao clicaveis; agendamentos = eventos clicaveis.
- Resources (colunas por profissional) so no day view; week/month usam filtro.
- Sem drag-and-drop no MVP; mover = remarcar via Dialog (shadcn).
- Datas/horas sempre via localizer date-fns pt-BR, 24h.
- Eventos cancelados/no-show: esmaecidos; ocultos por default no day/week (toggle),
  visiveis na tela Agendamentos.
- Series: ocorrencias sao eventos normais com badge de serie; acoes oferecem escopo
  "somente esta" / "esta e as futuras" quando ha `serieId`.

## Referencias de API (confirmar nas docs oficiais)

Props/conceitos citados (nomes exatos a confirmar em
https://bigcalendar.github.io/react-big-calendar/index.html):

- `localizer` / `dateFnsLocalizer` - localizacao pt-BR.
- `views` / `defaultView` / `view` / `date` / `onNavigate` - views e navegacao.
- `min` / `max` / `step` / `timeslots` - faixa de horas e granularidade.
- `resources` / `resourceIdAccessor` / `resourceTitleAccessor` - colunas por
  profissional no day view.
- `startAccessor` / `endAccessor` - mapeamento de inicio/fim do evento.
- `eventPropGetter` - estilo por evento (cor por status).
- `slotPropGetter` / `dayPropGetter` - estilo por slot/dia (expediente/bloqueio).
- `components` (ex.: `components.event`, `components.toolbar`) - overrides de render.
- background events (faixa de fundo) - bloqueios destacados.
- `selectable` / `onSelectSlot` / `onSelectEvent` - intencao de criar/abrir (Dialog).
- `messages` / `formats` - traducao de rotulos e formatos pt-BR.

## Pendencias

- Confirmar a assinatura exata dos accessors de resource e do getter de background
  events na doc oficial antes de implementar.
- Confirmar a estrategia de montagem client-only no Next (ex.: `dynamic` com
  `ssr: false` vs. guarda de `mounted`) para evitar mismatch de hidratacao.
- Definir o toggle de exibicao de cancelados/no-shows (default e local).
- Definir como o `startOfWeek` exibe a semana iniciando na segunda (opcao do
  localizer/`culture`) sem quebrar o domingo fechado.
- Definir o override do CSS base da lib com as variaveis CSS do design system
  (Tailwind v4 + shadcn) e como importa-lo no modulo client.
