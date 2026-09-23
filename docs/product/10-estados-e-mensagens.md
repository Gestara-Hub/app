# Estados e Mensagens

## Decisao

O GestaraHub deve tratar de forma consistente os estados transversais de tela (carregando, vazio, erro, com dados), os estados especificos da Agenda (Modelo 1) e das Turmas (Modelo 3), as validacoes de formulario e as mensagens de confirmacao de acoes sensiveis. Este documento registra esses estados e os **textos reais do codigo**, para que telas mockadas, modelo de dados futuro e testes compartilhem a mesma referencia.

Os textos entre aspas abaixo foram conferidos no codigo (componentes em `apps/web/src/features/*`, schemas Zod `*-schema.ts` e mensagens de `ApiError` nos `services/*Service.ts`). Quando o texto depende do modelo do tenant, a variante de turmas aparece entre parenteses (cliente/aluno, categoria/modalidade; ver `services/nouns.ts`).

## Contexto

Nao existe backend real: dados sao mockados e o erro de rede e simulado (`networkError`: "Não foi possível concluir a operação. Tente novamente."). Ainda assim, os estados de carregando, vazio e erro existem nas listas, porque fazem parte do contrato visual que o produto evoluira para uma API.

A validacao acontece em duas camadas: o schema Zod do formulario (texto que o usuario ve primeiro) e a validacao do service, que devolve `ApiError` com `fields` mapeados para os campos (`handleFormApiError`). Em alguns campos os textos das duas camadas diferem; os dois estao listados.

## Escopo

- Estados de lista (carregando, vazio, vazio por busca/filtro, erro, com dados).
- Estados da Agenda (dia sem agendamentos, unidade fechada, horario bloqueado, intervalo, conflitos bloqueantes e confirmacoes moles).
- Validacoes por campo nos formularios de Cliente/Aluno, Servico, Profissional e Agendamento.
- Mensagens de confirmacao para acoes sensiveis (Modelo 1 e Modelo 3).
- Modelo 3: empty states, erros de regra (`ApiError`) e confirmacoes.
- Lista consolidada das principais validacoes.

## Fora de escopo

- Mensagens de erro vindas de backend real.
- Internacionalizacao e troca de idioma.
- Sistema completo de rotulos por segmento (hoje so a troca simples cliente/aluno e categoria/modalidade).
- Mensagens de origens `online` e `whatsapp` (origens futuras).
- Encaixe sobre outro agendamento ou bloqueio: sempre recusado, nunca "confirmar encaixe".

## Estados de lista

Aplicam-se as listas de Clientes/Alunos, Equipe, Servicos, Agenda (aba Lista), Turmas, Modalidades, Planos, Mensalidades, Usuarios e Auditoria.

| Estado | Quando ocorre | O que mostrar |
| --- | --- | --- |
| Carregando | Enquanto o mock simula a busca. | Skeleton. Nao mostrar lista vazia como se fosse "sem dados". |
| Com dados | Existe ao menos um registro. | A lista, com busca e filtros. |
| Vazio (sem dados) | Nenhum registro cadastrado. | Empty state com call-to-action (ver "Empty states com call-to-action"). |
| Vazio por busca/filtro | Ha registros, mas nenhum atende. | "Nenhum resultado para esta busca." ou "Nenhum resultado para os filtros aplicados." (padrao de `ListEmptyState`), com "Limpar filtros" quando cabe. |
| Erro | O mock falha ao carregar. | Mensagem de erro + botao "Tentar novamente". |

Seletores com busca (combobox, multi-select, autocomplete) sem resultado mostram "Nenhum resultado." (alguns usam texto proprio, ex.: "Nenhum cliente.", "Nenhum profissional.", "Nenhum serviço.").

Textos de erro por contexto:

| Contexto | Erro |
| --- | --- |
| Clientes (Alunos) | "Não foi possível carregar os clientes. Tente novamente." ("...os alunos...") |
| Equipe | "Não foi possível carregar a equipe. Tente novamente." |
| Servicos | "Não foi possível carregar os serviços. Tente novamente." |
| Agenda, aba Lista | "Não foi possível carregar os agendamentos. Tente novamente." |
| Agenda, aba Calendario | "Não foi possível carregar a agenda. Tente novamente." |
| Modalidades | "Não foi possível carregar as modalidades. Tente novamente." |
| Dashboard (M1) | "Não foi possível carregar o dashboard. Tente novamente." |

## Estados da Agenda

### Dia sem agendamentos

- Calendario: "Nenhum agendamento neste dia." (visao Semana: "Nenhum agendamento nesta semana."; Mes: "Nenhum agendamento neste mês.").
- Aba Lista: "Nenhum agendamento neste período." com acao "Novo agendamento"; com filtros ativos, "Nenhum resultado para os filtros aplicados." com "Limpar filtros".

### Unidade fechada

- Quando o horario de funcionamento marca o dia como fechado, o calendario mostra "Unidade fechada nesta data.". Com o horario de funcionamento vazio (seed), nao ha dia fechado nem validacao de expediente.

### Horario bloqueado e intervalo

- Bloqueio (`TimeBlock`): faixa "Bloqueado" + motivo opcional (ex.: "Bloqueado · Folga"). Recusa agendamento.
- Intervalo do horario de trabalho: faixa "Almoço". Nao recusa: pede confirmacao (ver abaixo).

### Profissional sem horarios livres

- Ainda nao implementado: nao existe aviso "sem horarios livres". Profissional sem escala cadastrada aparece em todo dia aberto.

### Conflitos bloqueantes (sempre recusam)

Mensagens do `appointmentsService` (`slotError`), exibidas no campo de horario:

| Codigo | Mensagem |
| --- | --- |
| `OVERLAP_CONFLICT` | "Este horário já está ocupado para [Profissional]." |
| `TIME_BLOCKED` | "Este horário está bloqueado e não aceita agendamento." |

### Regras moles (confirmacao "mesmo assim" ao criar/editar)

Ao criar ou editar um agendamento, estes codigos abrem confirmacao; aceitar reenvia com o override correspondente. Na **remarcacao** e na **serie recorrente** eles sao bloqueantes e aparecem como erro, com o texto do service.

| Codigo / caso | Texto do erro (service) | Confirmacao na UI (titulo) |
| --- | --- | --- |
| `OUTSIDE_BUSINESS_HOURS` | "Fora do horário de funcionamento da unidade nesta data." | "Agendar fora do expediente da unidade?" |
| `OUTSIDE_PROFESSIONAL_HOURS` | "[Prof] não atende neste horário." | "Agendar fora do horário do profissional?" (sem escala: "Agendar sem horário de trabalho cadastrado?") |
| `ON_BREAK` | "[Prof] está em intervalo (almoço) neste horário." | "Agendar durante o intervalo?" |
| Horario no passado (so UI) | — | "Agendar para um horário no passado?" (remarcar: "Remarcar para um horário no passado?") |

Botoes: "Voltar" / "Agendar mesmo assim" ("Remarcar mesmo assim").

### Recorrencia

Ocorrencias em conflito nao sao criadas. Toasts: "Série criada com N ocorrência(s).", "N ocorrência(s) criada(s); M em conflito não foram criadas. Resolva manualmente." ou "Nenhuma ocorrência pôde ser criada (todas em conflito).". Remarcar "esta e as futuras": "N ocorrência(s) remarcada(s); M em conflito não foram remarcadas."

## Estados de formulario

Os formularios validam no envio. Mensagens ficam no campo; erros de regra sem campo viram toast.

### Formulario de Cliente / Aluno

| Campo | Regra | Mensagem (UI / service) |
| --- | --- | --- |
| `name` | Obrigatorio. | "Informe o nome." / "Informe o nome do cliente." ("...do aluno.") |
| `phone` | Obrigatorio. | "Informe o telefone." |
| `phone` | Ao menos 10 digitos. | "Informe um telefone válido." |
| `email` | Opcional; formato valido se preenchido. | "Informe um e-mail válido." |
| `dueDay` (turmas) | 1 a 31. | "Dia deve ser entre 1 e 31." |
| `discountValue` (turmas) | >= 0; percentual ate 100. | "O desconto não pode ser negativo." / "O desconto percentual não pode ser superior a 100%." |
| 1a mensalidade (turmas) | >= 0. | "O valor da 1ª mensalidade não pode ser negativo." |

Status e um switch (ativo/inativo), sem mensagem propria.

### Formulario de Servico

| Campo | Regra | Mensagem |
| --- | --- | --- |
| `name` | Obrigatorio. | "Informe o nome do serviço." |
| `categoryId` | **Opcional**; se informado, precisa existir. | "Categoria inválida." |
| `durationMinutes` | Inteiro > 0. | "A duração deve ser maior que zero." |
| `priceCents` | Obrigatorio; >= 0. | "Informe o preço." / "O preço não pode ser negativo." |
| `status` | `active` ou `inactive` (service). | "Selecione um status válido." |

Sem categoria, o servico aparece como "Sem categoria". Preco R$ 0,00 e aceito.

### Formulario de Profissional (Equipe)

| Campo | Regra | Mensagem |
| --- | --- | --- |
| `name` | Obrigatorio. | "Informe o nome do profissional." |
| `roleId` (cargo) | **Opcional**; se informado, precisa existir. | "Cargo inválido." |
| `phone` | Opcional; ao menos 10 digitos se preenchido. | "Informe um telefone válido." |
| `workingHours` | Opcional; inicio antes do fim em cada dia. | "Horário inválido: o início deve ser antes do fim." |
| intervalo (almoco) | Dentro do expediente do dia. | "Almoço inválido: deve ficar dentro do expediente do dia." |
| `modalityIds` (so tenant de turmas) | Ao menos uma. | "Selecione ao menos uma modalidade que o profissional leciona." |

`serviceIds` **nao e obrigatorio** (antes: "ao menos um servico"). A relacao profissional x servico so destaca servicos no agendamento avulso.

### Formulario de Agendamento

| Campo | Regra | Mensagem |
| --- | --- | --- |
| `clientId` | Obrigatorio. | "Selecione um cliente." |
| `professionalId` | Obrigatorio. | "Selecione um profissional." |
| `serviceIds` | Ao menos um servico. | "Selecione ao menos um serviço." |
| `date` | Obrigatoria. | "Selecione a data." |
| `start` | Obrigatorio. | "Selecione o horário." |
| profissional ativo | — | "Este profissional está inativo." |
| servico ativo | — | "[Nome do serviço] está inativo." |
| sobreposicao / bloqueio | Bloqueante. | Ver "Conflitos bloqueantes". |
| expediente / horario do profissional / intervalo | Confirmacao. | Ver "Regras moles". |

Notas:

- O fim (`end`) e calculado pelo inicio + soma das duracoes dos servicos; nao e digitado.
- Ao editar, data e horario nao aparecem ("Para mudar a data ou o horário, use Remarcar.").
- Serie recorrente: tambem exige termino ("Defina o término por número de ocorrências ou data." / "Informe o número de ocorrências.") e ainda recusa servico que o profissional nao realiza ("[Prof] não realiza [Serviço].").

### Bloqueio de horario

- "Selecione um profissional.", "Selecione a data.", "O horário de início deve ser anterior ao de fim.".

## Mensagens de confirmacao (Modelo 1)

Todas usam dialogo com titulo, corpo e botoes. Implementacao em `components/shared/confirm-action-dialog.tsx` ou `AlertDialog` local (ver [`../frontend/06-decisoes-de-interface.md`](../frontend/06-decisoes-de-interface.md)).

### Cancelar agendamento

- Titulo: "Cancelar agendamento?"
- Corpo: "O agendamento de [Cliente] - [Servicos] com [Profissional] em [data], [horario] será cancelado. O registro permanece no histórico."
- Campo obrigatorio "Motivo do cancelamento". Sem motivo: "Informe o motivo do cancelamento."
- Botoes: "Voltar" / "Cancelar agendamento".
- Efeito: `canceled` com `cancellationReason`; toast "Agendamento cancelado. O registro permanece no histórico."

### Marcar como nao compareceu

- Titulo: "Marcar como não compareceu?"
- Corpo: "O agendamento de [Cliente] - [Servicos] com [Profissional] em [data], [horario] será marcado como não compareceu. O registro permanece no histórico."
- Campo "Motivo (opcional)".
- Botoes: "Voltar" / "Não compareceu".

### Remarcar agendamento

- Dialogo "Remarcar agendamento" (formulario, nao confirmacao): profissional, data (so ocorrencia unica), horario e "Motivo (opcional)"; botoes "Voltar" / "Remarcar".
- Em serie, antes: "Este agendamento faz parte de uma série. Remarcar quais ocorrências?" com "Somente esta ocorrência" / "Esta e as futuras".

### Inativar / reativar cadastros

- "Inativar cliente?" / "Reativar cliente?" ("aluno"), "Inativar profissional?" / "Reativar profissional?", "Inativar serviço?" / "Reativar serviço?", "Inativar usuário?" / "Reativar usuário?". Cargos e categorias usam "Inativar “[nome]”?" / "Reativar “[nome]”?".
- "Descartar alterações?" ao fechar o formulario de cliente/aluno com dados preenchidos (botoes "Continuar editando" / "Descartar").

### Excluir / cancelar serie recorrente

- **Nao existe.** Cancelamento e sempre de uma ocorrencia; nao ha exclusao de serie nem escopo "esta e as futuras" para cancelar (so para remarcar).

## Modelo 3: turmas e mensalidades

### Empty states

| Tela | Mensagem | Call-to-action |
| --- | --- | --- |
| Alunos (sem dados) | "Nenhum aluno cadastrado ainda." | "Cadastrar aluno" |
| Turmas (sem dados) | "Nenhuma turma cadastrada ainda." | "Nova turma" |
| Detalhe da turma, matriculas | "Nenhum aluno matriculado ainda." | "Matricular alunos" |
| Detalhe da turma, lista de espera | "Ninguém na lista de espera." | — |
| Calendario de turmas | "Nenhuma aula nesta semana." (com filtros: "Nenhuma aula para os filtros aplicados.") | "Limpar filtros" (com filtros) |
| Detalhe da aula | "Nenhum aluno nesta aula." | — |
| Mensalidades | "Nenhuma cobrança nesta competência." | "Gerar cobranças" |
| Planos | "Nenhum plano cadastrado ainda." | "Novo plano" |
| Modalidades | "Nenhuma modalidade cadastrada ainda." | "Cadastrar modalidade" |

### Erros de regra (`ApiError` e validacao)

| Situacao | Codigo | Mensagem |
| --- | --- | --- |
| Turma lotada ao matricular | `CLASS_FULL` | "Turma lotada (N vagas)." — o dialogo ja avisa antes e oferece "Pôr na lista de espera" / "Matricular mesmo assim (N)". |
| Aluno ja tem aula no mesmo horario em outra turma | `CLASS_SCHEDULE_CONFLICT` | "[Aluno] já possui aula [Dia] (HH:mm-HH:mm) na turma "[Turma]"." |
| Instrutor ja da aula no mesmo horario (salvar turma) | `VALIDATION` (`meetingSlots`) | "[Instrutor] já tem aula [Dia] HH:mm-HH:mm em "[Turma]"." |
| Encontro fora do expediente da unidade | `VALIDATION` (`meetingSlots`) | "Horário fora do expediente da unidade ([dia] funciona das HH:mm às HH:mm)." / "A unidade está configurada como fechada aos [dias]." / "Nenhum turno de funcionamento configurado para [dia]." |
| Chamada de aula futura | `VALIDATION` | "A chamada só pode ser feita no dia da aula ou depois." (na UI os botoes ficam desabilitados) |
| Plano sem valor | `VALIDATION` | "Informe um valor maior que zero." |
| Dia de vencimento padrao (Configuracoes) | Zod | "Use um dia de 1 a 28." |
| Modalidade duplicada | `VALIDATION` | "Já existe uma modalidade com esse nome." |
| Matricula duplicada | `VALIDATION` | "Aluno já matriculado nesta turma." |
| Lista de espera duplicada | `VALIDATION` | "Aluno já está na lista de espera." |
| Avulso ja reservado / ja matriculado | `VALIDATION` | "Aluno já reservou esta aula." / "Aluno já está matriculado nesta turma." |
| Desativar turma ja inativa | `VALIDATION` | "Turma já foi desativada." |

Formulario de turma: "Informe o nome da turma.", "Selecione a modalidade da turma.", "Selecione o instrutor.", "A capacidade deve ser ao menos 1.", "Informe a data de início.", "Marque ao menos um dia de encontro.", "Horário inválido: informe início e fim (o início deve ser antes do fim).". Plano: "Informe o nome do plano.".

### Confirmacoes

Lista de quais acoes confirmam em [`../frontend/06-decisoes-de-interface.md`](../frontend/06-decisoes-de-interface.md). Titulos reais:

| Acao | Titulo | Onde |
| --- | --- | --- |
| Registrar pagamento | "Registrar pagamento" (exige Pix, Dinheiro, Cartão ou Outro) | `register-payment-dialog.tsx` |
| Gerar mensalidades | "Gerar cobranças de <Mês de AAAA>?" | `billing-view.tsx` |
| Desfazer pagamento | "Desfazer pagamento?" | `billing-view.tsx` |
| Cancelar cobranca | "Cancelar cobrança" | `billing-view.tsx` |
| Reabrir cobranca cancelada | "Reabrir cobrança?" | `billing-view.tsx` |
| Resetar competencia | "Resetar cobranças da competência" (pagas sao mantidas) | `billing-view.tsx` |
| Cancelar matricula | "Cancelar matrícula?" | `turma-detail-view.tsx` |
| Promover da espera | "Promover da lista de espera?" | `turma-detail-view.tsx` |
| Remover da espera | "Remover da lista de espera?" | `turma-detail-view.tsx` |
| Remover avulso/experimental da aula | "Remover da aula?" | `session-detail-view.tsx` |
| Desativar / reativar turma | "Desativar turma?" / "Reativar turma?" | `turmas-view.tsx` |
| Inativar / reativar plano | "Inativar plano?" / "Reativar plano?" | `plans-view.tsx` |
| Inativar / reativar modalidade | "Inativar modalidade?" / "Reativar modalidade?" | `features/turmas` |
| Inativar / reativar aluno | "Inativar aluno?" / "Reativar aluno?" | `features/clients` |
| Descartar formulario de aluno | "Descartar alterações?" | `client-form-dialog.tsx` |
| Salvar horario que deixa aulas fora | "Há aulas fora do novo horário" (botao "Salvar mesmo assim") | `business-hours-card.tsx` |

Sem confirmacao (um clique): marcar presenca (Presente / Faltou / Justificada) e restaurar o instrutor titular.

## Empty states com call-to-action (Modelo 1)

Estados vazios "sem dados" orientam a proxima acao; "por busca/filtro" oferecem limpar, nao cadastrar.

| Tela | Mensagem | Call-to-action |
| --- | --- | --- |
| Clientes (sem dados) | "Nenhum cliente cadastrado ainda." | "Cadastrar cliente" |
| Equipe (sem dados) | "Nenhum profissional cadastrado ainda." | "Cadastrar profissional" |
| Servicos (sem dados) | "Nenhum serviço cadastrado ainda." | "Cadastrar serviço" |
| Agenda - calendario vazio | "Nenhum agendamento neste dia." | — |
| Agenda - aba Lista vazia | "Nenhum agendamento neste período." | "Novo agendamento" |
| Dashboard - proximos | "Nenhum agendamento pendente ou confirmado para hoje." | — |
| Qualquer lista - vazio por busca | "Nenhum resultado para esta busca." | — |
| Qualquer lista - vazio por filtro | "Nenhum resultado para os filtros aplicados." | "Limpar filtros" |

Historico do cliente: nao existe tela (ainda nao implementado).

## Principais validacoes (resumo)

### Cliente / Aluno

- Nome obrigatorio.
- Telefone obrigatorio, com ao menos 10 digitos.
- E-mail opcional; valido se preenchido.

### Servico

- Nome obrigatorio.
- Categoria opcional.
- Duracao > 0; preco >= 0.

### Profissional (Equipe)

- Nome obrigatorio.
- Cargo opcional; servicos opcionais; horario opcional (inicio antes do fim; almoco dentro do expediente).
- Tenant de turmas: ao menos uma modalidade.

### Agendamento

- Exige cliente + profissional + ao menos um servico + data + horario.
- Profissional e servicos ativos.
- Qualquer profissional ativo pode fazer qualquer servico ativo (a associacao e informativa).
- Sobreposicao e bloqueio: sempre recusados.
- Fora do expediente da unidade, fora do horario do profissional, intervalo e passado: confirmacao ao criar/editar; na remarcacao, so o passado confirma e os demais recusam.
- Fim = inicio + soma das duracoes.

### Recorrencia (serie)

- Frequencia: semanal, quinzenal ou mensal.
- Termino obrigatorio: numero de ocorrencias OU data final.
- Profissional precisa realizar os servicos.
- Ocorrencias em conflito (inclusive horario do profissional e intervalo) nao sao criadas.

### Turmas (Modelo 3)

- Encontros dentro do expediente da unidade (se configurado) e sem conflito com outra turma ativa do mesmo instrutor.
- Matricula sem conflito de horario do aluno; lotacao e regra mole.
- Chamada so no dia da aula ou depois.
- Plano com valor > 0. Regras de mensalidade em [`15-regras-de-cobranca.md`](15-regras-de-cobranca.md).

## Conexao com os Criterios de pronto do MVP

Estes estados e mensagens atendem aos Criterios de pronto descritos em `04-mvp-barbearia.md`:

| Criterio de pronto (04-mvp-barbearia.md) | Como este documento atende |
| --- | --- |
| "O usuario consegue navegar pelo fluxo principal sem backend." | Estados de carregando/erro simulados sem backend real; confirmacoes e validacoes funcionam sobre dados mockados. |
| "As telas usam dados mockados consistentes entre si." | Mensagens vem dos mesmos services que as telas usam; o cenario de referencia e o doc 08. |
| "A agenda comunica claramente horario, profissional, cliente, servico e status." | Estados da Agenda (vazio, fechado, bloqueado, intervalo, conflito) tornam o estado explicito. |
| "Estados vazios e de erro simulados existem onde fizer sentido." | Estados de lista e empty states com call-to-action padronizados. |
| "O modelo de dados mockado parece um contrato futuro de API." | Validacoes por campo e codigos de `ApiError` espelham o que uma API real devolveria. |
| "A estrutura visual nao bloqueia a evolucao para unidades e modulos futuros." | Textos por modelo (cliente/aluno) sem reescrever telas. |

## Pendencias

- Aviso "sem horarios livres" para o profissional no periodo.
- Tela para resolver ocorrencias de serie em conflito (hoje so toast).
- Rastro de remarcacao: o detalhe mostra so o horario original e o ultimo motivo ("Remarcado — originalmente dd/MM às HH:mm (motivo)"); o historico completo fica em `rescheduledFrom` e na Auditoria.
- Alinhar os textos que diferem entre schema e service (ex.: "Informe o nome." x "Informe o nome do cliente.").
