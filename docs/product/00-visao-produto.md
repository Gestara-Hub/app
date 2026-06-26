# Visao do Produto

## Decisao

GestaraHub e uma plataforma de gestao operacional para pequenos e medios negocios organizarem agenda, clientes, equipe, servicos e compromissos.

O produto nasce com foco em atendimentos individuais, usando a barbearia ficticia Corte Nobre como cenario base do MVP, mas deve manter uma estrutura conceitual preparada para evoluir para entregas/encomendas, turmas/aulas, unidades e modulos gerenciais.

O cenario completo da barbearia ficticia (organizacao, unidade, profissionais, servicos, clientes e agendamentos mock) esta detalhado em `docs/product/08-barbearia-corte-nobre.md` e e a fonte unica de verdade para os dados de exemplo.

### Decisao de linguagem (hibrida)

A linguagem do produto e hibrida:

- No MVP, a interface usa uma linguagem unica e generica: Clientes, Equipe, Servicos, Agenda e Agendamentos.
- A arquitetura conceitual deve prever um sistema FUTURO de rotulos por segmento (label overrides), que permita exibir, por exemplo, "Alunos" no lugar de "Clientes" para uma escola, sem reescrever telas.
- Esse sistema de rotulos NAO entra no MVP; e apenas previsao conceitual.

No vocabulario de navegacao, "Equipe" e o rotulo do menu; "Profissional" e usado no contexto de um agendamento e em telas de detalhe.

## Contexto

A ideia inicial era uma aplicacao de controle de agendamentos para negocios como barbearias, saloes, docerias e operacoes com aulas ou turmas. Durante a evolucao, surgiram ideias de modulos gerenciais e add-ons, mas o escopo cresceu demais e dificultou a continuidade.

A retomada do projeto deve reduzir o escopo inicial sem descartar a visao maior. A estrategia e validar primeiro o frontend com dados mockados realistas, garantindo que fluxos, telas e regras operacionais facam sentido antes de investir na camada de backend.

O projeto e construido do zero. Nada da v1 (old/gestarahub-web, old/gestarahub-api) sera reaproveitado.

## Publico-alvo inicial

Pequenos e medios negocios que precisam organizar compromissos com clientes, equipe, horarios, servicos, entregas ou aulas.

Exemplos:

- Barbearias
- Saloes de beleza
- Clinicas pequenas
- Consultorias
- Docerias e confeitarias
- Professores autonomos
- Escolas pequenas
- Negocios com turmas, como judo, danca, musica ou idiomas

## Tese do produto

GestaraHub deve ser simples o bastante para um pequeno negocio usar no dia a dia, mas estruturado o bastante para crescer em modulos sem virar um sistema refeito do zero.

O centro do produto e a agenda operacional: um lugar para entender quem sera atendido, por quem, quando, com qual servico, em qual status e com quais proximas acoes.

## Principios

- Comecar pequeno e bem acabado.
- Priorizar clareza operacional sobre complexidade gerencial.
- Usar linguagem simples para o usuario final.
- No MVP, adotar uma linguagem unica e generica (Clientes, Equipe, Servicos, Agenda, Agendamentos), mantendo a arquitetura preparada para rotulos por segmento no futuro.
- Preparar a arquitetura conceitual para unidades e modulos futuros.
- Mockar dados no frontend como se fossem contratos reais de API.
- Evitar construir backend antes de validar fluxos e experiencia.

## Escopo inicial

O primeiro recorte do produto e o atendimento individual na barbearia Corte Nobre:

- Clientes
- Equipe (profissionais)
- Servicos
- Agenda
- Agendamentos
- Status operacionais
- Remarcacao de agendamentos
- Bloqueio de horario
- Recorrencia simples
- Dashboard operacional simples
- Configuracoes basicas

## Fora de escopo inicial

- Backend real
- Banco de dados real
- Pagamentos
- Estoque
- Comissoes
- WhatsApp e automacoes
- Encaixe manual com alerta de conflito (no MVP, sobreposicao para o mesmo profissional e sempre bloqueada)
- Rotulos por segmento (label overrides)
- Turmas recorrentes
- Frequencia de alunos
- Multiunidade completa
- Relatorios gerenciais avancados
- Financeiro completo

## Pendencias

- (Sem pendencias abertas nesta rodada.)
