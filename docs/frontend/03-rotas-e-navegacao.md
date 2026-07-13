# Rotas e Navegacao

## Decisao

O frontend do MVP usa Next.js (App Router, RSC) com roteamento file-based por pastas em `src/app`. A navegacao principal vive em um app shell unico (sidebar + topbar) que envolve todas as telas autenticadas. A tela de login fica FORA do app shell. Uma guarda de sessao mockada protege as telas autenticadas via `middleware.ts` (cookie de sessao): sem sessao mockada ativa, o usuario e redirecionado para `/login`.

URLs e identificadores de codigo ficam em ingles (slugs `/services`, `/clients`, `/team`, `/schedule`, `/appointments`, `/settings`); os rotulos de navegacao seguem a linguagem unica do MVP em portugues: Dashboard, Agenda, Agendamentos, Clientes, Equipe, Servicos, Configuracoes. "Equipe" e o rotulo de navegacao; "Profissional" e o termo de detalhe e de contexto de agendamento (ver `docs/product/03-modulos.md`).

## Contexto

- Stack e principios em `docs/frontend/00-estrategia-frontend.md` e no STACK CANON do projeto.
- A camada de dados e mockada: UI -> hooks (TanStack Query) -> services tipados -> store em memoria. As rotas NAO acessam mocks direto; quando carregam dados, fazem via hooks/services em client components.
- No MVP frontend-first NAO usamos server actions nem route handlers de dados; o roteamento e SSR ficam disponiveis pelo Next, mas o data fetching roda no cliente via TanStack Query sobre o service mockado. As paginas que consomem dados sao client components (`"use client"`).
- Modulos e telas: `docs/product/03-modulos.md`. Entidades e campos: `docs/product/04-mvp-barbearia.md`. Fluxos/jornadas: `docs/product/09-fluxos-principais.md`. Estados e validacoes: `docs/product/10-estados-e-mensagens.md`.
- Doc oficial do roteador: https://nextjs.org/docs/app

## Escopo

- Definir a tabela de rotas do MVP e seus params (URLs em ingles).
- Definir a estrutura de arquivos no App Router (route groups, layouts, segmentos dinamicos).
- Definir o app shell (sidebar + topbar) e a relacao login fora do shell.
- Definir a guarda de sessao mockada via `middleware.ts` (cookie + redirect para `/login`).
- Definir a relacao Agenda (calendario) x Agendamentos (lista).
- Mapear cada rota aos fluxos de `docs/product/09-fluxos-principais.md`.

## Fora de escopo

- Server actions, route handlers de dados e data fetching no servidor (reservados para a fase 3, backend do zero).
- Autenticacao real, tokens, refresh. No MVP a sessao e mockada (cookie guarda as claims do usuario — o `UserView` —, espelhando um futuro token assinado).
- Tela de gestao de permissoes (matriz editavel) e enforcement server-side de dados. O MVP JA aplica RBAC na navegacao, nas acoes e nas rotas restritas (client + guarda no `(app)/layout.tsx`/pages), com escopo de dados UI-only para o perfil Profissional (ver `docs/product/06-perfis-permissoes.md`).
- Rotas de modulos futuros (Unidades, Relatorios, Financeiro etc.).
- Deep-linking de modais (ex.: `?modal=novo-agendamento`) como contrato fixo; fica como pendencia.

## Tabela de rotas

| URL | Tela | Tipo | Shell | Descricao |
|-----|------|------|-------|-----------|
| `/login` | Login | Publica | Fora do shell | Login mockado; cria sessao simulada (cookie). |
| `/` | Dashboard | Protegida | Dentro do shell | Dashboard operacional do dia (abrir o dia). |
| `/schedule` | Agenda | Protegida | Dentro do shell | Calendario (dia/semana/mes) com filtro por profissional. |
| `/appointments` | Agendamentos | Protegida | Dentro do shell | Lista/tabela de agendamentos, filtros e busca. |
| `/clients` | Clientes | Protegida | Dentro do shell | Lista e busca de clientes. |
| `/clients/[id]` | Detalhe do cliente | Protegida | Dentro do shell | Dados do cliente + historico de agendamentos. |
| `/team` | Equipe | Protegida | Dentro do shell | Lista de profissionais. |
| `/team/[id]` | Detalhe do profissional | Protegida | Dentro do shell | Dados do profissional, servicos realizados, disponibilidade. |
| `/services` | Servicos | Protegida | Dentro do shell | Lista de servicos por categoria. |
| `/settings` | Configuracoes | Protegida | Dentro do shell | Dados mockados da organizacao/unidade e horarios. |

Notas:

- `[id]` e a sintaxe de segmento dinamico do App Router (pasta `[id]/page.tsx`). O valor chega via prop `params` da page (ou pelo hook `useParams()` em client components). Ver https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes
- O MVP nao define rotas de "novo/editar" separadas (ex.: `/clients/new`). Criar/editar cliente, servico, profissional e agendamento acontecem em modal/painel (Dialog/Sheet do shadcn) sobre a tela de lista ou detalhe, mantendo a rota base. A decisao final de modal x rota dedicada fica em Pendencias.
- A Agenda nao usa segmento de data na URL no MVP; data e profissional sao estado de UI/filtro. Persistir esses filtros via search params (`?date=...&professionalId=...`) e uma evolucao possivel (ver Pendencias).

## Estrutura de arquivos (App Router)

A organizacao segue a convencao do App Router do Next (ver https://nextjs.org/docs/app/building-your-application/routing). Usamos route groups (pastas entre parenteses, que NAO entram na URL) para separar o que esta fora do shell (`(auth)`) do que esta dentro do shell protegido (`(app)`).

```
src/
  middleware.ts                # guarda de sessao mockada (cookie) protegendo (app)/*
  app/
    layout.tsx                 # root layout: <html>, Providers (QueryClient, ThemeProvider), <Toaster/>, globals.css
    globals.css                # Tailwind v4 + variaveis CSS do shadcn (tema)
    not-found.tsx              # pagina 404
    (auth)/                    # route group SEM shell (telas publicas)
      login/
        page.tsx               # /login
    (app)/                     # route group COM shell (sidebar + topbar)
      layout.tsx               # app shell (Sidebar + Topbar) + (opcional) reforco da guarda
      page.tsx                 # /              -> Dashboard
      schedule/
        page.tsx               # /schedule
      appointments/
        page.tsx               # /appointments
      clients/
        page.tsx               # /clients
        [id]/
          page.tsx             # /clients/[id]
      team/
        page.tsx               # /team
        [id]/
          page.tsx             # /team/[id]
      services/
        page.tsx               # /services
      settings/
        page.tsx               # /settings
```

Observacoes:

- `(auth)` e `(app)` sao route groups: agrupam telas e permitem um layout comum sem adicionar segmento na URL. A URL final continua sendo `/login`, `/`, `/schedule` etc.
- O app shell (sidebar + topbar) e renderizado uma unica vez em `(app)/layout.tsx`, com `{children}` para a tela ativa. Trocar de aba nao remonta o shell.
- A guarda de sessao mockada vive no `middleware.ts` (executa antes da renderizacao). O `(app)/layout.tsx` pode opcionalmente reforcar a checagem, mas a protecao primaria e o middleware.
- O root `app/layout.tsx` carrega os Providers globais (QueryClientProvider, ThemeProvider, `<Toaster/>` do sonner) e o `globals.css`; ele envolve tanto `(auth)` quanto `(app)`.

## App shell: sidebar + topbar

O app shell e o container das telas autenticadas, vive em `(app)/layout.tsx`. Implementado com shadcn/ui + Tailwind CSS v4; icones lucide-react.

Sidebar (navegacao primaria), itens na ordem (rotulo PT -> URL):

1. Dashboard -> `/`
2. Agenda -> `/schedule`
3. Agendamentos -> `/appointments`
4. Clientes -> `/clients`
5. Equipe -> `/team`
6. Servicos -> `/services`
7. Configuracoes -> `/settings`

Regras da sidebar:

- Links usam `next/link` (`<Link href="...">`); nunca `<a href>` manual para rotas internas.
- O item ativo deriva da rota atual via `usePathname()` (hook de client component). O componente da sidebar e client (`"use client"`).
- Telas de detalhe mantem o item-pai ativo: `/clients/[id]` mantem "Clientes" ativo; `/team/[id]` mantem "Equipe" ativo. Para itens com filhos, o ativo e determinado por prefixo (ex.: `pathname.startsWith("/clients")`); a Dashboard (`/`) usa correspondencia exata para nao ficar sempre ativa.
- "Equipe" e o rotulo fixo do item; nada de "Profissionais" na navegacao (ver `docs/product/03-modulos.md`).

Esboco conceitual do item ativo:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Dashboard", href: "/", exact: true },
  { label: "Agenda", href: "/schedule" },
  { label: "Agendamentos", href: "/appointments" },
  { label: "Clientes", href: "/clients" },
  { label: "Equipe", href: "/team" },
  { label: "Servicos", href: "/services" },
  { label: "Configuracoes", href: "/settings" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}
```

Topbar:

- Contexto da organizacao/unidade mockada selecionada (Corte Nobre / Corte Nobre - Matriz).
- Acao rapida de "Novo agendamento" (atalho para o Fluxo 3), quando fizer sentido.
- Identificacao do usuario logado (nome + perfil), acao de "Trocar usuario" (alterna entre os usuarios mockados, sem logout) e "Sair" (limpa o cookie e volta para `/login`).

Login fora do shell:

- `/login` renderiza sob o route group `(auth)`, sem sidebar nem topbar.
- Apos login bem-sucedido, grava o cookie de sessao e redireciona para `/` (dashboard), entrando em `(app)` (Fluxo 1).

## Guarda de rota (mock)

Objetivo: impedir acesso as telas protegidas sem sessao mockada e redirecionar para `/login`.

Mecanismo: `src/middleware.ts` le um cookie de sessao mockada e protege os caminhos do grupo `(app)`. Como route groups nao aparecem na URL, o matcher do middleware mira nas URLs reais (tudo que NAO for `/login`, assets do Next e estaticos). Ver https://nextjs.org/docs/app/building-your-application/routing/middleware

- A sessao mockada e representada por um cookie simples (ex.: `gh_session`), gravado no login e removido no logout. Mantido simples por ser mock.
- O middleware roda antes da renderizacao de qualquer rota protegida: se NAO ha cookie de sessao, redireciona para `/login`, preservando o destino pretendido em `?redirect=`.
- Se ha sessao: segue para a rota solicitada.
- A rota `/login` faz o caminho inverso: se ja houver sessao, o middleware (ou a propria page) redireciona para `/` para evitar relogar.
- A leitura de dados de dominio continua via service mockado de auth (ex.: `authService.getSession()`) nos client components; o cookie e apenas o sinal usado pela guarda no middleware (coerente com "mocks como contrato de API").

Esboco conceitual do middleware:

```ts
// src/middleware.ts (conceitual; confirmar API na doc vigente do Next)
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get("gh_session")?.value);
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/login";

  if (!hasSession && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // protege tudo, exceto assets internos e arquivos estaticos
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

Notas:

- No MVP a sessao e mockada via cookie; por viver no cookie (e nao so no store em memoria), sobrevive ao reload, evitando retorno forcado ao `/login`. O store de dados em memoria, esse sim, reinicia no reload.
- A guarda de sessao (proxy/middleware) e binaria (logado x deslogado). O controle por PERFIL vive no `(app)/layout.tsx` (resolve o usuario e monta o SessionProvider) e nas pages protegidas via `requirePermission` (ex.: Dashboard, Configuracoes), que redirecionam para a primeira rota acessivel do perfil quando o acesso e negado. A sidebar tambem filtra os itens por permissao. Ver `docs/product/06-perfis-permissoes.md`.
- O `(app)/layout.tsx` pode reforcar a guarda (defesa em profundidade), mas o middleware e a protecao primaria.

## Relacao Agenda (calendario) x Agendamentos (lista)

Agenda e Agendamentos sao duas VISOES da MESMA entidade Agendamento (ver `docs/product/03-modulos.md` e `docs/product/04-mvp-barbearia.md`):

- `/schedule` (Agenda): visao de calendario em dia, semana e mes, com filtro por profissional e colunas por profissional no day view (react-big-calendar, client component). E a tela operacional para enxergar a grade de horarios, bloqueios destacados e criar agendamento em um slot livre.
- `/appointments` (Agendamentos): visao em lista/tabela da mesma entidade, para buscar, filtrar (status, profissional, periodo, cliente), ordenar por data/horario e revisar sem navegar por datas. Tambem agrupa/visualiza ocorrencias de uma serie por `serieId`.

Regras da relacao:

- As acoes (criar, editar, remarcar, cancelar, mudar status) sao COMPARTILHADAS entre as duas telas; mudam o mesmo Agendamento e refletem em ambas (e no Dashboard).
- O detalhe do agendamento e acessivel a partir das duas visoes (Agenda, Agendamentos) e tambem do Dashboard. No MVP o detalhe pode abrir como modal/painel (Dialog/Sheet) sobre a tela atual, sem rota dedicada (ver Pendencias sobre `/appointments/[id]`).
- Como sao a mesma fonte de dados via service mockado + TanStack Query, alterar o status na lista atualiza a agenda e vice-versa (invalidacao de query por chave).

## Mapa rota -> fluxos (docs/product/09)

| URL | Fluxos de `docs/product/09-fluxos-principais.md` |
|-----|---------------------------------------------------|
| `/login` | Fluxo 1 (Login mockado). |
| `/` (Dashboard) | Fluxo 2 (Abrir o dia); ponto de partida para Fluxo 5 (mudar status a partir dos proximos atendimentos) e atalho para Fluxo 3. |
| `/schedule` | Fluxo 3 (Criar agendamento), Fluxo 4 (Remarcar), Fluxo 5 (Mudar status), Fluxo 6 (Bloquear horario), Fluxo 7 (Criar serie recorrente). |
| `/appointments` | Fluxo 4 (Remarcar), Fluxo 5 (Mudar status); revisao/filtragem e agrupamento de series; entrada para o detalhe do agendamento. |
| `/clients` | Fluxo 8 (Cadastrar/editar Cliente - cadastrar), Fluxo 11 (Buscar cliente). |
| `/clients/[id]` | Fluxo 11 (Ver historico), Fluxo 8 (editar/inativar); atalho para Fluxo 3 (novo agendamento para o cliente). |
| `/team` | Fluxo 10 (Cadastrar profissional). |
| `/team/[id]` | Fluxo 10 (editar/inativar profissional; servicos realizados; disponibilidade). |
| `/services` | Fluxo 9 (Cadastrar/editar Servico). |
| `/settings` | Sem fluxo dedicado em `docs/product/09`; exibe dados mockados de organizacao/unidade e horarios (ver Modulo Configuracoes Basicas em `docs/product/03-modulos.md`). |

Observacao: Fluxos 3, 4, 5, 6 e 7 sao iniciados predominantemente pela Agenda, mas as acoes de status (Fluxo 5) e remarcacao (Fluxo 4) tambem partem de Agendamentos e do Dashboard, porque operam sobre o mesmo Agendamento.

## Regras / Convencoes

- Rotas protegidas vivem sob o route group `(app)` (com shell, protegidas pelo middleware); rotas publicas sob `(auth)` (sem shell). Login e a unica tela publica do MVP.
- URLs e identificadores de codigo em ingles; rotulos de UI em portugues. Segmentos dinamicos usam a sintaxe `[param]` do App Router (ex.: `[id]`); leitura via prop `params` da page ou `useParams()` em client components.
- Navegacao entre telas usa `next/link` (`<Link>`) ou navegacao programatica via `useRouter()` do `next/navigation`, nunca `<a href>` manual para rotas internas.
- Telas que carregam dados o fazem em client components via hooks (TanStack Query) sobre services mockados; rotas/paginas nao leem o store em memoria diretamente.
- O item ativo da sidebar deriva da rota atual via `usePathname()`; rotas de detalhe mantem o item-pai destacado por prefixo, com a Dashboard (`/`) em correspondencia exata.
- Redirects (guarda no middleware e pos-login) usam `NextResponse.redirect` / `redirect()` do Next; assinaturas exatas confirmadas na doc oficial.

## Pendencias

- Definir se criar/editar (cliente, servico, profissional, agendamento) usa modal/painel (Dialog/Sheet) sobre a lista/detalhe OU rota dedicada (ex.: `/clients/new`, `/appointments/[id]`). Recomendacao inicial: modal/painel no MVP.
- Decidir se o detalhe de agendamento ganha rota propria (`/appointments/[id]`) ou permanece como modal compartilhado entre Agenda, Agendamentos e Dashboard.
- Definir persistencia de filtros/estado da Agenda (data, profissional, modo dia/semana/mes) via search params (`useSearchParams` / `URLSearchParams`) para deep-linking.
- Confirmar a API exata do middleware (matcher, leitura de cookie, `NextResponse.redirect`) na versao vigente do Next antes de implementar.
- Definir o comportamento de redirect pos-login quando houver `redirect` no search (voltar ao destino pretendido).
- Avaliar se o cookie de sessao mockada precisa de flags (httpOnly/sameSite) ou se basta um cookie simples legivel no cliente para o MVP.
```