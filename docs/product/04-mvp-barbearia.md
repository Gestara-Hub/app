# MVP Barbearia

## Decisao

O primeiro MVP do GestaraHub sera uma experiencia frontend mockada baseada em uma barbearia ficticia.

O objetivo e validar o nucleo operacional: clientes, equipe, servicos, agenda e agendamentos.

No MVP a interface usa uma linguagem unica e generica (Clientes, Equipe, Servicos, Agenda, Agendamentos). A arquitetura conceitual ja preve um sistema futuro de rotulos por segmento (label overrides), que permitira, por exemplo, exibir "Alunos" no lugar de "Clientes" para uma escola, sem reescrever telas. Esse sistema de rotulos NAO entra no MVP; e apenas previsao conceitual.

## Cenario base

O cenario base completo e ficticio (organizacao, unidade, profissionais, servicos, clientes e agendamentos) e a fonte unica de verdade dos dados mockados e esta documentado em `docs/product/08-barbearia-corte-nobre.md`.

Resumo dos numeros:

- 1 organizacao (Corte Nobre, segmento Barbearia).
- 1 unidade simulada (Corte Nobre - Matriz).
- 4 profissionais.
- 12 servicos.
- ~20 clientes.
- 40 a 80 agendamentos distribuidos em algumas semanas (passado, presente e futuro).

Consulte `docs/product/08-barbearia-corte-nobre.md` para nomes, especialidades, precos, horarios e o padrao esperado dos agendamentos mockados.

## Objetivo do MVP

Permitir que a barbearia gerencie sua rotina de agendamentos de ponta a ponta no frontend, usando dados mockados realistas.

O MVP deve permitir que o usuario:

- Entre no sistema por uma tela de login mockada.
- Veja o resumo operacional do dia.
- Navegue para a agenda.
- Escolha data, horario e profissional.
- Crie um agendamento para um cliente e servico.
- Edite, confirme, cancele, conclua ou marque no-show.
- Remarque um agendamento para outro horario e/ou outro profissional.
- Bloqueie horarios de um profissional (folga, almoco, indisponibilidade).
- Crie agendamentos recorrentes simples (serie finita).
- Consulte clientes, equipe e servicos.

## Escopo

### Autenticacao visual mockada

- Login sem backend real (senha irrelevante).
- Sessao simulada (cookie guarda o `userId`).
- Multiplos usuarios semeados, um por perfil (proprietario, gerente, atendente, profissional).
- Login por selecao de usuario e troca de usuario na topbar.
- RBAC aplicado de verdade na navegacao, nas acoes e nas rotas (ver `06-perfis-permissoes.md`).

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
- Remarcacao de agendamento (mover horario e/ou profissional, mantendo cliente e servico).
- Bloqueio de horario por profissional (folga, almoco, indisponibilidade).
- Recorrencia simples (serie finita de ocorrencias ligadas por um serieId).

#### Remarcacao

- Move um agendamento para outro horario e/ou outro profissional, mantendo cliente e servico.
- Mantem rastro no historico (registra que foi remarcado); o agendamento nao vira "concluido" por causa da remarcacao.
- Sujeita as mesmas regras de conflito e disponibilidade de um novo agendamento.
- Se o agendamento faz parte de uma serie, a remarcacao pergunta: "somente esta ocorrencia" ou "esta e as futuras".

#### Bloqueio de horario

- Um profissional pode ter bloqueios com data, inicio, fim e motivo opcional.
- Horario bloqueado nao aceita agendamento e aparece destacado na agenda.

#### Recorrencia simples

- Frequencias: semanal, quinzenal, mensal (mesmo dia da semana e horario).
- Termino: por numero de ocorrencias OU por data final (sem opcao infinita; gera serie finita).
- Geracao: cria N agendamentos (ocorrencias) ligados por um serieId.
- Edicao/cancelamento: opcoes "somente esta ocorrencia" ou "esta e as futuras".
- Conflito: se uma ocorrencia cair em horario ocupado, fora do expediente ou em bloqueio, ela e sinalizada como conflito e NAO e criada automaticamente (fica pendente de resolucao manual).
- E apenas repeticao de um compromisso individual; nao transforma o produto no modelo de turmas.

### Agendamentos (lista)

- Visao em lista/tabela dos agendamentos, complementar a visao de calendario da Agenda.
- Filtro por status, profissional, periodo e cliente.
- Busca por cliente.
- Ordenacao por data e horario.
- Abertura do detalhe e acoes de status (mesmas da Agenda).
- Visualizacao das ocorrencias de uma serie recorrente (por serieId).

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
- Sistema de rotulos por segmento (label overrides) - apenas previsao conceitual.
- Encaixe manual com alerta de conflito - no MVP, sobreposicao de horario para o mesmo profissional e SEMPRE bloqueada.
- Agendamento por canais online/whatsapp - no MVP a origem e sempre manual ou recorrencia.

## Entidades do MVP

Convencao multi-tenant: as entidades carregam `organizacaoId` (e `unidadeId` nas entidades ligadas a uma unidade: Profissional, Agendamento, Bloqueio, SerieRecorrencia), para que o modelo de dados ja se pareca com um contrato real de API e facilite a evolucao para multiunidade (ver 05-regras-negocio.md). No MVP existe apenas uma organizacao e uma unidade simuladas.

### Cliente

Campos esperados:

- id
- organizacaoId
- nome
- telefone
- email opcional
- observacoes
- status
- criadoEm
- atualizadoEm

### Usuario

Quem acessa o sistema (RBAC). Campos esperados:

- id
- organizacaoId
- nome
- email
- perfil (owner | manager | attendant | professional)
- profissionalId opcional (vinculo com um Professional; pode ou nao existir)
- status
- criadoEm
- atualizadoEm

Perfil de acesso (`UserProfile`) e distinto de cargo (`Role`, funcao do profissional). Detalhes e matriz de permissoes em `06-perfis-permissoes.md`.

### Profissional

Campos esperados:

- id
- organizacaoId
- unidadeId
- nome
- cargo ou especialidade
- telefone opcional
- status
- horariosDeTrabalho (por dia; com intervalo/almoço opcional — breakStart/breakEnd dentro do expediente)
- servicosIds
- criadoEm
- atualizadoEm

### Servico

Campos esperados:

- id
- organizacaoId
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
- organizacaoId
- unidadeId
- clienteId
- profissionalId
- servicoId
- data
- inicio
- fim
- status
- observacoes
- origem
- serieId opcional
- criadoEm
- atualizadoEm

### Bloqueio

Bloqueio de horario de um profissional.

Campos esperados:

- id
- organizacaoId
- unidadeId
- profissionalId
- data
- inicio
- fim
- motivo opcional
- criadoEm
- atualizadoEm

### SerieRecorrencia

Serie que agrupa as ocorrencias de um agendamento recorrente.

Campos esperados:

- id
- organizacaoId
- unidadeId
- clienteId
- profissionalId
- servicoId
- frequencia (semanal, quinzenal, mensal)
- terminoPorOcorrencias opcional
- terminoPorData opcional
- inicio (data da primeira ocorrencia)
- hora (horario das ocorrencias)
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

Chave -> rotulo:

- pendente -> Pendente
- confirmado -> Confirmado
- em_atendimento -> Em atendimento
- concluido -> Concluido
- cancelado -> Cancelado
- nao_compareceu -> Nao compareceu

## Origem de agendamento

Enum (MVP): manual, recorrencia.

Valores futuros (fora do MVP): online, whatsapp.

## Dados mockados esperados

- ~20 clientes (maioria recorrente, alguns novos, 1-2 inativos).
- 4 profissionais (Marcelo com agenda mais cheia, Diego com a mais vazia).
- 12 servicos.
- 40 a 80 agendamentos distribuidos em algumas semanas.
- Agendamentos no passado, presente e futuro.
- Pelo menos um dia com agenda cheia (um sabado).
- Pelo menos um dia com poucos agendamentos (alguma terca).
- Pelo menos um profissional com agenda mais cheia que os demais.
- Historico com cancelamentos e no-shows.
- Pelo menos uma origem manual e uma origem recorrencia.
- Ao menos 2 series recorrentes (agendamentos ligados por serieId).
- Pelo menos um bloqueio de horario de profissional.
- Pelo menos um exemplo de agendamento remarcado, com rastro no historico.

Os dados devem ser coerentes com `docs/product/08-barbearia-corte-nobre.md`.

## Criterios de pronto

- O usuario consegue navegar pelo fluxo principal sem backend.
- As telas usam dados mockados consistentes entre si e coerentes com `docs/product/08-barbearia-corte-nobre.md`.
- A agenda comunica claramente horario, profissional, cliente, servico e status.
- A agenda exibe bloqueios de horario destacados e nao permite agendar sobre eles.
- O usuario consegue remarcar um agendamento, com as mesmas regras de conflito e disponibilidade de um novo agendamento, mantendo rastro no historico.
- O usuario consegue criar uma serie recorrente simples (semanal, quinzenal ou mensal) com termino por numero de ocorrencias ou por data final, e ocorrencias em conflito ficam sinalizadas e nao sao criadas automaticamente.
- A edicao e o cancelamento de ocorrencias de uma serie oferecem as opcoes "somente esta ocorrencia" ou "esta e as futuras".
- Sobreposicao de horario para o mesmo profissional e sempre bloqueada.
- Estados vazios e de erro simulados existem onde fizer sentido.
- O modelo de dados mockado parece um contrato futuro de API.
- A estrutura visual nao bloqueia a evolucao para unidades e modulos futuros.
