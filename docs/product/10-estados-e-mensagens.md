# Estados e Mensagens

## Decisao

O MVP da barbearia Corte Nobre deve tratar de forma consistente os estados transversais de tela (carregando, vazio, erro, com dados), os estados especificos da Agenda, as validacoes de formulario e as mensagens de confirmacao de acoes sensiveis. Este documento padroniza esses estados e textos para que telas mockadas, modelo de dados futuro e testes compartilhem a mesma referencia.

A linguagem segue a navegacao unica e generica do MVP: Clientes, Equipe, Servicos, Agenda e Agendamentos. O termo "Profissional" e usado no contexto de um agendamento e em telas de detalhe. A arquitetura conceitual deve prever um sistema FUTURO de rotulos por segmento (label overrides) que permita trocar, por exemplo, "Clientes" por "Alunos" sem reescrever telas. Esse sistema NAO entra no MVP; aqui todas as mensagens usam os rotulos genericos.

## Contexto

No MVP nao existe backend real: dados sao mockados e o "erro" e simulado. Ainda assim, os estados de carregando, vazio e erro devem existir onde fizer sentido, porque fazem parte do contrato visual que o produto evoluira para uma API. Os textos abaixo sao a referencia; a implementacao pode ajustar a forma sem mudar o sentido.

## Escopo

- Estados de lista (carregando, vazio, erro simulado, com dados).
- Estados da Agenda (dia sem agendamentos, profissional sem horarios livres, horario bloqueado, conflito de horario).
- Validacoes e mensagens de erro por campo nos formularios de Cliente, Servico, Profissional e Agendamento.
- Mensagens de confirmacao para acoes sensiveis (cancelar agendamento, remarcar, excluir serie).
- Empty states com call-to-action.
- Lista consolidada das principais validacoes do MVP.

## Fora de escopo

- Mensagens de erro vindas de backend real (o erro do MVP e simulado).
- Internacionalizacao e troca de idioma.
- Rotulos por segmento (label overrides). As mensagens usam linguagem unica e generica.
- Mensagens de origens `online` e `whatsapp` (origens futuras).
- Encaixe manual com alerta de conflito. No MVP, sobreposicao para o mesmo profissional e sempre bloqueada (mensagem de bloqueio, nunca de "confirmar encaixe").

## Estados de lista

Aplicam-se as listas de Clientes, Equipe, Servicos e Agendamentos. Toda lista deve representar quatro estados.

| Estado | Quando ocorre | O que mostrar |
| --- | --- | --- |
| Carregando | Enquanto o mock simula a busca dos dados. | Indicador de carregamento (skeleton ou spinner). Nao mostrar lista vazia como se fosse "sem dados". |
| Com dados | Existe ao menos um registro. | A lista preenchida, com busca e filtros disponiveis. |
| Vazio (sem dados) | Nao ha nenhum registro cadastrado. | Empty state com call-to-action (ver "Empty states com call-to-action"). |
| Vazio por filtro/busca | Ha registros, mas nenhum atende ao filtro/busca atual. | Mensagem "Nenhum resultado para esta busca." com acao "Limpar busca" ou "Limpar filtros". Nao oferecer "cadastrar" como acao principal aqui. |
| Erro simulado | O mock simula falha ao carregar. | Mensagem de erro com acao "Tentar novamente". |

Textos de referencia por contexto:

| Contexto | Vazio (sem dados) | Erro simulado |
| --- | --- | --- |
| Clientes | "Nenhum cliente cadastrado ainda." | "Nao foi possivel carregar os clientes. Tente novamente." |
| Equipe | "Nenhum profissional cadastrado ainda." | "Nao foi possivel carregar a equipe. Tente novamente." |
| Servicos | "Nenhum servico cadastrado ainda." | "Nao foi possivel carregar os servicos. Tente novamente." |
| Agendamentos | "Nenhum agendamento neste periodo." | "Nao foi possivel carregar os agendamentos. Tente novamente." |

## Estados da Agenda

A Agenda tem estados proprios alem dos estados de lista. Eles devem ser visualmente claros, conforme exigido pelos Criterios de pronto do MVP.

### Dia sem agendamentos

- Quando: o dia (ou periodo filtrado) nao tem nenhum agendamento.
- Mostrar: estado vazio com chamada para acao. Texto: "Nenhum agendamento neste dia." Acao: "Novo agendamento".
- Exemplo do cenario: uma terca fraca da Corte Nobre, ou a agenda do Diego Santos (junior, agenda mais vazia) em um dia tranquilo.

### Profissional sem horarios livres

- Quando: o profissional filtrado nao tem nenhum horario disponivel no periodo (agenda cheia, fora do expediente ou totalmente bloqueada).
- Mostrar: aviso de indisponibilidade. Texto: "Sem horarios livres para [Profissional] neste periodo." Sugerir: trocar a data ou escolher outro profissional.
- Exemplo do cenario: um sabado cheio na agenda do Marcelo Andrade (proprietario, agenda mais cheia).

### Horario bloqueado

- Quando: existe um bloqueio (folga, almoco, indisponibilidade) cobrindo o horario.
- Mostrar: o intervalo destacado como bloqueado na Agenda, com o motivo quando houver. Texto no slot: "Bloqueado" + motivo opcional (ex.: "Bloqueado - Almoco").
- Comportamento: horario bloqueado nao aceita agendamento. Ao tentar agendar sobre ele, exibir o erro de bloqueio (ver "Validacoes").

### Conflito de horario

- Quando: a acao tentaria criar ou mover um agendamento para um horario que se sobrepoe a outro agendamento do mesmo profissional, cai fora do expediente ou cai sobre um bloqueio.
- Mostrar: mensagem de conflito que impede a confirmacao. Textos de referencia:
  - Sobreposicao: "Este horario ja esta ocupado para [Profissional]." (no MVP nao ha encaixe; a acao e bloqueada)
  - Fora do expediente: "Horario fora do expediente para esta data."
  - Sobre bloqueio: "Este horario esta bloqueado e nao aceita agendamento."
- Recorrencia: quando uma ocorrencia de uma serie cai em conflito, ela NAO e criada automaticamente; e sinalizada como conflito e fica pendente de resolucao manual. Texto de referencia: "[N] ocorrencia(s) em conflito nao foram criadas. Resolva manualmente." As ocorrencias sem conflito sao criadas normalmente.

## Estados de formulario

Os formularios devem validar na confirmacao (e, quando ajudar, ao sair do campo). Mensagens de erro ficam proximas do campo. Acao de salvar permanece desabilitada ou retorna erro enquanto houver campo invalido.

### Formulario de Cliente

| Campo | Regra | Mensagem de erro |
| --- | --- | --- |
| nome | Obrigatorio, nao vazio. | "Informe o nome do cliente." |
| telefone | Obrigatorio. | "Informe o telefone do cliente." |
| telefone | Formato valido quando preenchido. | "Telefone invalido." |
| email | Opcional; se preenchido, formato valido. | "E-mail invalido." |
| status | Valor valido (ativo/inativo). | "Selecione um status valido." |

### Formulario de Servico

| Campo | Regra | Mensagem de erro |
| --- | --- | --- |
| nome | Obrigatorio, nao vazio. | "Informe o nome do servico." |
| categoria | Obrigatoria (Cabelo, Barba, Cuidados, Combos). | "Selecione uma categoria." |
| duracaoMinutos | Obrigatoria; numero maior que 0. | "A duracao deve ser maior que zero." |
| precoCentavos | Obrigatorio; numero maior ou igual a 0. | "O preco nao pode ser negativo." |
| status | Valor valido (ativo/inativo). | "Selecione um status valido." |

Observacao: precos seguem o CANON da Corte Nobre (ex.: Corte Masculino R$ 45,00 / 4500 centavos; Combo Completo R$ 90,00 / 9000 centavos). O campo aceita R$ 0,00 (gratuito) mas nunca valor negativo.

### Formulario de Profissional (Equipe)

| Campo | Regra | Mensagem de erro |
| --- | --- | --- |
| nome | Obrigatorio, nao vazio. | "Informe o nome do profissional." |
| cargo/especialidade | Obrigatorio. | "Informe o cargo ou a especialidade." |
| telefone | Opcional; se preenchido, formato valido. | "Telefone invalido." |
| servicosIds | Ao menos um servico realizado. | "Selecione ao menos um servico que o profissional realiza." |
| horariosDeTrabalho | Inicio antes do fim em cada faixa. | "O horario de inicio deve ser anterior ao de fim." |
| status | Valor valido (ativo/inativo). | "Selecione um status valido." |

Observacao do cenario: a vinculacao de servicos por profissional reflete o CANON (ex.: Rafael Lima nao faz Relaxamento/Progressiva; Bruno Costa nao faz Corte Infantil; Diego Santos faz apenas um subconjunto). Essa relacao alimenta a validacao do Agendamento abaixo.

### Formulario de Agendamento

| Campo | Regra | Mensagem de erro |
| --- | --- | --- |
| clienteId | Obrigatorio. | "Selecione um cliente." |
| profissionalId | Obrigatorio. | "Selecione um profissional." |
| servicoId | Obrigatorio. | "Selecione um servico." |
| data | Obrigatoria. | "Selecione a data." |
| inicio (horario) | Obrigatorio. | "Selecione o horario." |
| profissional x servico | O profissional precisa realizar o servico escolhido. | "[Profissional] nao realiza este servico." |
| profissional ativo | Profissional inativo nao pode ser usado em novo agendamento. | "Este profissional esta inativo." |
| servico ativo | Servico inativo nao pode ser usado em novo agendamento. | "Este servico esta inativo." |
| expediente | Horario dentro do funcionamento da unidade/profissional. | "Horario fora do expediente para esta data." |
| bloqueio | Horario nao pode cair sobre um bloqueio. | "Este horario esta bloqueado e nao aceita agendamento." |
| sobreposicao | Sem conflito com outro agendamento do mesmo profissional. | "Este horario ja esta ocupado para [Profissional]." |

Notas:

- O horario de fim (`fim`) e calculado a partir do `inicio` e da `duracaoMinutos` do servico; nao e digitado manualmente.
- Funcionamento da Corte Nobre - Matriz: Seg a Sex 09:00-20:00, Sab 08:00-18:00, Domingo fechado. Tentar agendar no domingo cai na validacao de expediente.
- No MVP nao ha encaixe manual: qualquer sobreposicao para o mesmo profissional e sempre bloqueada (nunca oferecer "confirmar mesmo assim").

## Mensagens de confirmacao

Acoes sensiveis exigem confirmacao explicita antes de executar. Cada dialogo tem titulo, corpo e botoes (acao primaria / cancelar a operacao).

### Cancelar agendamento

- Titulo: "Cancelar agendamento?"
- Corpo: "O agendamento de [Cliente] - [Servico] com [Profissional] em [data, horario] sera cancelado. O registro permanece no historico."
- Campo obrigatorio: "Motivo do cancelamento" (texto). Confirmar sem motivo exibe "Informe o motivo do cancelamento."
- Botoes: "Cancelar agendamento" / "Voltar".
- Efeito: status vai para `cancelado`, guardando o motivo. O agendamento continua visivel no historico. Nao conta como receita estimada.

### Remarcar agendamento

- Titulo: "Remarcar agendamento?"
- Corpo: "O agendamento de [Cliente] - [Servico] sera movido para [novo profissional / nova data / novo horario]. Mantem cliente e servico e registra o rastro no historico."
- Campo opcional: "Motivo (opcional)" (texto). Quando informado, fica no rastro do historico.
- Botoes: "Remarcar" / "Voltar".
- Validacao previa: a remarcacao esta sujeita as mesmas regras de conflito e disponibilidade de um novo agendamento (expediente, bloqueio, sobreposicao). Se houver conflito, a remarcacao e impedida com a mensagem de conflito correspondente.
- A remarcacao NAO conclui o agendamento; o status nao vira "concluido".
- Se o agendamento faz parte de uma serie, antes de confirmar, perguntar o escopo:
  - Titulo: "Remarcar quais ocorrencias?"
  - Opcoes: "Somente esta ocorrencia" / "Esta e as futuras".

### Marcar como nao compareceu

- Titulo: "Marcar como nao compareceu?"
- Corpo: "O agendamento de [Cliente] - [Servico] com [Profissional] em [data, horario] sera marcado como nao compareceu. O registro permanece no historico."
- Campo opcional: "Motivo (opcional)" (texto). Quando informado, fica no historico.
- Botoes: "Nao compareceu" / "Voltar".
- Efeito: status vai para `nao_compareceu`, guardando o motivo quando houver. Nao conta como receita realizada.

### Excluir / cancelar serie recorrente

Quando a acao incide sobre uma ocorrencia ligada a um `serieId`, perguntar o escopo antes de confirmar.

- Titulo: "Aplicar a quais ocorrencias?"
- Opcoes:
  - "Somente esta ocorrencia" - afeta apenas o agendamento selecionado.
  - "Esta e as futuras" - afeta a ocorrencia atual e todas as seguintes da serie; ocorrencias passadas/concluidas nao sao alteradas.
- Confirmacao final (escopo "esta e as futuras"):
  - Titulo: "Excluir esta e as futuras ocorrencias?"
  - Corpo: "[N] ocorrencia(s) da serie serao removidas. Ocorrencias ja concluidas nao serao alteradas."
  - Botoes: "Excluir ocorrencias" / "Voltar".

## Empty states com call-to-action

Estados vazios "sem dados" devem orientar a proxima acao. Estados vazios "por filtro/busca" devem oferecer limpar o filtro, nao cadastrar.

| Tela | Mensagem | Call-to-action |
| --- | --- | --- |
| Clientes (sem dados) | "Nenhum cliente cadastrado ainda." | "Cadastrar cliente" |
| Equipe (sem dados) | "Nenhum profissional cadastrado ainda." | "Adicionar profissional" |
| Servicos (sem dados) | "Nenhum servico cadastrado ainda." | "Cadastrar servico" |
| Agenda - dia sem agendamentos | "Nenhum agendamento neste dia." | "Novo agendamento" |
| Agendamentos (sem dados no periodo) | "Nenhum agendamento neste periodo." | "Novo agendamento" |
| Historico do cliente vazio | "Este cliente ainda nao tem agendamentos." | "Novo agendamento" |
| Qualquer lista - vazio por busca | "Nenhum resultado para esta busca." | "Limpar busca" |
| Qualquer lista - vazio por filtro | "Nenhum resultado para os filtros aplicados." | "Limpar filtros" |
| Erro simulado (qualquer lista) | "Nao foi possivel carregar os dados." | "Tentar novamente" |

## Principais validacoes (resumo)

Lista consolidada das regras que disparam erro ou bloqueio no MVP.

### Cliente

- Nome obrigatorio.
- Telefone obrigatorio (e valido quando preenchido).
- E-mail opcional; valido se preenchido.

### Servico

- Nome obrigatorio.
- Categoria obrigatoria.
- Duracao maior que zero (duracao > 0).
- Preco maior ou igual a zero (preco >= 0); nunca negativo.

### Profissional (Equipe)

- Nome obrigatorio.
- Cargo/especialidade obrigatorio.
- Ao menos um servico realizado.
- Em cada faixa de horario de trabalho, inicio anterior ao fim.

### Agendamento

- Exige cliente + profissional + servico + data + horario.
- O profissional precisa realizar o servico escolhido.
- Profissional inativo nao pode ser usado em novo agendamento.
- Servico inativo nao pode ser usado em novo agendamento.
- Nao permitir horario fora do expediente da unidade/profissional.
- Nao permitir horario bloqueado.
- Nao permitir sobreposicao com outro agendamento do mesmo profissional (sempre bloqueada; sem encaixe no MVP).
- O horario de fim e derivado do inicio + duracao do servico.

### Recorrencia (serie)

- Frequencia obrigatoria: semanal, quinzenal ou mensal.
- Termino obrigatorio: por numero de ocorrencias OU por data final (sem opcao infinita).
- Ocorrencias em conflito (ocupado, fora do expediente, bloqueio) nao sao criadas automaticamente; ficam sinalizadas como conflito para resolucao manual.

## Conexao com os Criterios de pronto do MVP

Estes estados e mensagens atendem diretamente aos Criterios de pronto descritos em `04-mvp-barbearia.md`:

| Criterio de pronto (04-mvp-barbearia.md) | Como este documento atende |
| --- | --- |
| "O usuario consegue navegar pelo fluxo principal sem backend." | Estados de carregando/erro simulados sem backend real; confirmacoes e validacoes funcionam sobre dados mockados. |
| "As telas usam dados mockados consistentes entre si." | Mensagens e validacoes referenciam o CANON da Corte Nobre (servicos, precos, profissionais x servicos, expediente). |
| "A agenda comunica claramente horario, profissional, cliente, servico e status." | Estados da Agenda (dia sem agendamentos, sem horarios livres, bloqueado, conflito) tornam o estado da agenda explicito. |
| "Estados vazios e de erro simulados existem onde fizer sentido." | Estados de lista (carregando, vazio, vazio por filtro, erro) e empty states com call-to-action padronizados. |
| "O modelo de dados mockado parece um contrato futuro de API." | Validacoes por campo espelham as restricoes que uma API real aplicaria (obrigatoriedade, duracao > 0, preco >= 0, conflitos). |
| "A estrutura visual nao bloqueia a evolucao para unidades e modulos futuros." | Mensagens usam linguagem unica e generica, com previsao do sistema futuro de rotulos por segmento sem reescrever telas. |

## Pendencias

- Definir o tom e o microtexto final dos botoes de confirmacao com o time de design (este documento fixa o sentido, nao o estilo).
- Definir o fluxo de tela para resolver ocorrencias de recorrencia sinalizadas como conflito (resolucao manual).
- Definir como o historico exibe o rastro de remarcacao (formato e nivel de detalhe), em alinhamento com as pendencias de `05-regras-negocio.md`.
