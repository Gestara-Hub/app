# Glossario

## Decisao

O GestaraHub deve usar termos simples na interface e termos mais genericos na documentacao conceitual quando isso ajudar a preparar a evolucao do produto.

## Termos de interface no MVP

### Cliente

Pessoa atendida pelo negocio ou responsavel por um agendamento.

No MVP de barbearia, cliente e quem agenda um servico com um profissional.

### Equipe

Grupo de pessoas que trabalham no negocio.

Na interface, "Equipe" agrupa profissionais e futuramente outros papeis internos.

### Profissional

Pessoa da equipe que realiza atendimentos ou executa servicos.

No MVP, um agendamento de atendimento individual deve ter um profissional responsavel.

### Servico

Atividade oferecida pelo negocio, com nome, duracao, preco e status.

Exemplos no cenario de barbearia: corte masculino, barba, sobrancelha, combo corte e barba.

### Agenda

Visao central dos compromissos operacionais em uma linha do tempo diaria, semanal ou mensal.

### Agendamento

Compromisso marcado entre cliente, profissional, servico, data e horario.

No MVP, "Agendamento" e o termo principal usado pela interface.

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

### Organizacao

Entidade que representa a empresa ou conta principal do cliente GestaraHub.

No MVP, o produto pode simular uma unica organizacao.

### Unidade

Local, filial ou nucleo operacional de uma organizacao.

O conceito de unidade nao entra como funcionalidade completa no MVP, mas a estrutura deve ser preparada para evoluir nessa direcao.

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

No MVP, status aparece principalmente em clientes, profissionais, servicos e agendamentos.

## Decisoes de vocabulario

- Usar "Clientes", "Equipe", "Servicos", "Agenda" e "Agendamentos" na navegacao inicial.
- Usar "Compromisso operacional" apenas na documentacao e em discussoes tecnicas.
- Evitar expor termos como tenant, recurso, add-on e modulo tecnico para usuarios finais no MVP.

## Pendencias

- Definir o termo final para "unidade" quando a funcionalidade for implementada.
- Definir se "Equipe" e suficiente ou se a UI deve usar "Profissionais" em telas especificas.

