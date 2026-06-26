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
- Remarcar agendamentos.
- Bloquear horarios da equipe.
- Criar agendamentos recorrentes (recorrencia simples).
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
- Remarcar agendamentos.
- Bloquear horarios da equipe.
- Criar agendamentos recorrentes (recorrencia simples).
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
- Criar agendamentos recorrentes (recorrencia simples).
- Cadastrar e editar clientes.
- Consultar servicos e profissionais.

### Profissional

Perfil focado na propria agenda.

Pode:

- Ver seus agendamentos.
- Ver detalhes do cliente necessarios para atendimento.
- Marcar atendimento como em andamento ou concluido, se permitido.
- Registrar observacoes operacionais simples, se permitido.

## Regras

As novas acoes operacionais do MVP seguem as permissoes ja descritas para cada perfil, conforme o caso:

- Remarcar agendamento: disponivel para Admin, Gerente e Atendente. A remarcacao mantem cliente e servico, registra rastro no historico e esta sujeita as mesmas regras de conflito e disponibilidade de um novo agendamento. Quando o agendamento faz parte de uma serie, o sistema pergunta "somente esta ocorrencia" ou "esta e as futuras".
- Bloquear horario: disponivel para Admin e Gerente, que podem registrar bloqueios da equipe (folga, almoco, indisponibilidade) com data, inicio, fim e motivo opcional. O Atendente nao cria bloqueios; apenas visualiza o horario bloqueado destacado na agenda.
- Criar recorrencia (recorrencia simples): disponivel para Admin, Gerente e Atendente. Gera uma serie finita de ocorrencias ligadas por um serieId, com edicao e cancelamento nas opcoes "somente esta ocorrencia" ou "esta e as futuras".

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

- Definir matriz detalhada de permissoes (perfil x acao) antes da integracao com API.
