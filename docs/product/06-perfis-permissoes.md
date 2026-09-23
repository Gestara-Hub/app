# Perfis e Permissoes

## Decisao

O frontend mockado **simula multi-usuario e RBAC**: usuarios com perfis, login por selecao de usuario e permissoes aplicadas de verdade na interface (navegacao, acoes e rotas). O modelo de dados e a matriz de permissoes seguem o formato de um contrato de API real, para encaixe direto na fase de backend.

O seed cria **um unico usuario por organizacao, o proprietario** (Corte Nobre: Marcelo Andrade; Academia X: Ana Ribeiro). Os demais usuarios sao cadastrados em `/users`. A tela de login lista os usuarios de todas as organizacoes; entrar ou trocar de usuario troca a organizacao ativa (ver [`../technical/03-multi-tenant-e-escopo.md`](../technical/03-multi-tenant-e-escopo.md)).

## Entidade Usuario

Usuario (`User`, `packages/contracts/src/user.ts`) e quem acessa o sistema. Campos:

- id
- organizationId
- name
- email
- profile (`UserProfile`)
- professionalId (opcional)
- status
- createdAt
- updatedAt

`UserProfile` (perfil de acesso) tem codigos em ingles e rotulos em portugues na UI:

- `owner` -> Proprietario
- `manager` -> Gerente
- `attendant` -> Atendente
- `professional` -> Profissional

**Perfil ≠ Cargo.** `UserProfile` controla o que o usuario pode fazer no sistema (RBAC). `Role` (Cargo) e a funcao/especialidade do profissional no negocio (ex.: "Barbeiro Senior"), referenciada por `Professional.roleId` (**opcional**) e usada em relatorios. Cargo nao concede permissao.

**Usuario x Profissional.** O vinculo `professionalId` e opcional: um usuario pode ou nao ser um profissional.

- Proprietario/Gerente/Atendente normalmente **nao** sao profissionais.
- Usuarios de perfil Profissional sao vinculados a um `Professional`; e assim que a Agenda deles e escopada.
- Um profissional pode existir sem usuario (nem todo funcionario faz login).

## Perfis

### Proprietario/Admin

Acesso completo ao negocio: todas as permissoes, incluindo Configuracoes, Usuarios (todos os perfis) e Auditoria completa.

### Gerente

Perfil operacional com acesso amplo, sem Configuracoes.

Pode:

- Ver dashboard.
- Operar a agenda completa (criar, editar, cancelar, remarcar, mudar status, bloquear horarios, criar series).
- Gerenciar clientes/alunos, equipe (e cargos) e servicos (e categorias).
- Turmas: criar/editar turmas, modalidades, matriculas e presenca.
- Financeiro: planos e mensalidades (gerar, registrar pagamento etc.).
- Gerenciar usuarios **apenas dos perfis Atendente e Profissional** (`manageableProfiles`).
- Ver a Auditoria com visibilidade restrita (ver abaixo).

### Atendente

Perfil focado na rotina de atendimento.

Pode:

- Ver e operar a agenda: criar, editar, confirmar/mudar status, cancelar, remarcar, criar series.
- Cadastrar e editar clientes/alunos.
- Consultar servicos e equipe (somente leitura).
- Turmas: ver turmas, matricular/cancelar matricula e marcar presenca (sem criar/editar turmas nem modalidades).
- Ver planos e mensalidades (sem gerenciar).

Nao pode: bloquear horarios, gerenciar equipe/servicos/turmas, ver dashboard, usuarios, auditoria ou configuracoes.

### Profissional

Perfil focado no proprio trabalho.

Pode:

- Ver a propria agenda (Modelo 1, escopada ao seu `professionalId`) e avancar o status dos atendimentos (confirmar, iniciar, concluir, nao compareceu).
- Ver turmas e aulas e marcar presenca (Modelo 3).

Nao pode: criar/editar/cancelar/remarcar agendamentos, bloquear horarios, criar series, ver clientes, equipe ou servicos, gerenciar cadastros, ver dashboard, financeiro, usuarios, auditoria ou configuracoes.

Ainda nao implementado: **instrutor ver so as proprias turmas** (hoje o Profissional ve todas as turmas e aulas do tenant).

Antes: o Profissional tinha leitura de clientes, servicos e equipe e uma permissao `appointments:view`; hoje nenhuma das duas existe para ele (a `appointments:view` nao existe no contrato).

## Matriz de permissoes (capability keys)

As acoes do sistema sao `capability keys` no formato `entidade:acao`, com fonte unica em `packages/contracts/src/permission.ts`. O perfil deriva o conjunto via `PROFILE_PERMISSIONS` (`apps/web/src/lib/permissions.ts`) e a UI checa com `can()` / `useCan()`, nunca comparando o perfil diretamente. Mapeiam 1:1 a scopes de uma API real.

| Permissao | Proprietario | Gerente | Atendente | Profissional |
|---|:---:|:---:|:---:|:---:|
| dashboard:view | ✓ | ✓ | | |
| schedule:view | ✓ | ✓ | ✓ | ✓ |
| appointments:create | ✓ | ✓ | ✓ | |
| appointments:edit | ✓ | ✓ | ✓ | |
| appointments:cancel | ✓ | ✓ | ✓ | |
| appointments:reschedule | ✓ | ✓ | ✓ | |
| appointments:status | ✓ | ✓ | ✓ | ✓ |
| appointments:block | ✓ | ✓ | | |
| recurrence:manage | ✓ | ✓ | ✓ | |
| clients:view | ✓ | ✓ | ✓ | |
| clients:manage | ✓ | ✓ | ✓ | |
| team:view | ✓ | ✓ | ✓ | |
| team:manage | ✓ | ✓ | | |
| services:view | ✓ | ✓ | ✓ | |
| services:manage | ✓ | ✓ | | |
| classes:view | ✓ | ✓ | ✓ | ✓ |
| classes:manage | ✓ | ✓ | | |
| enrollment:manage | ✓ | ✓ | ✓ | |
| attendance:mark | ✓ | ✓ | ✓ | ✓ |
| billing:view | ✓ | ✓ | ✓ | |
| billing:manage | ✓ | ✓ | | |
| settings:view | ✓ | | | |
| users:view / users:manage | ✓ | ✓ (so Atendente/Profissional) | | |
| audit:view | ✓ | ✓ (visao restrita) | | |

As keys sao independentes do modelo; o que aparece para cada tenant e decidido tambem pelo modelo operacional (ex.: `classes:*` e `billing:*` so tem telas na academia; `services:*` e a Agenda so no atendimento).

Regras especificas:

- **Bloquear horario** (`appointments:block`): Proprietario e Gerente. Atendente/Profissional apenas visualizam o bloqueio na agenda.
- **Remarcar** (`appointments:reschedule`) e **recorrencia** (`recurrence:manage`): Proprietario, Gerente e Atendente.
- **Avancar status** (`appointments:status`): todos os perfis; o Profissional so enxerga (e portanto so opera) os proprios atendimentos.
- **Modalidades** exigem `classes:manage`; **Planos** e **Mensalidades** aparecem com `billing:view`, e as acoes de gestao exigem `billing:manage`.

## Gestao de usuarios (`/users`)

- Proprietario cadastra, edita, inativa e reativa usuarios de qualquer perfil.
- Gerente faz o mesmo apenas para usuarios Atendente e Profissional (`manageableProfiles` / `canManageProfile` em `lib/permissions.ts`; aplicado so no client do mock).
- E-mail unico; nao e possivel inativar a si mesmo nem inativar/rebaixar o ultimo proprietario ativo.
- Sem senha nem convite (login por selecao no mock).

## Auditoria (`/audit`)

- Requer `audit:view` (Proprietario e Gerente).
- Proprietario ve todos os eventos.
- Gerente ve os eventos operacionais e os eventos de usuario cujo alvo seja Atendente ou Profissional; eventos sensiveis (usuarios Proprietario/Gerente, Configuracoes e "resetar cobrancas") ficam so para o Proprietario. O filtro e aplicado no read-model do service (`auditLogService`), nao na UI.

## Fluxo de acesso (mock)

- **Login por selecao de usuario:** a tela de login lista os usuarios de todas as organizacoes (semeados + criados na UI), com organizacao e perfil; clicar em um entra como aquele usuario (senha irrelevante). O cookie de sessao guarda o snapshot do usuario (`UserView`), espelhando um futuro token assinado (JWT).
- **Trocar usuario:** o menu do usuario (topbar) alterna entre usuarios sem logout; trocar para um usuario de outra organizacao troca o tenant ativo.
- **Enforcement:**
  - A navegacao mostra so os itens do modelo do tenant (`navForModel`) e com permissao (`can`).
  - Acoes (botoes/menus) sao ocultadas por `can()`.
  - As pages protegidas chamam `requirePermission` no server (Dashboard, Clientes, Equipe, Servicos, Turmas, detalhe de turma e de aula, Calendario, Modalidades, Planos, Mensalidades, Usuarios, Auditoria, Configuracoes); sem permissao, redireciona para a primeira rota acessivel do perfil no modelo (`firstAllowedRoute`). **A Agenda (`/schedule`) nao tem esse guard** (todos os perfis tem `schedule:view`).
  - `canAccessRoute` valida o destino pos-login (`?from=`), recusando rota de outro modelo. Acessar diretamente pela URL uma rota de outro modelo nao e barrado por um guard proprio.
- **Escopo do Profissional:** a Agenda (Calendario e Lista) filtra para o `professionalId` do usuario. E so na UI; os services retornam tudo.

## Fora de escopo no MVP

- Autenticacao real / tokens / validacao de senha.
- Convite real de usuarios por e-mail e definicao de senha.
- Tela de gestao de permissoes (matriz editavel).
- Politicas por unidade.
- Enforcement server-side de dados (escopo do Profissional e restricao de perfis gerenciaveis pelo Gerente sao so na UI).
- Restricao por campo (ex.: "editar apenas dados basicos").

## Pendencias

- Ao integrar a API: transformar `PROFILE_PERMISSIONS` em policies/scopes reais e aplicar o enforcement tambem no servidor, incluindo `manageableProfiles`, o escopo do Profissional e a visibilidade da auditoria.
- Decidir se o instrutor deve ver so as proprias turmas.
