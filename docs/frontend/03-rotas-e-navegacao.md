# Rotas e Navegacao

## Decisao

O frontend do MVP usa TanStack Router com roteamento file-based e type-safe sobre o TanStack Start. A navegacao principal vive em um app shell unico (sidebar + topbar) que envolve todas as telas autenticadas. A tela de login fica FORA do app shell. Uma guarda de rota mockada protege as telas autenticadas: se nao houver sessao mockada ativa, o usuario e redirecionado para `/login`.

Os rotulos de navegacao seguem a linguagem unica do MVP: Dashboard, Agenda, Agendamentos, Clientes, Equipe, Servicos, Configuracoes. "Equipe" e o rotulo de navegacao; "Profissional" e o termo de detalhe e de contexto de agendamento (ver `docs/product/03-modulos.md`).

## Contexto

- Stack e principios em `docs/frontend/00-estrategia-frontend.md` e no STACK CANON do projeto.
- A camada de dados e mockada: UI -> hooks (TanStack Query) -> services tipados -> store em memoria. As rotas NAO acessam mocks direto; quando carregam dados, fazem via hooks/services.
- No MVP frontend-first NAO usamos server functions; o roteamento e SSR ficam disponiveis pelo TanStack Start, mas data fetching roda no cliente via TanStack Query sobre o service mockado.
- Modulos e telas: `docs/product/03-modulos.md`. Entidades e campos: `docs/product/04-mvp-barbearia.md`. Fluxos/jornadas: `docs/product/09-fluxos-principais.md`. Estados e validacoes: `docs/product/10-estados-e-mensagens.md`.
- Doc oficial do roteador: https://tanstack.com/router/latest/docs/framework/react/overview

## Escopo

- Definir a tabela de rotas do MVP e seus params.
- Definir o app shell (sidebar + topbar) e a relacao login fora do shell.
- Definir a guarda de rota mockada (checagem de sessao + redirect para `/login`).
- Definir a relacao Agenda (calendario) x Agendamentos (lista).
- Mapear cada rota aos fluxos de `docs/product/09-fluxos-principais.md`.

## Fora de escopo

- Server functions e data loaders no servidor (reservados para a fase 3, backend do zero).
- Autenticacao real, tokens, refresh, RBAC por rota. No MVP a sessao e mockada e o usuario logado e tratado como Proprietario/Admin.
- Permissoes finas por rota/acao (ver `docs/product/06-perfis-permissoes.md`); o MVP nao bloqueia rotas por perfil.
- Rotas de modulos futuros (Unidades, Relatorios, Financeiro etc.).
- Deep-linking de modais (ex.: `?modal=novo-agendamento`) como contrato fixo; fica como pendencia.

## Tabela de rotas

| Rota | Tela | Tipo | Shell | Descricao |
|------|------|------|-------|-----------|
| `/login` | Login | Publica | Fora do shell | Login mockado; cria sessao simulada. |
| `/` | Dashboard | Protegida | Dentro do shell | Dashboard operacional do dia (abrir o dia). |
| `/agenda` | Agenda | Protegida | Dentro do shell | Calendario (dia/semana/mes) com filtro por profissional. |
| `/agendamentos` | Agendamentos | Protegida | Dentro do shell | Lista/tabela de agendamentos, filtros e busca. |
| `/clientes` | Clientes | Protegida | Dentro do shell | Lista e busca de clientes. |
| `/clientes/$id` | Detalhe do cliente | Protegida | Dentro do shell | Dados do cliente + historico de agendamentos. |
| `/equipe` | Equipe | Protegida | Dentro do shell | Lista de profissionais. |
| `/equipe/$id` | Detalhe do profissional | Protegida | Dentro do shell | Dados do profissional, servicos realizados, disponibilidade. |
| `/servicos` | Servicos | Protegida | Dentro do shell | Lista de servicos por categoria. |
| `/configuracoes` | Configuracoes | Protegida | Dentro do shell | Dados mockados da organizacao/unidade e horarios. |

Notas:

- `$id` e a sintaxe de path param dinamico do TanStack Router (file-based: arquivo/segmento `$id`). O valor fica tipado e acessivel pelos params da rota. Ver https://tanstack.com/router/latest/docs/framework/react/guide/path-params
- O MVP nao define rotas de "novo/editar" separadas (ex.: `/clientes/novo`). Criar/editar cliente, servico, profissional e agendamento acontecem em modal/painel sobre a tela de lista ou detalhe, mantendo a rota base. A decisao final de modal x rota dedicada fica em Pendencias.
- A Agenda nao usa param de data na URL no MVP; data e profissional sao estado de UI/filtro. Persistir esses filtros via search params e uma evolucao possivel (ver Pendencias).

## Arvore de rotas (file-based, conceitual)

A organizacao exata dos arquivos segue a convencao do TanStack Router (ver https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing). O modelo abaixo e conceitual e usa rotas pathless de layout (prefixo `_`) para separar o que esta fora do shell (`_auth`) do que esta dentro do shell protegido (`_app`).

```
src/routes/
  __root.tsx               # raiz: providers globais, <Outlet/>
  _auth.tsx                # layout SEM shell (login e telas publicas)
  _auth/
    login.tsx              # /login
  _app.tsx                 # layout COM shell (sidebar + topbar) + guarda de sessao
  _app/
    index.tsx              # /            -> Dashboard
    agenda.tsx             # /agenda
    agendamentos.tsx       # /agendamentos
    clientes/
      index.tsx            # /clientes
      $id.tsx              # /clientes/$id
    equipe/
      index.tsx            # /equipe
      $id.tsx              # /equipe/$id
    servicos.tsx           # /servicos
    configuracoes.tsx      # /configuracoes
```

Observacoes:

- `_auth` e `_app` sao layout routes pathless: agrupam telas e aplicam um layout comum sem adicionar segmento na URL. A URL final continua sendo `/login`, `/`, `/agenda` etc.
- O app shell (sidebar + topbar) e renderizado uma unica vez em `_app.tsx`, com um `<Outlet/>` para a tela ativa. Trocar de aba nao remonta o shell.
- A guarda de sessao mockada e aplicada no nivel de `_app` (uma vez), protegendo todas as telas filhas de uma so vez.
- Nomes de arquivos sao ilustrativos; a API exata (e o uso de `createFileRoute`) deve seguir a doc oficial vigente do TanStack Router.

## App shell: sidebar + topbar

O app shell e o container das telas autenticadas. Implementado com Chakra UI v3.

Sidebar (navegacao primaria), itens na ordem:

1. Dashboard -> `/`
2. Agenda -> `/agenda`
3. Agendamentos -> `/agendamentos`
4. Clientes -> `/clientes`
5. Equipe -> `/equipe`
6. Servicos -> `/servicos`
7. Configuracoes -> `/configuracoes`

Regras da sidebar:

- O item ativo e destacado conforme a rota corrente (estado ativo do link do roteador).
- Telas de detalhe mantem o item-pai ativo: `/clientes/$id` mantem "Clientes" ativo; `/equipe/$id` mantem "Equipe" ativo.
- "Equipe" e o rotulo fixo do item; nada de "Profissionais" na navegacao (ver `docs/product/03-modulos.md`).

Topbar:

- Contexto da organizacao/unidade mockada selecionada (Corte Nobre / Corte Nobre - Matriz).
- Acao rapida de "Novo agendamento" (atalho para o Fluxo 3), quando fizer sentido.
- Identificacao do usuario logado (Proprietario/Admin mockado) e acao de "Sair" (encerra a sessao mockada e volta para `/login`).

Login fora do shell:

- `/login` renderiza sob `_auth`, sem sidebar nem topbar.
- Apos login bem-sucedido, redireciona para `/` (dashboard), entrando no `_app` (Fluxo 1).

## Guarda de rota (mock)

Objetivo: impedir acesso as telas protegidas sem sessao mockada e redirecionar para `/login`.

Conceito (mantido conceitual; a API exata de guarda/`beforeLoad`/`redirect` deve seguir a doc oficial: https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes):

- A sessao mockada e exposta por um service de auth mockado (ex.: `authService.getSession()`), coerente com o principio "mocks como contrato de API". A guarda le essa sessao; nao acessa o store direto.
- A guarda roda no layout `_app` (antes de renderizar qualquer tela protegida).
- Se NAO ha sessao: redireciona para `/login`, idealmente preservando o destino pretendido para retornar apos o login (ex.: search param `redirect`).
- Se ha sessao: segue para a tela solicitada.
- A rota `/login`, sob `_auth`, faz o caminho inverso: se ja houver sessao ativa, redireciona para `/` para evitar relogar.

Esboco conceitual (assinaturas ilustrativas, confirmar na doc oficial):

```ts
// Pseudocodigo conceitual da guarda no layout _app
// Confirmar API exata (beforeLoad, throw redirect) na doc do TanStack Router.
function appBeforeLoad({ location }: { location: { href: string } }) {
  const session = authService.getSession(); // service mockado
  if (!session) {
    throw redirect({
      to: "/login",
      search: { redirect: location.href },
    });
  }
}
```

```ts
// Pseudocodigo conceitual no /login: nao deixar relogar
function loginBeforeLoad() {
  const session = authService.getSession();
  if (session) {
    throw redirect({ to: "/" });
  }
}
```

Notas:

- No MVP a sessao e volatil (reinicia no reload do store em memoria). Se o estado mockado nao persistir, recarregar a pagina pode levar o usuario de volta ao `/login` ate refazer o login mockado; comportamento aceitavel no MVP.
- A guarda NAO faz controle por perfil; o usuario logado e sempre tratado como Proprietario/Admin (ver `docs/product/06-perfis-permissoes.md`).

## Relacao Agenda (calendario) x Agendamentos (lista)

Agenda e Agendamentos sao duas VISOES da MESMA entidade Agendamento (ver `docs/product/03-modulos.md` e `docs/product/04-mvp-barbearia.md`):

- `/agenda` (Agenda): visao de calendario em dia, semana e mes, com filtro por profissional e colunas por profissional no day view (react-big-calendar). E a tela operacional para enxergar a grade de horarios, bloqueios destacados e criar agendamento em um slot livre.
- `/agendamentos` (Agendamentos): visao em lista/tabela da mesma entidade, para buscar, filtrar (status, profissional, periodo, cliente), ordenar por data/horario e revisar sem navegar por datas. Tambem agrupa/visualiza ocorrencias de uma serie por `serieId`.

Regras da relacao:

- As acoes (criar, editar, remarcar, cancelar, mudar status) sao COMPARTILHADAS entre as duas telas; mudam o mesmo Agendamento e refletem em ambas (e no Dashboard).
- O detalhe do agendamento e acessivel a partir das duas visoes (Agenda, Agendamentos) e tambem do Dashboard. No MVP o detalhe pode abrir como modal/painel sobre a tela atual, sem rota dedicada (ver Pendencias sobre `/agendamentos/$id`).
- Como sao a mesma fonte de dados via service mockado + TanStack Query, alterar o status na lista atualiza a agenda e vice-versa (invalidacao de query).

## Mapa rota -> fluxos (docs/product/09)

| Rota | Fluxos de `docs/product/09-fluxos-principais.md` |
|------|---------------------------------------------------|
| `/login` | Fluxo 1 (Login mockado). |
| `/` (Dashboard) | Fluxo 2 (Abrir o dia); ponto de partida para Fluxo 5 (mudar status a partir dos proximos atendimentos) e atalho para Fluxo 3. |
| `/agenda` | Fluxo 3 (Criar agendamento), Fluxo 4 (Remarcar), Fluxo 5 (Mudar status), Fluxo 6 (Bloquear horario), Fluxo 7 (Criar serie recorrente). |
| `/agendamentos` | Fluxo 4 (Remarcar), Fluxo 5 (Mudar status); revisao/filtragem e agrupamento de series; entrada para o detalhe do agendamento. |
| `/clientes` | Fluxo 8 (Cadastrar/editar Cliente - cadastrar), Fluxo 11 (Buscar cliente). |
| `/clientes/$id` | Fluxo 11 (Ver historico), Fluxo 8 (editar/inativar); atalho para Fluxo 3 (novo agendamento para o cliente). |
| `/equipe` | Fluxo 10 (Cadastrar profissional). |
| `/equipe/$id` | Fluxo 10 (editar/inativar profissional; servicos realizados; disponibilidade). |
| `/servicos` | Fluxo 9 (Cadastrar/editar Servico). |
| `/configuracoes` | Sem fluxo dedicado em `docs/product/09`; exibe dados mockados de organizacao/unidade e horarios (ver Modulo Configuracoes Basicas em `docs/product/03-modulos.md`). |

Observacao: Fluxos 3, 4, 5, 6 e 7 sao iniciados predominantemente pela Agenda, mas as acoes de status (Fluxo 5) e remarcacao (Fluxo 4) tambem partem de Agendamentos e do Dashboard, porque operam sobre o mesmo Agendamento.

## Regras / Convencoes

- Rotas protegidas vivem sob `_app` (com shell + guarda); rotas publicas sob `_auth` (sem shell). Login e a unica tela publica do MVP.
- Params dinamicos usam a sintaxe `$param` do TanStack Router (ex.: `$id`); leitura tipada via params da rota.
- Navegacao entre telas usa os componentes/utilitarios de navegacao do roteador (link tipado / navegacao programatica), nunca `href` manual para rotas internas.
- Telas que carregam dados o fazem via hooks (TanStack Query) sobre services mockados; rotas nao leem o store em memoria diretamente.
- O item ativo da sidebar deriva da rota atual; rotas de detalhe mantem o item-pai destacado.
- Redirects (guarda e pos-login) usam o mecanismo de redirect do roteador; assinaturas exatas confirmadas na doc oficial.

## Pendencias

- Definir se criar/editar (cliente, servico, profissional, agendamento) usa modal/painel sobre a lista/detalhe OU rota dedicada (ex.: `/clientes/novo`, `/agendamentos/$id`). Recomendacao inicial: modal/painel no MVP.
- Decidir se o detalhe de agendamento ganha rota propria (`/agendamentos/$id`) ou permanece como modal compartilhado entre Agenda, Agendamentos e Dashboard.
- Definir persistencia de filtros/estado da Agenda (data, profissional, modo dia/semana/mes) via search params do roteador para deep-linking.
- Confirmar a API exata de guarda de rota (`beforeLoad`, `throw redirect`, search params tipados) na versao vigente do TanStack Router antes de implementar.
- Definir o comportamento de redirect pos-login quando houver `redirect` no search (voltar ao destino pretendido).
- Avaliar se a sessao mockada precisa sobreviver ao reload (ex.: persistir em memoria/sessionStorage) para evitar retorno forcado ao `/login`.
