# Modelos Operacionais

## Decisao

O GestaraHub deve nascer com suporte funcional apenas ao modelo de atendimento individual, mas a documentacao deve preservar os modelos futuros para orientar decisoes de produto e arquitetura.

## Modelo 1: Atendimento individual

### Descricao

Um cliente agenda um servico com um profissional em um horario especifico.

### Exemplos

- Barbearia
- Salao de beleza
- Clinica pequena
- Consultoria individual
- Estetica

### Entidades principais

- Cliente
- Profissional
- Servico
- Agenda
- Agendamento

### Caracteristicas

- Um profissional geralmente atende um cliente por vez.
- O servico define duracao e preco sugeridos.
- A disponibilidade do profissional limita horarios possiveis.
- O status do agendamento orienta a rotina operacional.

### Recorrencia simples (entra no MVP)

O atendimento individual suporta recorrencia simples ja no MVP. Trata-se da repeticao de um compromisso individual entre o mesmo cliente, o mesmo servico e um profissional, sem mudar a natureza do modelo.

- Frequencias: semanal, quinzenal ou mensal (mesmo dia da semana e horario).
- Termino: por numero de ocorrencias ou por data final. Nao ha opcao infinita no MVP; a recorrencia gera uma serie finita.
- Geracao: cria N agendamentos (ocorrencias) ligados por um serieId.
- Edicao e cancelamento: opcoes "somente esta ocorrencia" ou "esta e as futuras".
- Conflito: se uma ocorrencia cair em horario ocupado, fora do expediente ou em bloqueio, ela e sinalizada como conflito e NAO e criada automaticamente, ficando pendente de resolucao manual.

> Importante: a recorrencia simples NAO transforma o produto no modelo de turmas. Ela e apenas a repeticao de um compromisso individual (um cliente por ocorrencia). A recorrencia/frequencia com varios alunos por compromisso, matricula, presenca e reposicao pertence ao Modelo 3 (Turmas e aulas), que continua futuro. Ver detalhes da regra no CANON e em [Modelo 3: Turmas e aulas](#modelo-3-turmas-e-aulas).

### Status no roadmap

Entra no MVP, incluindo recorrencia simples.

## Modelo 2: Entrega ou encomenda

### Descricao

Um cliente solicita um item, pedido ou encomenda com data especifica de entrega, retirada ou producao.

### Exemplos

- Doceria
- Confeitaria
- Pequenos produtores
- Servicos com retirada agendada
- Aluguel ou reserva de itens

### Entidades principais

- Cliente
- Pedido ou item
- Data de entrega ou retirada
- Responsavel interno
- Status de producao e entrega

### Caracteristicas

- O compromisso pode nao ocupar um profissional em uma grade de atendimento tradicional.
- Pode haver etapas internas, como pedido recebido, em producao, pronto, entregue e cancelado.
- Pode exigir capacidade diaria de producao em vez de agenda por profissional.

### Status no roadmap

Futuro. Nao entra no MVP.

## Modelo 3: Turmas e aulas

### Descricao

Um professor ou instrutor gerencia aulas recorrentes com varios alunos.

### Exemplos

- Judo
- Idiomas
- Danca
- Musica
- Reforco escolar
- Treinos e modalidades

### Entidades principais

- Professor
- Turma
- Alunos
- Aulas recorrentes
- Presenca/frequencia
- Calendario

### Caracteristicas

- Um compromisso pode envolver varios alunos.
- Recorrencia e uma regra central.
- Pode exigir matricula, mensalidade, presenca e reposicao de aula.
- A agenda e compartilhada entre professor, turma e alunos.

### Diferenca para a recorrencia simples do Modelo 1

A recorrencia do Modelo 3 e estruturalmente diferente da recorrencia simples do Modelo 1:

- Modelo 1: cada ocorrencia e um compromisso individual (um cliente, um servico, um profissional). A recorrencia apenas repete esse compromisso ao longo do tempo.
- Modelo 3: cada aula pode reunir varios alunos em uma turma, com matricula, controle de presenca/frequencia e reposicao. A recorrencia organiza um calendario coletivo, nao a repeticao de um atendimento individual.

Por isso, oferecer recorrencia simples no MVP nao antecipa nem implementa o modelo de turmas. O Modelo 3 continua futuro.

### Status no roadmap

Futuro. Nao entra no MVP.

## Regra de evolucao

Novos modelos operacionais nao devem alterar a linguagem simples do MVP. Eles devem ser adicionados como extensoes progressivas do conceito de compromisso operacional.
