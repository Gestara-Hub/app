# Modulos do Produto

## Decisao

O GestaraHub deve ser organizado em modulos funcionais. No MVP, apenas os modulos essenciais da rotina operacional de uma barbearia serao implementados no frontend mockado.

A navegacao do MVP usa uma linguagem unica e generica: Clientes, Equipe, Servicos, Agenda e Agendamentos. A arquitetura conceitual deve prever um sistema futuro de rotulos por segmento (label overrides), capaz de exibir, por exemplo, "Alunos" no lugar de "Clientes" para uma escola, sem reescrever telas. Esse sistema de rotulos NAO entra no MVP; e apenas previsao conceitual.

Convencao de vocabulario: "Equipe" e o rotulo da navegacao; "Profissional" e o termo usado no contexto de um agendamento e em telas de detalhe.

## Modulo: Agenda

### Objetivo

Centralizar a visualizacao e a gestao dos agendamentos, bloqueios e series recorrentes de cada profissional.

### Usuarios envolvidos

- Proprietario/Admin
- Gerente
- Atendente
- Profissional

### Funcionalidades no MVP

- Ver agenda por dia, semana e mes.
- Filtrar por profissional.
- Criar agendamento.
- Editar agendamento.
- Cancelar agendamento.
- Confirmar agendamento.
- Marcar como em atendimento.
- Marcar como concluido.
- Registrar nao comparecimento.
- Ver detalhes rapidos do agendamento.
- Remarcar agendamento.
- Bloquear horario (folga, almoco, indisponibilidade).
- Criar agendamento recorrente (serie).

#### Remarcar agendamento

- Mover um agendamento para outro horario e/ou outro profissional, mantendo o mesmo cliente e o mesmo servico.
- Mantem rastro no historico (registra que foi remarcado); a remarcacao nao transforma o agendamento em "concluido".
- Sujeita as mesmas regras de conflito e disponibilidade de um novo agendamento.
- Se o agendamento faz parte de uma serie, a remarcacao pergunta: "somente esta ocorrencia" ou "esta e as futuras".

#### Bloquear horario

- Um profissional pode ter bloqueios (folga, almoco, indisponibilidade) com data, inicio, fim e motivo opcional.
- Horario bloqueado nao aceita agendamento e aparece destacado na agenda.

#### Criar agendamento recorrente (serie)

- Frequencias: semanal, quinzenal e mensal (mesmo dia da semana e horario).
- Termino: por numero de ocorrencias OU por data final. Nao ha opcao infinita no MVP; a serie gerada e sempre finita.
- Geracao: cria N agendamentos (ocorrencias) ligados por um serieId.
- Edicao e cancelamento: opcoes "somente esta ocorrencia" ou "esta e as futuras".
- Conflito: se uma ocorrencia cair em horario ocupado, fora do expediente ou em bloqueio, ela e sinalizada como conflito e NAO e criada automaticamente (fica pendente de resolucao manual).
- A recorrencia simples de atendimento individual NAO transforma o produto em modelo de turmas; e apenas a repeticao de um compromisso individual.

### Regras

- Sobreposicao de horario para o mesmo profissional e SEMPRE bloqueada no MVP.
- Status de agendamento (chave -> rotulo): pendente -> Pendente; confirmado -> Confirmado; em_atendimento -> Em atendimento; concluido -> Concluido; cancelado -> Cancelado; nao_compareceu -> Nao compareceu.
- Origem de agendamento (enum): manual, recorrencia. (futuro: online, whatsapp)
- A duracao do agendamento segue a duracao do servico escolhido.

### Entidades usadas

- Cliente
- Profissional
- Servico
- Agendamento
- Bloqueio de horario
- Serie (recorrencia)

### Fora de escopo no MVP

- Encaixe manual com alerta de conflito (futuro). No MVP nao ha sobreposicao de horario para o mesmo profissional; toda sobreposicao e bloqueada.
- Sincronizacao com Google Calendar.
- Recorrencia avancada (alem de semanal, quinzenal e mensal).
- Lista de espera automatica.
- Confirmacao automatica por WhatsApp.
- Agendamento online pelo cliente.

## Modulo: Agendamentos

### Objetivo

Oferecer uma visao em lista/tabela de todos os agendamentos, complementar a visao de calendario da Agenda. Serve para buscar, filtrar e revisar agendamentos sem depender da navegacao por datas.

A Agenda e a visao de calendario (dia, semana e mes); Agendamentos e a visao em lista da mesma entidade. As acoes (criar, editar, remarcar, cancelar, mudar status) sao compartilhadas entre as duas telas.

### Usuarios envolvidos

- Proprietario/Admin
- Gerente
- Atendente
- Profissional

### Funcionalidades no MVP

- Listar agendamentos em tabela.
- Filtrar por status, profissional, periodo e cliente.
- Buscar por cliente.
- Ordenar por data e horario.
- Abrir o detalhe de um agendamento e executar as acoes de status (mesmas da Agenda).
- Agrupar/visualizar as ocorrencias de uma serie recorrente (por serieId).

### Entidades usadas

- Agendamento
- Cliente
- Profissional
- Servico
- Serie (recorrencia)

### Fora de escopo no MVP

- Exportacao da lista.
- Relatorios gerenciais sobre os agendamentos.
- Edicao em lote.

## Modulo: Clientes

### Objetivo

Organizar clientes e permitir acesso rapido ao historico de agendamentos.

### Funcionalidades no MVP

- Listar clientes.
- Buscar cliente por nome ou telefone.
- Criar cliente.
- Editar cliente.
- Ativar ou inativar cliente.
- Ver dados basicos e historico mockado.

### Fora de escopo no MVP

- CRM avancado.
- Segmentacao.
- Campanhas.
- Importacao de contatos.

## Modulo: Equipe

### Objetivo

Gerenciar os profissionais que realizam atendimentos. "Equipe" e o rotulo da navegacao; nas telas de detalhe e no contexto de um agendamento, usa-se o termo "Profissional".

### Funcionalidades no MVP

- Listar profissionais.
- Criar profissional.
- Editar profissional.
- Ativar ou inativar profissional.
- Definir servicos realizados.
- Visualizar disponibilidade basica.

### Fora de escopo no MVP

- Folha de pagamento.
- Comissoes.
- Controle de ponto.
- Permissoes detalhadas por profissional.

## Modulo: Servicos

### Objetivo

Gerenciar os servicos oferecidos pelo negocio.

### Funcionalidades no MVP

- Listar servicos.
- Criar servico.
- Editar servico.
- Ativar ou inativar servico.
- Definir duracao.
- Definir preco (em reais; armazenado em centavos).
- Agrupar por categoria.

### Fora de escopo no MVP

- Pacotes.
- Planos.
- Promocoes.
- Precos dinamicos.

## Modulo: Dashboard Operacional

### Objetivo

Dar uma visao rapida do dia e orientar as proximas acoes.

### Funcionalidades no MVP

- Agendamentos de hoje.
- Proximos atendimentos.
- Atendimentos concluidos.
- Cancelamentos e no-shows.
- Receita estimada do dia.
- Ocupacao por profissional.

### Fora de escopo no MVP

- BI avancado.
- Comparativos historicos profundos.
- Metas.
- Exportacoes.

## Modulo: Configuracoes Basicas

### Objetivo

Preparar a estrutura minima do negocio usado no MVP.

### Funcionalidades no MVP

- Exibir dados da organizacao mockada.
- Exibir conceito de unidade como estrutura futura.
- Definir horarios de funcionamento basicos no mock.

### Fora de escopo no MVP

- Multiunidade completa.
- Faturamento.
- Integracoes.
- Configuracao de add-ons.
- Rotulos por segmento (label overrides) configuraveis pelo usuario.

## Modulos futuros

- Unidades
- Relatorios gerenciais
- Financeiro
- Estoque
- Comissoes
- WhatsApp e automacoes
- Entregas/encomendas
- Turmas/aulas
- Planos e mensalidades
- Controle de presenca
- Rotulos por segmento (label overrides)
