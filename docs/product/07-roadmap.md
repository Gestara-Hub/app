# Roadmap

## Decisao

O roadmap deve preservar a visao maior do GestaraHub sem permitir que ela aumente o escopo do MVP.

> **Pivot do MVP:** o MVP ativo passou a ser a **academia (Modelo 3, turmas)**, validada com um parceiro de design real. A barbearia Corte Nobre (Modelo 1) foi o primeiro recorte construido e segue funcionando com escopo congelado. Ver [14-mvp-academia-lutas.md](14-mvp-academia-lutas.md) e [00-visao-produto.md](00-visao-produto.md).

## Fase 1: Refinamento e especificacao

Objetivo:

- Consolidar visao do produto.
- Definir modulos e regras.
- Definir MVP de barbearia (congelado) e depois o MVP da academia (ativo).
- Criar skills e definicoes tecnicas do projeto.

Refinamentos ja aplicados nesta fase:

- Seed: **ambiente vazio**. Dois tenants (Corte Nobre, `scheduling`; Academia X, `classes`), cada um so com organizacao, unidade e proprietario; tudo e cadastrado pela UI. Antes: o cenario Corte Nobre completo (4 profissionais, 12 servicos, 20 clientes, agendamentos mock) era semeado; hoje fica so como referencia em [08-barbearia-corte-nobre.md](08-barbearia-corte-nobre.md).
- Linguagem hibrida decidida: termos genericos, com troca fixa de rotulos por modelo operacional (ex.: "Alunos" na academia). Rotulos por segmento configuraveis (label overrides) continuam futuros.
- Vocabulario resolvido: "Equipe" e o rotulo da navegacao; "Profissional" e usado no contexto de um agendamento e em telas de detalhe.
- Regras operacionais do MVP especificadas: Remarcacao, Bloqueio de horario e Recorrencia simples.
- Regra de conflito definida: sobreposicao para o mesmo profissional e bloqueio de horario sao SEMPRE barrados. Fora do horario do profissional, intervalo e fora do expediente viraram confirmacao ao criar/editar ([05-regras-negocio.md](05-regras-negocio.md)). Encaixe com sobreposicao fica FORA do MVP.
- Estados e enums documentados, com codigos em ingles: status de agendamento (`pending`, `confirmed`, `in_service`, `completed`, `canceled`, `no_show`) e origem (`manual`, `recurrence`; futuro: `online`, `whatsapp`).
- Regras de cobranca da academia decididas: [15-regras-de-cobranca.md](15-regras-de-cobranca.md).
- Fluxos principais documentados (agendamento, remarcacao, bloqueio e recorrencia) com seus estados.

Status:

- Em andamento.

## Fase 2: Frontend mockado

Objetivo:

- Construir a experiencia principal do GestaraHub sem backend real.
- Validar navegacao, fluxos, estados e modelo de dados.
- Implementar a linguagem generica com rotulos por modelo operacional.

Ja construido (dados mockados em `@/mocks/store` + services que simulam a API):

- Login mockado por selecao de usuario, com troca de usuario e de organizacao.
- Multi-tenant no mock, com um modelo operacional por organizacao ([`../technical/03-multi-tenant-e-escopo.md`](../technical/03-multi-tenant-e-escopo.md)).
- Dashboard por modelo (atendimento e academia).
- Clientes/Alunos, Equipe (com Cargos), Configuracoes editaveis (organizacao, unidade, endereco, horarios com varios turnos, Regras de Cobranca, zerar dados).
- Modelo 1: Servicos (com Categorias), Agenda unificada (Calendario Dia/Semana/Mes + Lista), agendamento com varios servicos, remarcacao, bloqueio de horario, recorrencia simples.
- Modelo 3: Turmas, Calendario, Modalidades, Planos, Mensalidades, matricula, lista de espera, aula avulsa/experimental, instrutor substituto, presenca.
- Usuarios e RBAC ([06-perfis-permissoes.md](06-perfis-permissoes.md)).
- Auditoria.
- Onboarding (checklist por modelo, boas-vindas, tour).
- Personalizador de tema.
- Testes automatizados: motor de cobranca, services e e2e com Playwright ([`../technical/04-estrategia-de-testes.md`](../technical/04-estrategia-de-testes.md)).

Regras operacionais do Modelo 1 no frontend mockado:

- Remarcacao: mover um agendamento para outro horario e/ou outro profissional, mantendo cliente e servicos; sujeita as regras de disponibilidade; mantem rastro; para series, pergunta "somente esta ocorrencia" ou "esta e as futuras".
- Bloqueio de horario: folga ou indisponibilidade com data, inicio, fim e motivo opcional; horario bloqueado nao aceita agendamento e aparece destacado na agenda. O almoco e o intervalo do horario de trabalho.
- Recorrencia simples: semanal, quinzenal e mensal; termino por numero de ocorrencias ou por data final; serie finita ligada por `seriesId`; ocorrencias em conflito nao sao criadas e sao informadas. Editar/cancelar "esta e as futuras" ainda nao implementado.

Status:

- Em andamento (refinamento do MVP da academia antes do backend).

## Fase 3: Contratos e construcao do backend

Objetivo:

- Transformar mocks em contratos de API.
- Construir o backend do zero, sem reaproveitar a v1.
- Integrar autenticacao, organizacao, unidade, usuarios e permissoes.

Inclui:

- Definicao da arquitetura e do stack do novo backend.
- Definicao de endpoints.
- DTOs e contratos.
- IAM proprio (autenticacao, organizacao, unidade, usuarios e permissoes) construido do zero. O contrato de RBAC ja esta pronto no front (`Permission`, `PROFILE_PERMISSIONS`, `manageableProfiles`); falta o enforcement no backend.
- Motor de cobranca reaproveitado do `packages/core` ([`../technical/02-motor-de-cobranca.md`](../technical/02-motor-de-cobranca.md)).
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

Status: adiada, sem preparacao nova no front. Os contratos ja carregam `unitId` onde importa (turma, profissional, agendamento, bloqueio, serie, auditoria e mensalidade via `Charge.unitId`).

## Fase 6: Novos modelos operacionais

Objetivo:

- Evoluir alem do atendimento individual.

Situacao:

- Turmas/aulas, recorrencia de turmas e presenca/frequencia: **ja feitos no front mockado** (Modelo 3 virou o MVP ativo).
- Entregas/encomendas (Modelo 2): futuro; o modelo `delivery` esta tipado, sem telas.
- Recursos, salas ou equipamentos: futuro.

## Fase 7: Add-ons

Objetivo:

- Criar modulos adicionais ativaveis conforme necessidade do negocio.

Possibilidades:

- Financeiro. Parcialmente feito para a academia: planos, mensalidades com regras de cobranca e registro de pagamento com forma de pagamento. Ainda nao: gateway de pagamento, cobranca automatica, financeiro completo do tenant (plano pago, ver [13-modelo-de-negocio.md](13-modelo-de-negocio.md)).
- Estoque.
- Comissoes.
- WhatsApp.
- Automacoes.
- Campanhas.
- Relatorios avancados.
