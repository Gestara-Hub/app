# Rotas e Navegacao

## Decisao

O frontend usa Next.js 16 (App Router) com roteamento file-based por pastas em `src/app`. A navegacao principal vive em um app shell unico (sidebar + topbar) que envolve todas as telas autenticadas. A tela de login fica FORA do app shell. Uma guarda de sessao mockada em `src/proxy.ts` (Next 16: `proxy` substitui o antigo `middleware`) protege as telas autenticadas: sem cookie de sessao, o usuario e redirecionado para `/login`.

URLs e identificadores de codigo ficam em ingles (`/clients`, `/team`, `/schedule`, `/classes`, `/settings`...); os rotulos de navegacao ficam em portugues e **mudam conforme o modelo operacional do tenant** (ex.: "Clientes" na barbearia, "Alunos" na academia). "Equipe" e o rotulo de navegacao; "Profissional" e o termo de detalhe e de contexto de agendamento (ver `docs/product/03-modulos.md`).

## Contexto

- Stack e principios em `docs/frontend/00-estrategia-frontend.md`.
- A camada de dados e mockada: UI -> hooks (TanStack Query) -> services tipados -> store em memoria. As telas carregam dados via hooks/services em client components.
- Server actions existem so para a sessao (`src/app/(auth)/actions.ts`); nao ha route handlers de dados.
- Multi-tenant e modelo por tenant: `docs/technical/03-multi-tenant-e-escopo.md`. Perfis: `docs/product/06-perfis-permissoes.md`.
- Doc oficial do roteador: https://nextjs.org/docs/app

## Escopo

- Tabela de rotas e seus params.
- Estrutura de arquivos no App Router (route groups, layouts, segmentos dinamicos).
- App shell (sidebar + topbar), login fora do shell.
- Guarda de sessao mockada e RBAC por rota.
- Navegacao por modelo operacional e permissao.

## Fora de escopo

- Route handlers de dados e data fetching no servidor (fase 3, backend).
- Autenticacao real, tokens, refresh. No MVP a sessao e mockada: o cookie guarda as claims do usuario (o `UserView`), espelhando um futuro token assinado.
- Tela de gestao de permissoes (matriz editavel) e enforcement server-side de dados.
- Rotas de modulos futuros (Unidades, Relatorios, `delivery`).

## Tabela de rotas

| URL | Tela | Modelo | Permissao (page) | Descricao |
|-----|------|--------|------------------|-----------|
| `/login` | Login | — | publica | Escolha de um usuario demo; grava a sessao. |
| `/` | Dashboard | todos | `dashboard:view` | Dashboard, muda por modelo. |
| `/clients` | Clientes / Alunos | todos | `clients:view` | Lista e cadastro. |
| `/team` | Equipe | todos | `team:view` | Profissionais / instrutores e cargos. |
| `/services` | Serviços | `scheduling` | `services:view` | Catalogo de servicos. |
| `/schedule` | Agenda | `scheduling` | — | Abas Calendário (Dia/Semana/Mês, colunas por profissional) e Lista. |
| `/appointments` | — | `scheduling` | — | Redireciona para `/schedule` (links antigos). |
| `/classes` | Turmas | `classes` | `classes:view` | Lista de turmas. |
| `/classes/[id]` | Detalhe da turma | `classes` | `classes:view` | Matriculas, lista de espera. |
| `/classes/sessions/[sessionId]` | Aula | `classes` | `classes:view` | Chamada, reservas, instrutor substituto. |
| `/classes/calendar` | Calendário | `classes` | `classes:view` | Grade semanal das aulas. |
| `/classes/modalities` | Modalidades | `classes` | `classes:manage` | Categorias da academia. |
| `/classes/plans` | Planos | `classes` | `billing:view` | Planos de mensalidade. |
| `/classes/billing` | Mensalidades | `classes` | `billing:view` | Cobrancas por competencia. |
| `/users` | Usuários | todos | `users:view` | Usuarios e perfis. |
| `/audit` | Auditoria | todos | `audit:view` | Log de auditoria. |
| `/settings` | Configurações | todos | `settings:view` | Organizacao, unidade, horarios, regras de cobranca, "Zerar mocks". |

Notas:

- Nao ha rotas de "novo/editar": criar/editar acontece em dialogos sobre a lista ou detalhe (decisao tomada; ver `docs/frontend/04` e `docs/frontend/06`).
- A Agenda nao usa segmento de data na URL; data, profissional e modo sao estado de UI.

## Estrutura de arquivos (App Router)

```
src/
  proxy.ts                     # guarda de sessao (cookie) + matcher
  app/
    layout.tsx                 # root layout: <html>, Providers, <Toaster/>, boot do tema
    globals.css
    (auth)/                    # route group SEM shell
      actions.ts               # "use server": signIn, switchUser, signOut
      login/
        page.tsx               # /login (redireciona se ja houver usuario valido)
        login-form.tsx
    (app)/                     # route group COM shell
      layout.tsx               # getCurrentUser + SessionProvider + Sidebar/Topbar
      page.tsx                 # /
      clients/ team/ services/ schedule/ appointments/
      classes/                 # page.tsx, [id]/, sessions/[sessionId]/,
                               # calendar/, modalities/, plans/, billing/
      users/ audit/ settings/
```

Observacoes:

- `(auth)` e `(app)` sao route groups: nao entram na URL.
- O app shell e renderizado uma vez em `(app)/layout.tsx`; o `SidebarProvider` recebe `key={user.organizationId}` para remontar ao trocar de organizacao.
- Cada `page.tsx` e uma casca server que chama `requirePermission(...)` e renderiza a view da feature.

## App shell: sidebar + topbar

Itens em `src/components/layout/nav.ts`:

- `MAIN_NAV`: Dashboard, Clientes (`scheduling`/`delivery`), Alunos (`classes`), Equipe, Serviços (`scheduling`), Agenda (`scheduling`), Turmas, Calendário, Modalidades, Planos, Mensalidades (`classes`).
- `FOOTER_NAV` (rodape): Usuários, Auditoria, Configurações.
- Cada `NavItem` tem `label`, `href`, `icon`, `permission`, `models?` (ausente = compartilhado) e `tourId?` (alvo do tour de onboarding).

Helpers:

- `navForModel(items, model)`: filtra pelo modelo do tenant. A sidebar (`app-sidebar.tsx`) aplica `navForModel` e depois `can(item.permission)`.
- `isNavItemActive(pathname, href)`: `/` exato; demais por prefixo (detalhes mantem o item-pai ativo).
- `firstAllowedRoute(user, model)`: destino pos-login/troca e ao negar acesso (Dashboard se permitido; senao a rota nucleo do modelo, `/schedule` ou `/classes/calendar`; senao o primeiro item permitido).
- `canAccessRoute(user, pathname, model)`: usado pelo `signIn` para validar o destino `?from=`; rota de outro modelo e barrada.

Topbar (`app-topbar.tsx`):

- Nome da unidade ativa.
- Alternar modo claro/escuro e o personalizador de tema (`components/theme/theme-customizer.tsx`).
- Menu do usuario: nome + perfil, secao "Trocar usuário / organização (demo)" (lista de `usersService.listForSwitch`, submete `switchUser`) e "Sair" (`signOut`).

Login fora do shell:

- `/login` renderiza sob `(auth)`, sem sidebar nem topbar, e lista os usuarios demo de todas as organizacoes. Escolher um usuario chama `signIn(user, from)`, que grava o cookie e redireciona para `from` (se permitido) ou para `firstAllowedRoute`.

## Guarda de rota (mock)

`src/proxy.ts` exporta `proxy(request)` e `config.matcher` (tudo, exceto `api`, `_next/static`, `_next/image`, `favicon.ico` e imagens):

- Sem o cookie `gestarahub_session` fora de `/login`: redireciona para `/login?from=<pathname>`.
- Com cookie: segue. O proxy so checa presenca; a page `/login` decide se redireciona (evita loop com cookie invalido).

Sessao (`src/lib/session.ts` e `src/app/(auth)/actions.ts`):

- Cookie `gestarahub_session` = `UserView` em JSON base64 (`encodeSession`/`decodeSession`), `httpOnly`, `sameSite: "lax"`, `path: "/"`, 7 dias (`SESSION_MAX_AGE`).
- `signIn`, `switchUser` (trocar usuario troca de organizacao) e `signOut` sao server actions.
- No servidor, `getCurrentUser()` (`features/auth/get-current-user.ts`) le as claims do cookie. No cliente, o `SessionProvider` expoe `useCurrentUser`, `useCan` e `useModel`, e ativa o tenant do usuario no store (`setActiveOrganization`). Nao existe `authService`.
- Os dados de dominio persistem no localStorage (ver `docs/frontend/02`); a sessao persiste no cookie. Ambos sobrevivem ao reload.

Controle por perfil:

- A guarda do proxy e binaria (logado x deslogado).
- O `(app)/layout.tsx` resolve o usuario (redireciona para `/login` se ausente) e o modelo do tenant.
- As pages chamam `requirePermission(permission)`, que redireciona para `firstAllowedRoute` quando negado.
- A sidebar e as acoes filtram por permissao (`can`/`useCan`). Ver `docs/product/06-perfis-permissoes.md`.

## Agenda (Modelo 1)

`/schedule` e a tela unica da agenda com duas abas: **Calendário** (Dia/Semana/Mês, colunas por profissional no dia, bloqueios destacados) e **Lista** (busca e filtros). O calendario e feito a mao (`features/appointments/components/calendar-panel.tsx`, `schedule-day-grid.tsx`); `react-big-calendar` foi descartado. As acoes (criar, remarcar, mudar status, cancelar, bloquear, serie) sao compartilhadas entre as abas e o Dashboard e abrem em dialogos.

## Mapa rota -> fluxos

| URL | Fluxos |
|-----|--------|
| `/login` | Login mockado (escolha de usuario demo). |
| `/` | Abrir o dia. |
| `/schedule` | Criar, remarcar, mudar status, bloquear, serie recorrente (`docs/product/09-fluxos-principais.md`). |
| `/clients` | Cadastrar/editar cliente ou aluno (na academia, com plano e 1a cobranca). |
| `/team`, `/services` | Cadastros de equipe e servicos. |
| `/classes/*` | Turmas, matriculas, chamada, reservas, planos e mensalidades (`docs/product/11-modelo-3-turmas.md`, `docs/product/15-regras-de-cobranca.md`). |
| `/users`, `/audit`, `/settings` | Administracao. |

## Regras / Convencoes

- Rotas protegidas sob `(app)`; publicas sob `(auth)`. Login e a unica tela publica.
- URLs e identificadores em ingles; rotulos em portugues. Segmentos dinamicos `[param]`.
- Navegacao com `next/link` ou `useRouter()`, nunca `<a href>` manual para rotas internas.
- Toda rota nova entra em `nav.ts` (com `permission` e `models`) e chama `requirePermission` na page. Ver a skill `web-feature`.

## Pendencias

- Resolvidas: modal x rota (dialogos), API do proxy (implementada), redirect pos-login (`?from=`), flags do cookie (`httpOnly`, `sameSite: "lax"`).
- Aberta: persistir filtros da Agenda/Calendário em search params para deep-linking.
