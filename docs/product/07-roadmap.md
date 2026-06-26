# Roadmap

## Decisao

O roadmap deve preservar a visao maior do GestaraHub sem permitir que ela aumente o escopo do MVP.

## Fase 1: Refinamento e especificacao

Objetivo:

- Consolidar visao do produto.
- Definir modulos e regras.
- Definir MVP de barbearia.
- Criar skills e definicoes tecnicas do projeto.

Refinamentos ja aplicados nesta fase:

- Cenario de referencia definido: Barbearia Corte Nobre (organizacao ativa, 1 unidade, 4 profissionais, 12 servicos, 20 clientes e agendamentos mock cobrindo passado, presente e futuro). E a fonte unica de verdade para os mocks.
- Linguagem hibrida decidida: no MVP a interface usa uma linguagem unica e generica (Clientes, Equipe, Servicos, Agenda, Agendamentos). A arquitetura conceitual ja preve um sistema FUTURO de rotulos por segmento (label overrides), sem reescrever telas. Esse sistema NAO entra no MVP.
- Vocabulario resolvido: "Equipe" e o rotulo da navegacao; "Profissional" e usado no contexto de um agendamento e em telas de detalhe.
- Regras operacionais do MVP especificadas: Remarcacao, Bloqueio de horario e Recorrencia simples.
- Regra de conflito definida: no MVP, sobreposicao de horario para o mesmo profissional e SEMPRE bloqueada. Encaixe manual com alerta de conflito fica FORA do MVP (futuro).
- Estados e enums documentados: status de agendamento (pendente, confirmado, em_atendimento, concluido, cancelado, nao_compareceu) e origem (manual, recorrencia; futuro: online, whatsapp).
- Fluxos principais documentados (agendamento, remarcacao, bloqueio e recorrencia) com seus estados.

Status:

- Em andamento.

## Fase 2: Frontend mockado

Objetivo:

- Construir a experiencia principal do GestaraHub sem backend real.
- Validar navegacao, fluxos, estados e modelo de dados.
- Implementar a linguagem unica e generica do MVP, mantendo a arquitetura preparada para rotulos por segmento no futuro.

Inclui:

- Login mockado.
- Dashboard operacional.
- Agenda.
- Clientes.
- Equipe.
- Servicos.
- Configuracoes basicas.
- Mock API ou camada equivalente, alimentada pelo cenario Corte Nobre.

Regras operacionais no escopo do frontend mockado:

- Remarcacao: mover um agendamento para outro horario e/ou outro profissional, mantendo cliente e servico; sujeita as regras de conflito e disponibilidade; mantem rastro no historico; para series, pergunta "somente esta ocorrencia" ou "esta e as futuras".
- Bloqueio de horario: um profissional pode ter bloqueios (folga, almoco, indisponibilidade) com data, inicio, fim e motivo opcional; horario bloqueado nao aceita agendamento e aparece destacado na agenda.
- Recorrencia simples: frequencias semanal, quinzenal e mensal; termino por numero de ocorrencias ou por data final (sem opcao infinita); gera serie finita ligada por serieId; edicao/cancelamento com "somente esta ocorrencia" ou "esta e as futuras"; ocorrencia em horario ocupado, fora do expediente ou em bloqueio e sinalizada como conflito e NAO e criada automaticamente.

## Fase 3: Contratos e construcao do backend

Objetivo:

- Transformar mocks em contratos de API.
- Construir o backend do zero, sem reaproveitar a v1.
- Integrar autenticacao, organizacao, unidade, usuarios e permissoes.

Inclui:

- Definicao da arquitetura e do stack do novo backend.
- Definicao de endpoints.
- DTOs e contratos.
- IAM proprio (autenticacao, organizacao, unidade, usuarios e permissoes) construido do zero.
- Persistencia real.
- Testes de integracao.

## Fase 4: Gerencial basico

Objetivo:

- Adicionar indicadores simples para tomada de decisao.

Inclui:

- Ocupacao por profissional.
- Receita estimada por periodo.
- Cancelamentos.
- No-show.
- Servicos mais realizados.
- Clientes recorrentes.

## Fase 5: Unidades

Objetivo:

- Permitir que uma organizacao tenha mais de uma unidade.

Inclui:

- Seletor de unidade.
- Agenda por unidade.
- Equipe por unidade.
- Servicos por unidade ou compartilhados.
- Permissoes por unidade.

## Fase 6: Novos modelos operacionais

Objetivo:

- Evoluir alem do atendimento individual.

Possibilidades:

- Entregas/encomendas.
- Turmas/aulas.
- Recursos, salas ou equipamentos.
- Recorrencia.
- Presenca/frequencia.

## Fase 7: Add-ons

Objetivo:

- Criar modulos adicionais ativaveis conforme necessidade do negocio.

Possibilidades:

- Financeiro.
- Estoque.
- Comissoes.
- WhatsApp.
- Automacoes.
- Campanhas.
- Relatorios avancados.
