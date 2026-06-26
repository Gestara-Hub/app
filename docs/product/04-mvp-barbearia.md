# MVP Barbearia

## Decisao

O primeiro MVP do GestaraHub sera uma experiencia frontend mockada baseada em uma barbearia ficticia.

O objetivo e validar o nucleo operacional: clientes, equipe, servicos, agenda e agendamentos.

## Cenario base

A barbearia ficticia deve representar um pequeno negocio realista:

- 1 organizacao
- 1 unidade simulada
- 4 profissionais
- 12 servicos
- Funcionamento de segunda a sabado
- Clientes recorrentes
- Agendamentos com diferentes status
- Dias cheios, dias vazios e horarios livres
- Receita estimada a partir dos servicos concluidos ou previstos

## Objetivo do MVP

Permitir que a barbearia gerencie sua rotina de agendamentos de ponta a ponta no frontend, usando dados mockados realistas.

O MVP deve permitir que o usuario:

- Entre no sistema por uma tela de login mockada.
- Veja o resumo operacional do dia.
- Navegue para a agenda.
- Escolha data, horario e profissional.
- Crie um agendamento para um cliente e servico.
- Edite, confirme, cancele, conclua ou marque no-show.
- Consulte clientes, equipe e servicos.

## Escopo

### Autenticacao visual mockada

- Login sem backend real.
- Sessao simulada.
- Usuario inicial com perfil de proprietario/admin.

### Dashboard operacional

- Cards de indicadores do dia.
- Lista de proximos atendimentos.
- Resumo de ocupacao por profissional.
- Alertas ou destaques operacionais simples.

### Agenda

- Visao diaria.
- Visao semanal.
- Visao mensal.
- Filtro por profissional.
- Criacao de agendamento.
- Edicao de agendamento.
- Cancelamento.
- Conclusao.
- Mudanca de status.

### Clientes

- Lista.
- Busca.
- Cadastro.
- Edicao.
- Inativacao.
- Historico mockado de agendamentos.

### Equipe

- Lista de profissionais.
- Cadastro.
- Edicao.
- Status ativo/inativo.
- Servicos realizados.
- Disponibilidade basica.

### Servicos

- Lista.
- Cadastro.
- Edicao.
- Duracao.
- Preco.
- Categoria.
- Status ativo/inativo.

### Configuracoes basicas

- Dados mockados da organizacao.
- Unidade simulada.
- Horario de funcionamento.

## Fora de escopo

- Backend real.
- Persistencia real.
- Cadastro real de organizacao.
- Multiunidade operacional.
- Pagamento.
- Financeiro completo.
- Estoque.
- Comissoes.
- Integracoes externas.
- WhatsApp.
- Turmas/aulas.
- Entregas/encomendas.

## Entidades do MVP

### Cliente

Campos esperados:

- id
- nome
- telefone
- email opcional
- observacoes
- status
- criadoEm
- atualizadoEm

### Profissional

Campos esperados:

- id
- nome
- cargo ou especialidade
- telefone opcional
- status
- horariosDeTrabalho
- servicosIds
- criadoEm
- atualizadoEm

### Servico

Campos esperados:

- id
- nome
- categoria
- duracaoMinutos
- precoCentavos
- descricao opcional
- status
- criadoEm
- atualizadoEm

### Agendamento

Campos esperados:

- id
- clienteId
- profissionalId
- servicoId
- data
- inicio
- fim
- status
- observacoes
- origem
- criadoEm
- atualizadoEm

### Organizacao

Campos esperados:

- id
- nome
- segmento
- status

### Unidade

Campos esperados:

- id
- organizacaoId
- nome
- endereco opcional
- telefone opcional
- status

## Status de agendamento

- Pendente
- Confirmado
- Em atendimento
- Concluido
- Cancelado
- Nao compareceu

## Dados mockados esperados

- 20 clientes.
- 4 profissionais.
- 12 servicos.
- 40 a 80 agendamentos distribuidos em algumas semanas.
- Agendamentos no passado, presente e futuro.
- Pelo menos um dia com agenda cheia.
- Pelo menos um dia com poucos agendamentos.
- Pelo menos um profissional com agenda mais cheia que os demais.
- Historico com cancelamentos e no-shows.

## Criterios de pronto

- O usuario consegue navegar pelo fluxo principal sem backend.
- As telas usam dados mockados consistentes entre si.
- A agenda comunica claramente horario, profissional, cliente, servico e status.
- Estados vazios e de erro simulados existem onde fizer sentido.
- O modelo de dados mockado parece um contrato futuro de API.
- A estrutura visual nao bloqueia a evolucao para unidades e modulos futuros.

