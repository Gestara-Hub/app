# Modulos do Produto

## Decisao

O GestaraHub e organizado em modulos funcionais. Cada organizacao tem um modelo operacional (`scheduling` = atendimento individual, `classes` = turmas; `delivery` = entrega, sem telas), e o menu mostra so os modulos do seu modelo, filtrados tambem pelas permissoes do perfil (`components/layout/nav.ts`: `navForModel` + `can`).

| Menu | Rota | Modelo | Permissao |
| --- | --- | --- | --- |
| Dashboard | `/` | todos (conteudo por modelo) | `dashboard:view` |
| Clientes / Alunos | `/clients` | todos ("Alunos" na academia) | `clients:view` |
| Equipe | `/team` | todos | `team:view` |
| Servicos | `/services` | `scheduling` | `services:view` |
| Agenda | `/schedule` | `scheduling` | `schedule:view` |
| Turmas | `/classes` | `classes` | `classes:view` |
| Calendario | `/classes/calendar` | `classes` | `classes:view` |
| Modalidades | `/classes/modalities` | `classes` | `classes:manage` |
| Planos | `/classes/plans` | `classes` | `billing:view` |
| Mensalidades | `/classes/billing` | `classes` | `billing:view` |
| Usuarios (rodape) | `/users` | todos | `users:view` |
| Auditoria (rodape) | `/audit` | todos | `audit:view` |
| Configuracoes (rodape) | `/settings` | todos | `settings:view` |

Rotulos por modelo: o menu troca "Clientes" por "Alunos" na academia, e as mensagens/auditoria trocam "cliente/categoria" por "aluno/modalidade" (`services/nouns.ts`). Rotulos configuraveis pelo tenant (label overrides) ainda nao existem.

Convencao de vocabulario: "Equipe" e o rotulo da navegacao; "Profissional" e o termo usado no contexto de um agendamento e em telas de detalhe.

## Modulo: Agenda (Modelo 1)

### Objetivo

Centralizar a visualizacao e a gestao dos agendamentos, bloqueios e series recorrentes de cada profissional.

Agenda e Agendamentos foram **unificados** em uma tela so (`/schedule`) com duas abas: **Calendario** e **Lista**. A antiga rota `/appointments` apenas redireciona para `/schedule`.

### Usuarios envolvidos

- Proprietario/Admin
- Gerente
- Atendente
- Profissional (so a propria agenda; ver [06-perfis-permissoes.md](06-perfis-permissoes.md))

### Funcionalidades implementadas

Aba Calendario (feita a mao, sem biblioteca):

- Ver agenda por dia, semana e mes.
- Filtrar por profissional (o perfil Profissional ve so a propria agenda).
- Bloqueios e intervalos (almoco) aparecem destacados.

Aba Lista:

- Listar agendamentos ordenados por data e horario.
- Buscar por cliente; filtrar por profissional, status e periodo.

Acoes (compartilhadas entre as abas):

- Criar e editar agendamento, com **um ou mais servicos** (duracao e preco somados).
- Confirmar, iniciar atendimento, concluir, registrar nao comparecimento (motivo opcional) e cancelar (motivo obrigatorio).
- Ver detalhes do agendamento.
- Remarcar agendamento.
- Bloquear horario (folga, indisponibilidade).
- Criar agendamento recorrente (serie).

Se faltar cadastro (cliente, profissional ou servico), o formulario mostra atalhos para cadastrar antes de agendar.

#### Remarcar agendamento

- Mover um agendamento para outro horario e/ou outro profissional, mantendo o mesmo cliente e os mesmos servicos.
- Mantem rastro no historico do agendamento (horario/profissional anterior e motivo opcional) e registra na Auditoria; nao transforma o agendamento em "concluido".
- Sujeita as regras de conflito e disponibilidade. Na remarcacao, fora do expediente, fora do horario do profissional e intervalo ainda bloqueiam (nao ha "remarcar mesmo assim" para esses casos; so para horario no passado).
- Se o agendamento faz parte de uma serie, a remarcacao pergunta: "somente esta ocorrencia" ou "esta e as futuras". Na opcao "esta e as futuras", ocorrencias em conflito sao puladas e informadas.

#### Bloquear horario

- Um profissional pode ter bloqueios (folga, indisponibilidade) com data, inicio, fim e motivo opcional.
- Horario bloqueado nao aceita agendamento e aparece destacado na agenda.
- Almoco nao e bloqueio: e o intervalo do horario de trabalho do profissional.

#### Criar agendamento recorrente (serie)

- Frequencias: semanal, quinzenal e mensal (mesmo dia da semana e horario).
- Termino: por numero de ocorrencias OU por data final. A serie gerada e sempre finita.
- Geracao: cria N agendamentos ligados por um `seriesId`, com origem `recurrence`.
- Conflito: ocorrencias que caem em horario ocupado, bloqueio, fora do expediente, fora do horario do profissional ou no intervalo NAO sao criadas; um aviso informa quantas ficaram de fora para resolucao manual.
- Editar e cancelar agem em uma ocorrencia por vez (o escopo "esta e as futuras" so existe na remarcacao).
- A recorrencia simples NAO transforma o produto em modelo de turmas.

### Regras

- Ver [05-regras-negocio.md](05-regras-negocio.md). Resumo: sobreposicao para o mesmo profissional e bloqueio sempre barram; fora do horario do profissional, intervalo e fora do expediente pedem confirmacao ao criar/editar.
- Status (codigo -> rotulo): `pending` -> Pendente; `confirmed` -> Confirmado; `in_service` -> Em atendimento; `completed` -> Concluido; `canceled` -> Cancelado; `no_show` -> Nao compareceu.
- Origem: `manual`, `recurrence` (futuro: `online`, `whatsapp`).

### Entidades usadas

- Cliente, Profissional, Servico, Agendamento, Bloqueio de horario, Serie (recorrencia)

### Ainda nao implementado

- Agrupar/visualizar as ocorrencias de uma serie (por `seriesId`) na Lista.
- Editar ou cancelar "esta e as futuras" ocorrencias de uma serie.
- Fluxo guiado de resolucao das ocorrencias que ficaram em conflito.

### Fora de escopo no MVP

- Encaixe com sobreposicao para o mesmo profissional.
- Sincronizacao com Google Calendar.
- Recorrencia avancada (alem de semanal, quinzenal e mensal).
- Confirmacao automatica por WhatsApp.
- Agendamento online pelo cliente.
- Exportacao da lista e edicao em lote.

## Modulo: Clientes / Alunos

### Objetivo

Organizar o cadastro de clientes (Modelo 1) ou alunos (Modelo 3, mesmo `Client`).

### Funcionalidades implementadas

- Listar, buscar por nome ou telefone e filtrar por status.
- Criar, editar, inativar e reativar (com confirmacao).
- Dados: nome, telefone (WhatsApp), e-mail, observacoes e endereco estruturado (CEP, rua, numero, complemento etc.).
- Na academia, o cadastro do aluno inclui o plano: plano de acesso, data de inicio, 1ª cobranca calculada pelo motor, regra de cobranca propria (momento do pagamento, entrada no meio do periodo), dia de vencimento, situacao da assinatura (ativa, pausada, cancelada) e desconto (percentual ou fixo, com motivo). Ver [15-regras-de-cobranca.md](15-regras-de-cobranca.md).

### Ainda nao implementado

- Tela de historico do cliente (agendamentos, presencas ou cobrancas de um cliente especifico). O historico existe so por agendamento e na Auditoria.

### Fora de escopo no MVP

- CRM avancado, segmentacao, campanhas, importacao de contatos.

## Modulo: Equipe

### Objetivo

Gerenciar os profissionais (Modelo 1) ou professores/instrutores (Modelo 3).

### Funcionalidades implementadas

- Listar, criar, editar, inativar e reativar profissionais.
- Horario de trabalho por dia da semana com intervalo (almoco) opcional. O cadastro pode comecar sem horario.
- Modelo 1: servicos que o profissional realiza (informativo; nao restringe o agendamento).
- Modelo 3: modalidades que o instrutor leciona (`modalityIds`); so instrutores da modalidade aparecem no formulario da turma.
- Cargo **opcional** (entidade `Role`), escolhido numa lista filtravel que so aceita cargos existentes; os cargos sao criados no CRUD de Cargos, aberto a partir da tela Equipe.
- Telefone e endereco opcionais.

### Fora de escopo no MVP

- Folha de pagamento, comissoes, controle de ponto.

## Modulo: Servicos (Modelo 1)

### Objetivo

Gerenciar os servicos oferecidos pelo negocio.

### Funcionalidades implementadas

- Listar, criar, editar, inativar e reativar servicos.
- Definir duracao e preco (em reais; armazenado em centavos).
- Categoria **opcional** (entidade `Category`), gerenciada no CRUD de Categorias da propria tela; sem categoria = "Sem categoria".

### Fora de escopo no MVP

- Pacotes, promocoes, precos dinamicos.

## Modulo: Turmas (Modelo 3)

### Objetivo

Gerenciar turmas recorrentes, matriculas, aulas e presenca.

### Funcionalidades implementadas

- Listar, criar, editar, desativar e reativar turmas: nome, modalidade, instrutor titular, capacidade, data de inicio, encontros semanais (dia + inicio + fim) e aceite de alunos avulsos com valor da aula avulsa.
- Detalhe da turma: ocupacao, matriculados com frequencia, matricular alunos (turma lotada pede "Matricular mesmo assim"), cancelar matricula, lista de espera (adicionar, promover, remover).
- Detalhe da aula (`/classes/sessions/[id]`): lista de chamada com matriculados, avulsos e experimentais; marcar presenca (presente, falta, justificada); adicionar aluno avulso ou experimental; remover da aula; instrutor substituto e restaurar titular.

Regras em [05-regras-negocio.md](05-regras-negocio.md). Reposicao de aula foi removida.

### Ainda nao implementado

- Instrutor ver so as proprias turmas (hoje o perfil Profissional ve todas).

## Modulo: Calendario (Modelo 3)

- Grade semanal das aulas geradas a partir dos encontros das turmas, com atalho para a lista de chamada de cada aula. E a rota inicial da academia para quem nao ve o Dashboard.

## Modulo: Modalidades (Modelo 3)

- CRUD de modalidades (reusa `Category`): criar, editar, inativar e reativar. Acesso com `classes:manage`.

## Modulo: Planos (Modelo 3)

- CRUD de planos: nome, periodicidade (mensal, quinzenal, semanal) e valor (maior que zero). Inativar e reativar com confirmacao.

## Modulo: Mensalidades (Modelo 3)

- Cobrancas por competencia (mes), filtro por tipo (mensalidade ou avulsa).
- Gerar cobrancas da competencia (idempotente), registrar pagamento com forma de pagamento, desfazer pagamento, cancelar, reabrir e "resetar cobrancas" (nunca apaga pagas).
- Atrasado calculado na leitura. Regras completas em [15-regras-de-cobranca.md](15-regras-de-cobranca.md); motor em [`../technical/02-motor-de-cobranca.md`](../technical/02-motor-de-cobranca.md).
- Sem gateway de pagamento.

## Modulo: Dashboard

### Objetivo

Dar uma visao rapida do dia. O conteudo depende do modelo.

### Modelo 1 (atendimento)

- Cartoes: Agendamentos hoje, Receita estimada, Concluidos hoje, A confirmar.
- Proximos agendamentos (pendentes e confirmados de hoje).
- Por profissional (quantidade de agendamentos do dia).

### Modelo 3 (academia)

- Cartoes: Aulas hoje, Alunos matriculados, Presencas hoje, Mensalidades recebidas.
- Aulas de hoje (com acesso a lista de chamada), Ocupacao das turmas, Mensalidades do mes.

### Ainda nao implementado

- Cartao de cancelamentos e no-shows.

### Fora de escopo no MVP

- BI avancado, comparativos historicos, metas, exportacoes.

## Modulo: Usuarios

- CRUD de usuarios em `/users`: nome, e-mail (unico), perfil, vinculo opcional com profissional, inativar/reativar.
- Proprietario gerencia todos os perfis; Gerente so Atendente e Profissional.
- Nao e possivel inativar a si mesmo nem inativar/rebaixar o ultimo proprietario ativo.
- Sem senha nem convite por e-mail (login por selecao no mock).

## Modulo: Auditoria

- Log imutavel em `/audit`: quem fez, o que, quando, com detalhe das mudancas. Busca e filtro por tipo de entidade.
- Proprietario ve tudo; Gerente ve eventos operacionais e eventos de usuarios Atendente/Profissional (filtro aplicado no service).
- Cobre cadastros, usuarios, configuracoes, agendamentos, turmas, matriculas, aulas avulsas e operacoes financeiras.
- Ainda nao auditados: criacao de serie recorrente, bloqueios de horario, presenca, lista de espera e instrutor substituto.

## Modulo: Configuracoes

### Funcionalidades implementadas

Abas:

- **Geral:** nome da organizacao, nome da unidade, telefone/WhatsApp, endereco da unidade e, na academia, **Regras de Cobranca** com previa calculada pelo motor.
- **Horarios:** horario de funcionamento da unidade por dia, com varios turnos por dia. Salvar horarios que deixam aulas fora do expediente pede confirmacao.
- **Dados de exemplo:** zerar os mocks (volta ao seed vazio, so com os proprietarios).

### Fora de escopo no MVP

- Multiunidade completa.
- Integracoes e configuracao de add-ons.
- Rotulos por segmento configuraveis pelo usuario.

## Modulo: Onboarding

- Checklist de primeiros passos por modelo, com atalhos para cada tela, banner no topo e dialogo de boas-vindas.
  - Academia: horario de funcionamento, regras de cobranca, modalidades, planos, professores/instrutores, alunos, primeira turma.
  - Atendimento: horario de funcionamento, servicos, equipe, clientes, primeiro agendamento.
- Tour guiado pelos itens do menu.

## Modulo: Personalizador de tema

- Cor base, cor de destaque, raio, fonte, estilo e cor do menu, com presets; tema claro/escuro. Sidebar escura por padrao. Acesso pela barra superior. Ver [`../frontend/06-decisoes-de-interface.md`](../frontend/06-decisoes-de-interface.md).

## Modulos futuros

- Unidades (multiunidade, Fase 5)
- Relatorios gerenciais
- Financeiro completo do tenant (gateway, cobranca automatica)
- Estoque
- Comissoes
- WhatsApp e automacoes
- Entregas/encomendas (Modelo 2)
- Rotulos por segmento (label overrides)
