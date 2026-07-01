# Perfis e Permissoes

## Decisao

O MVP frontend mockado agora **simula multi-usuario e RBAC**: existem varios usuarios semeados (um por perfil), login por selecao de usuario e permissoes aplicadas de verdade na interface (navegacao, acoes e rotas). O modelo de dados e a matriz de permissoes ja seguem o formato de um contrato de API real, para encaixe direto na fase de backend.

## Entidade Usuario

Usuario (`User`) e quem acessa o sistema. Campos:

- id
- organizacaoId
- nome
- email
- perfil (`UserProfile`)
- profissionalId (opcional)
- status
- criadoEm
- atualizadoEm

`UserProfile` (perfil de acesso) tem codigos em ingles e rotulos em portugues na UI:

- `owner` -> Proprietario
- `manager` -> Gerente
- `attendant` -> Atendente
- `professional` -> Profissional

**Perfil ≠ Cargo.** `UserProfile` controla o que o usuario pode fazer no sistema (RBAC). `Role` (Cargo) e a funcao/especialidade do profissional no negocio (ex.: "Barbeiro Senior"), referenciada por `Professional.roleId` e usada em relatorios. Sao conceitos distintos e nao devem ser confundidos.

**Usuario x Profissional.** O vinculo `professionalId` e opcional: um usuario pode ou nao ser um profissional.

- Proprietario/Gerente/Atendente normalmente **nao** sao profissionais (nao atendem na agenda).
- Usuarios de perfil Profissional **sao** vinculados a um `Professional` — e assim que a agenda deles e escopada.
- Um profissional pode existir sem usuario (nem todo funcionario faz login).

## Perfis previstos

### Proprietario/Admin

Perfil com acesso completo ao negocio.

Pode:

- Ver dashboard.
- Ver agenda.
- Criar, editar e cancelar agendamentos.
- Remarcar agendamentos.
- Bloquear horarios da equipe.
- Criar agendamentos recorrentes (recorrencia simples).
- Gerenciar clientes.
- Gerenciar equipe.
- Gerenciar servicos.
- Ver configuracoes.
- Futuramente gerenciar unidades, permissoes e modulos.

### Gerente

Perfil operacional com acesso amplo, mas sem configuracoes sensiveis (Configuracoes).

Pode:

- Ver dashboard.
- Ver agenda.
- Criar, editar e cancelar agendamentos.
- Remarcar agendamentos.
- Bloquear horarios da equipe.
- Criar agendamentos recorrentes.
- Gerenciar clientes.
- Gerenciar equipe.
- Gerenciar servicos.

### Atendente

Perfil focado em rotina de agenda e atendimento ao cliente.

Pode:

- Ver agenda.
- Criar agendamentos.
- Editar dados de agendamentos.
- Confirmar, cancelar ou remarcar agendamentos.
- Criar agendamentos recorrentes.
- Cadastrar e editar clientes.
- Consultar servicos e profissionais (somente leitura).

Nao pode: bloquear horarios (apenas visualiza bloqueios), gerenciar equipe/servicos, ver dashboard ou configuracoes.

### Profissional

Perfil focado na propria agenda.

Pode:

- Ver a propria agenda (escopada ao seu `professionalId`).
- Ver os proprios agendamentos.
- Avancar o status dos proprios atendimentos (confirmar, iniciar, concluir, nao compareceu).
- Consultar clientes e servicos (somente leitura) para o atendimento.

Nao pode: criar/editar/cancelar/remarcar agendamentos, bloquear horarios, criar recorrencia, gerenciar cadastros, ver dashboard ou configuracoes.

## Matriz de permissoes (capability keys)

As acoes do sistema sao `capability keys` no formato `entidade:acao` (fonte unica em `src/types/permission.ts`). O perfil deriva o conjunto via `PROFILE_PERMISSIONS` (`src/lib/permissions.ts`) e a UI checa com `can()` — nunca compara o perfil diretamente. Mapeiam 1:1 a scopes de uma API real.

| Permissao | Proprietario | Gerente | Atendente | Profissional |
|---|:---:|:---:|:---:|:---:|
| dashboard:view | ✓ | ✓ | | |
| schedule:view | ✓ | ✓ | ✓ | ✓ |
| appointments:view | ✓ | ✓ | ✓ | ✓ |
| appointments:create | ✓ | ✓ | ✓ | |
| appointments:edit | ✓ | ✓ | ✓ | |
| appointments:cancel | ✓ | ✓ | ✓ | |
| appointments:reschedule | ✓ | ✓ | ✓ | |
| appointments:status | ✓ | ✓ | ✓ | ✓ |
| appointments:block | ✓ | ✓ | | |
| recurrence:manage | ✓ | ✓ | ✓ | |
| clients:view | ✓ | ✓ | ✓ | ✓ |
| clients:manage | ✓ | ✓ | ✓ | |
| team:view | ✓ | ✓ | ✓ | ✓ |
| team:manage | ✓ | ✓ | | |
| services:view | ✓ | ✓ | ✓ | ✓ |
| services:manage | ✓ | ✓ | | |
| settings:view | ✓ | | | |
| users:view / users:manage | ✓ | | | |

Gestao de usuarios (`/users`): apenas o Proprietario cadastra/edita/inativa usuarios e define perfis. Regras: e-mail unico; nao e possivel inativar a si mesmo nem rebaixar/inativar o ultimo proprietario ativo. Sem senha (login por selecao no mock).

Regras especificas (herdadas do fluxo operacional):

- **Bloquear horario** (`appointments:block`): Proprietario e Gerente. Atendente/Profissional apenas visualizam o bloqueio na agenda.
- **Remarcar** (`appointments:reschedule`) e **recorrencia** (`recurrence:manage`): Proprietario, Gerente e Atendente.
- **Avancar status** (`appointments:status`): todos os perfis operacionais; o Profissional so no proprio atendimento.

## Fluxo de acesso (mock)

- **Login por selecao de usuario:** a tela de login lista os usuarios semeados; clicar em um entra como aquele perfil (senha irrelevante no mock). O cookie de sessao guarda o `userId`.
- **Trocar usuario:** o menu do usuario (topbar) permite alternar entre os usuarios sem logout — util para demonstrar cada perfil.
- **Enforcement:** a navegacao esconde itens sem permissao; acoes (botoes/menus) sao ocultadas por `can()`; rotas restritas (Dashboard, Configuracoes) sao barradas no server (`requirePermission`) e redirecionam para a primeira rota acessivel do perfil (evita loop).
- **Escopo do Profissional:** Agenda e Agendamentos filtram para o `professionalId` do usuario (UI-only no mock).

## Fora de escopo no MVP

- Autenticacao real / tokens / validacao de senha.
- Convite/onboarding real de usuarios por e-mail (a gestao/CRUD de usuarios EXISTE em `/users`, so para o Proprietario; falta o convite real e a definicao de senha).
- Tela completa de gestao de permissoes (matriz editavel).
- Politicas por unidade.
- Auditoria real de acoes.
- Enforcement server-side de dados (o escopo do Profissional e apenas na UI; os services ainda retornam tudo).
- Restricao por campo (ex.: "editar apenas dados basicos" do Atendente).

## Pendencias

- Ao integrar a API: transformar `PROFILE_PERMISSIONS` em policies/scopes reais e aplicar o enforcement tambem no servidor (o contrato ja esta pronto).
