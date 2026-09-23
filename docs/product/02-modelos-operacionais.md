# Modelos Operacionais

## Decisao

O GestaraHub suporta um modelo operacional por organizacao (`Organization.model`: `scheduling` | `classes` | `delivery`). O modelo define menu, dashboard e textos (ver [`../technical/03-multi-tenant-e-escopo.md`](../technical/03-multi-tenant-e-escopo.md)).

Situacao atual no frontend mockado:

| Modelo | Codigo | Situacao |
| --- | --- | --- |
| 1. Atendimento individual | `scheduling` | Implementado; escopo congelado (tenant Corte Nobre). |
| 2. Entrega ou encomenda | `delivery` | Tipado no contrato, sem telas. |
| 3. Turmas e aulas | `classes` | Implementado; **MVP ativo** (tenant Academia X). |

Antes: o produto nasceu so com o Modelo 1 e tratava os Modelos 2 e 3 como futuros.

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
- Geracao: cria N agendamentos (ocorrencias) ligados por um `seriesId`, com origem `recurrence`.
- Escopo "somente esta ocorrencia" ou "esta e as futuras": existe so na remarcacao. Editar e cancelar agem em uma ocorrencia por vez.
- Conflito: se uma ocorrencia cair em horario ocupado, fora do expediente, fora do horario do profissional, no intervalo ou em bloqueio, ela NAO e criada; o usuario e avisado de quantas ficaram de fora e resolve manualmente.

> Importante: a recorrencia simples NAO transforma o produto no modelo de turmas. Ela e apenas a repeticao de um compromisso individual (um cliente por ocorrencia). A recorrencia/frequencia com varios alunos por compromisso, matricula e presenca pertence ao Modelo 3 (Turmas e aulas). Ver detalhes da regra no CANON e em [Modelo 3: Turmas e aulas](#modelo-3-turmas-e-aulas).

### Status no roadmap

Implementado no frontend mockado (primeiro recorte), incluindo recorrencia simples e agendamento com varios servicos. Escopo congelado enquanto o MVP ativo e o Modelo 3; diferencas em relacao a spec original estao no banner de [04-mvp-barbearia.md](04-mvp-barbearia.md).

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

Futuro. O valor `delivery` ja existe em `OperationalModel` e o redirect pos-login desse modelo aponta para `/orders`, mas essa rota, as telas e as entidades ainda nao existem. Spec em [12-modelo-2-entrega.md](12-modelo-2-entrega.md).

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
- Exige matricula, mensalidade e presenca.
- A agenda e compartilhada entre professor, turma e alunos.

### O que ja esta implementado

- Modalidades (reusa `Category`) e instrutores com as modalidades que lecionam (`Professional.modalityIds`).
- Turmas com instrutor titular, capacidade, encontros semanais e data de inicio; as aulas sao geradas a partir dos encontros.
- Matricula (capacidade e regra mole: turma lotada pede confirmacao) e lista de espera com promocao manual.
- Aula avulsa (gera cobranca avulsa quando ha valor) e aula experimental (sem cobranca), por aula.
- Instrutor substituto por aula, com motivo, e restauracao do titular.
- Presenca (presente, falta, justificada) e frequencia por aluno.
- Planos mensal, quinzenal e semanal; o plano e do aluno.
- Mensalidades por competencia seguindo as regras de cobranca da academia ([15-regras-de-cobranca.md](15-regras-de-cobranca.md)); pagamento registrado manualmente, sem gateway.
- Dashboard da academia (aulas de hoje, alunos matriculados, presencas, mensalidades).

Removido: **reposicao de aula** (entidade, tela e regras), por decisao de produto; nao volta sem nova decisao.

Ainda nao implementado: controle de faixas/graus, responsavel financeiro de aluno menor, escopo "instrutor ve so as proprias turmas".

### Diferenca para a recorrencia simples do Modelo 1

A recorrencia do Modelo 3 e estruturalmente diferente da recorrencia simples do Modelo 1:

- Modelo 1: cada ocorrencia e um compromisso individual (um cliente, um servico, um profissional). A recorrencia apenas repete esse compromisso ao longo do tempo.
- Modelo 3: cada aula pode reunir varios alunos em uma turma, com matricula e controle de presenca/frequencia. A recorrencia organiza um calendario coletivo, nao a repeticao de um atendimento individual.

Por isso, a recorrencia simples do Modelo 1 nao implementa o modelo de turmas; o Modelo 3 foi construido como modulo separado.

### Status no roadmap

Implementado no frontend mockado e **MVP ativo** (academia de lutas). Specs: [11-modelo-3-turmas.md](11-modelo-3-turmas.md) e [14-mvp-academia-lutas.md](14-mvp-academia-lutas.md).

## Regra de evolucao

Novos modelos operacionais nao devem alterar a linguagem simples do MVP. Eles devem ser adicionados como extensoes progressivas do conceito de compromisso operacional.

> Como aplicar na arquitetura (Modelos 2 e 3): ver [`technical/01-extensao-modelos-operacionais.md`](../technical/01-extensao-modelos-operacionais.md) — modulos separados, reusando a fundacao, sem genericizar o nucleo do Modelo 1 (Service/Appointment/Agenda).
