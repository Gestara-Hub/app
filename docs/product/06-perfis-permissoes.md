# Perfis e Permissoes

## Decisao

Permissoes avancadas nao entram no MVP, mas os perfis devem ser definidos desde cedo para orientar navegacao, acoes e evolucao futura.

## Perfis previstos

### Proprietario/Admin

Perfil com acesso completo ao negocio.

Pode:

- Ver dashboard.
- Ver agenda.
- Criar, editar e cancelar agendamentos.
- Gerenciar clientes.
- Gerenciar equipe.
- Gerenciar servicos.
- Ver configuracoes.
- Futuramente gerenciar unidades, permissoes e modulos.

### Gerente

Perfil operacional com acesso amplo, mas sem controle total de configuracoes sensiveis.

Pode:

- Ver dashboard.
- Ver agenda.
- Criar, editar e cancelar agendamentos.
- Gerenciar clientes.
- Gerenciar equipe operacional.
- Gerenciar servicos, se permitido.

### Atendente

Perfil focado em rotina de agenda e atendimento ao cliente.

Pode:

- Ver agenda.
- Criar agendamentos.
- Editar dados basicos de agendamentos.
- Confirmar, cancelar ou remarcar agendamentos.
- Cadastrar e editar clientes.
- Consultar servicos e profissionais.

### Profissional

Perfil focado na propria agenda.

Pode:

- Ver seus agendamentos.
- Ver detalhes do cliente necessarios para atendimento.
- Marcar atendimento como em andamento ou concluido, se permitido.
- Registrar observacoes operacionais simples, se permitido.

## Escopo do MVP

No MVP frontend mockado, o usuario logado pode ser tratado como Proprietario/Admin.

A documentacao e os mocks devem preservar o conceito de perfil para evolucao futura.

## Fora de escopo no MVP

- Tela completa de gestao de permissoes.
- RBAC detalhado.
- Convite real de usuarios.
- Politicas por unidade.
- Auditoria real de acoes.

## Pendencias

- Comparar estes perfis com o modulo IAM ja existente no backend.
- Definir matriz detalhada de permissoes antes da integracao com API.

