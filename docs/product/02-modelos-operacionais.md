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

### Status no roadmap

Entra no MVP.

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

### Status no roadmap

Futuro. Nao entra no MVP.

## Regra de evolucao

Novos modelos operacionais nao devem alterar a linguagem simples do MVP. Eles devem ser adicionados como extensoes progressivas do conceito de compromisso operacional.

