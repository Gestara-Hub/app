# Glossario

## Decisao

O GestaraHub deve usar termos simples na interface e termos mais genericos na documentacao conceitual quando isso ajudar a preparar a evolucao do produto.

A linguagem do produto e HIBRIDA:

- No MVP, a interface usa uma linguagem unica e generica, valida para qualquer segmento: Clientes, Equipe, Servicos, Agenda e Agendamentos.
- A arquitetura conceitual deve prever um sistema FUTURO de "rotulos por segmento" (label overrides), que permita trocar os rotulos exibidos sem reescrever telas. Esse sistema NAO entra no MVP; e apenas previsao conceitual.

## Termos de interface no MVP

### Cliente

Pessoa atendida pelo negocio ou responsavel por um agendamento.

No MVP de barbearia, cliente e quem agenda um servico com um profissional. Um cliente pode agendar para si ou para um dependente (por exemplo, um filho em Corte Infantil).

### Equipe

Grupo de pessoas que trabalham no negocio.

"Equipe" e o rotulo usado na navegacao do MVP e agrupa profissionais e futuramente outros papeis internos.

### Profissional

Pessoa da equipe que realiza atendimentos ou executa servicos.

"Profissional" e o termo usado no contexto de um agendamento e nas telas de detalhe (por exemplo, "Profissional responsavel pelo atendimento"). Na navegacao, o rotulo continua sendo "Equipe".

No MVP, um agendamento de atendimento individual deve ter um profissional responsavel.

### Servico

Atividade oferecida pelo negocio, com nome, categoria, duracao, preco e status.

Exemplos no cenario de barbearia: Corte Masculino (R$ 45,00), Barba (R$ 35,00), Sobrancelha (R$ 20,00), Combo Corte + Barba (R$ 75,00).

### Agenda

Visao central dos compromissos operacionais em uma linha do tempo diaria, semanal ou mensal.

A Agenda exibe agendamentos e tambem bloqueios de horario, que aparecem destacados.

### Agendamento

Compromisso marcado entre cliente, profissional, servico, data e horario.

No MVP, "Agendamento" e o termo principal usado pela interface. Um agendamento possui um status e uma origem.

## Termos de operacao no MVP

### Remarcacao

Ato de mover um agendamento para outro horario e/ou outro profissional, mantendo o mesmo cliente e o mesmo servico.

A remarcacao mantem rastro no historico (registra que houve remarcacao) e nao transforma o agendamento em "concluido". Esta sujeita as mesmas regras de conflito e disponibilidade de um novo agendamento. Se o agendamento faz parte de uma serie, a remarcacao pergunta "somente esta ocorrencia" ou "esta e as futuras".

### Bloqueio de horario

Periodo em que um profissional fica indisponivel (folga, almoco, indisponibilidade), com data, horario de inicio, horario de fim e motivo opcional.

Horario bloqueado nao aceita agendamento e aparece destacado na Agenda.

### Recorrencia

Repeticao programada de um compromisso individual em uma frequencia definida.

No MVP, as frequencias sao semanal, quinzenal e mensal (mantendo o mesmo dia da semana e horario). O termino e por numero de ocorrencias ou por data final; nao ha opcao infinita. A recorrencia gera uma serie finita de agendamentos. Recorrencia de atendimento individual NAO transforma o produto no modelo de turmas; e apenas a repeticao de um compromisso individual.

### Serie (de recorrencia)

Conjunto de agendamentos (ocorrencias) gerados por uma recorrencia e ligados por um identificador comum (serieId).

Edicao e cancelamento de itens de uma serie oferecem as opcoes "somente esta ocorrencia" ou "esta e as futuras". Se uma ocorrencia cair em horario ocupado, fora do expediente ou em bloqueio, ela e sinalizada como conflito e NAO e criada automaticamente, ficando pendente de resolucao manual.

### Origem (do agendamento)

Indica como o agendamento foi criado.

No MVP, os valores de origem sao: manual e recorrencia. Valores previstos para o futuro: online e whatsapp.

## Termos conceituais internos

### Compromisso operacional

Conceito generico para qualquer evento que ocupe tempo, capacidade, recurso, cliente, equipe ou responsavel.

Um agendamento de barbearia, uma entrega de doceria e uma aula de turma sao tipos de compromisso operacional.

### Modelo operacional

Forma como um tipo de negocio organiza seus compromissos.

Modelos previstos:

- Atendimento individual
- Entrega ou encomenda
- Turmas e aulas

### Rotulos por segmento (label overrides)

Conceito FUTURO que permite exibir rotulos diferentes por segmento de negocio sem reescrever telas.

Exemplo: uma escola poderia ver "Alunos" no lugar de "Clientes", enquanto uma barbearia mantem "Clientes". No MVP, este sistema nao existe; a interface usa apenas a linguagem unica e generica. A arquitetura deve ser preparada para acomodar esses rotulos no futuro.

### Organizacao

Entidade que representa a empresa ou conta principal do cliente GestaraHub.

No MVP, o produto pode simular uma unica organizacao (por exemplo, "Corte Nobre", segmento barbearia).

### Unidade

Local, filial ou nucleo operacional de uma organizacao.

O conceito de unidade nao entra como funcionalidade completa no MVP, mas a estrutura deve ser preparada para evoluir nessa direcao. No cenario simulado ha uma unica unidade ("Corte Nobre - Matriz").

### Modulo

Conjunto de funcionalidades relacionadas a uma area do produto.

Exemplos: Agenda, Clientes, Equipe, Servicos, Relatorios, Financeiro.

### Add-on

Modulo adicional que pode ser ativado futuramente para ampliar o produto.

Exemplos: financeiro, estoque, WhatsApp, turmas, entregas, relatorios avancados.

### Recurso

Elemento usado ou ocupado por um compromisso.

No MVP, o recurso principal e o profissional. Futuramente pode representar sala, cadeira, veiculo, equipamento ou capacidade de producao.

### Status

Estado atual de uma entidade ou processo.

No MVP, status aparece principalmente em clientes, profissionais, servicos e agendamentos. Os status de agendamento sao: Pendente (pendente), Confirmado (confirmado), Em atendimento (em_atendimento), Concluido (concluido), Cancelado (cancelado) e Nao compareceu (nao_compareceu).

## Decisoes de vocabulario

- Linguagem hibrida: interface generica no MVP, com previsao conceitual de rotulos por segmento (label overrides) para o futuro.
- Usar "Clientes", "Equipe", "Servicos", "Agenda" e "Agendamentos" na navegacao.
- Usar "Equipe" como rotulo de navegacao e "Profissional" no contexto de um agendamento e em telas de detalhe.
- Usar "Compromisso operacional" apenas na documentacao e em discussoes tecnicas.
- Evitar expor termos como tenant, recurso, add-on e modulo tecnico para usuarios finais no MVP.

## Pendencias

- Definir o termo final para "unidade" quando a funcionalidade for implementada.
- Definir o conjunto inicial de rotulos por segmento (label overrides) quando o recurso for implementado no futuro.
