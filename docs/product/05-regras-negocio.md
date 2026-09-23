# Regras de Negocio

## Decisao

As regras de negocio devem ser documentadas separadas das telas para que possam orientar frontend mockado, backend futuro e testes.

A interface usa termos simples e genericos, com rotulos que mudam por modelo operacional (ex.: "Alunos" e "Modalidades" na academia). Codigos de status, origem e enums sao em ingles; os rotulos exibidos sao em portugues. Rotulos por segmento configuraveis (label overrides) continuam previsao futura.

Tipos de regra usados abaixo:

- **Regra dura:** o sistema recusa a operacao.
- **Regra mole:** o sistema avisa e pede confirmacao ("... mesmo assim"); o usuario pode seguir.

## Regras de agendamento (Modelo 1)

- Um agendamento deve ter cliente, profissional, **um ou mais servicos** (`serviceIds`), data e horario de inicio.
- A duracao e a soma das duracoes dos servicos; o horario de fim e calculado a partir do inicio. O preco total e a soma dos precos.
- Qualquer profissional ativo pode realizar qualquer servico ativo; a lista de servicos do profissional e apenas informativa.
- Um agendamento registra sua origem: `manual` ou `recurrence` (futuro: `online`, `whatsapp`, ainda nao implementados).
- Profissional inativo ou servico inativo recusa o agendamento (regra dura). O formulario so oferece clientes, profissionais e servicos ativos.
- Agendamentos cancelados permanecem no historico.
- O cancelamento exige um motivo (texto obrigatorio), guardado no agendamento.
- Agendamentos concluidos, cancelados ou com nao comparecimento nao avancam mais de status.
- No-show e tratado como perda operacional, nao como atendimento concluido.
- Marcar como nao compareceu aceita um motivo (texto opcional); so vale para agendamentos pendentes ou confirmados.
- Horario no passado pede confirmacao ao criar, editar (se a data/horario mudou) ou remarcar (regra mole).

## Regras de status

| Codigo | Rotulo | Significado |
| --- | --- | --- |
| `pending` | Pendente | Agendamento criado, mas ainda nao confirmado. |
| `confirmed` | Confirmado | Cliente ou equipe confirmou o horario. |
| `in_service` | Em atendimento | O servico esta acontecendo. |
| `completed` | Concluido | O atendimento foi finalizado. |
| `canceled` | Cancelado | O agendamento nao acontecera. |
| `no_show` | Nao compareceu | O cliente nao apareceu no horario marcado. |

## Regras de origem

- Todo agendamento tem uma origem que indica como foi criado.
- Existem duas origens: `manual` (criado por alguem da equipe na Agenda) e `recurrence` (gerado por uma serie recorrente).
- Origens `online` e `whatsapp` ficam previstas para o futuro.

## Regras de receita estimada

- Receita estimada considera agendamentos confirmados, em atendimento e concluidos (`confirmed`, `in_service`, `completed`).
- Agendamentos cancelados nao contam como receita estimada.
- No-show nao conta como receita.
- Receita e apenas uma estimativa visual calculada a partir do preco total dos servicos (armazenado em centavos). O Dashboard mostra a receita estimada do dia.

## Regras de disponibilidade (Modelo 1)

Checagens de horario, na ordem em que o sistema avalia:

| Situacao | Codigo | Criar/editar agendamento | Remarcar | Serie recorrente |
| --- | --- | --- | --- | --- |
| Fora do horario de funcionamento da unidade | `OUTSIDE_BUSINESS_HOURS` | Regra mole ("Agendar mesmo assim") | Regra dura | Ocorrencia nao criada |
| Fora do horario do profissional (ou profissional sem horario) | `OUTSIDE_PROFESSIONAL_HOURS` | Regra mole | Regra dura | Ocorrencia nao criada |
| Intervalo/almoco do profissional | `ON_BREAK` | Regra mole | Regra dura | Ocorrencia nao criada |
| Bloqueio de horario | `TIME_BLOCKED` | Regra dura | Regra dura | Ocorrencia nao criada |
| Sobreposicao com outro agendamento do mesmo profissional | `OVERLAP_CONFLICT` | Regra dura | Regra dura | Ocorrencia nao criada |

- O horario de funcionamento da unidade aceita **varios turnos por dia** (ex.: 08:00-12:00 e 14:00-20:00); o agendamento precisa caber inteiro em um turno. Unidade sem horario configurado nao limita.
- Profissional sem horario cadastrado e aceito (o cadastro comeca vazio); agendar com ele pede confirmacao.
- O intervalo/almoco faz parte do horario de trabalho (`breakStart`/`breakEnd` por dia) e aparece destacado na Agenda.
- Agendamentos cancelados e com no-show nao ocupam o horario.

Antes: fora do expediente, fora do horario do profissional e intervalo eram sempre regra dura.

## Regras de remarcacao

- Remarcar e mover um agendamento existente para outro horario e/ou outro profissional, mantendo o mesmo cliente e os mesmos servicos.
- A remarcacao aceita um motivo (texto opcional), registrado no rastro quando informado.
- O rastro guarda horario/profissional anterior e motivo (`rescheduledFrom`), e a remarcacao entra na Auditoria.
- A remarcacao NAO conclui o agendamento.
- A remarcacao esta sujeita as checagens de disponibilidade (tabela acima). Se houver conflito, e impedida.
- Se o agendamento faz parte de uma serie recorrente, a remarcacao pergunta o escopo: "somente esta ocorrencia" ou "esta e as futuras". Em "esta e as futuras", ocorrencias passadas ou encerradas nao mudam e as que entram em conflito sao puladas e informadas.

## Regras de bloqueio de horario

- Um profissional pode ter bloqueios de agenda (folga, indisponibilidade). O almoco faz parte do horario de trabalho, nao e bloqueio avulso.
- Um bloqueio possui data, horario de inicio, horario de fim e motivo opcional.
- Horario bloqueado nao aceita agendamento, remarcacao nem ocorrencia recorrente, e aparece destacado na Agenda.

## Regras de recorrencia

- A recorrencia e simples: repeticao de um compromisso individual (mesmo cliente, profissional e servicos). Nao transforma o produto em modelo de turmas.
- Frequencias: semanal, quinzenal e mensal (mesmo dia da semana e mesmo horario).
- Termino: por numero de ocorrencias OU por data final. Toda serie e finita.
- Geracao: a serie cria N agendamentos ligados por um `seriesId`, com origem `recurrence`.
- Conflito: ocorrencias que falham em qualquer checagem de disponibilidade NAO sao criadas; as demais sao criadas normalmente e o usuario e avisado de quantas ficaram de fora.
- Editar e cancelar agem em uma ocorrencia por vez. O escopo "esta e as futuras" so existe na remarcacao.

## Regras de turmas (Modelo 3)

- Uma turma exige nome, modalidade, instrutor titular, ao menos um encontro semanal e capacidade de pelo menos 1.
- O instrutor precisa lecionar a modalidade da turma (o formulario so oferece instrutores com a modalidade em `modalityIds`).
- **Encontros dentro do expediente:** cada encontro precisa caber no horario de funcionamento da unidade, quando configurado (regra dura ao salvar a turma). Ao mudar o horario da unidade de modo que aulas existentes fiquem fora, Configuracoes pede confirmacao.
- **Conflito do instrutor:** o mesmo instrutor nao pode ter duas turmas ativas com encontros sobrepostos no mesmo dia da semana (regra dura).
- As aulas (sessoes) sao geradas a partir dos encontros, entre a data de inicio e a data de fim (se houver) da turma ativa.

## Regras de matricula, espera e reservas

- **Capacidade e regra mole:** turma lotada gera `CLASS_FULL`; o formulario pede "Matricular mesmo assim".
- **Conflito do aluno** (`CLASS_SCHEDULE_CONFLICT`): o aluno nao pode ser matriculado em uma turma cujo encontro se sobrepoe ao de outra turma ativa em que ja esta matriculado (regra dura).
- O aluno nao pode ter duas matriculas ativas na mesma turma.
- **Lista de espera:** fila por turma; a promocao para matricula e manual e pode passar da capacidade (acao consciente, com confirmacao).
- **Aula avulsa** (`dropin`): reserva em uma aula especifica; gera uma cobranca avulsa com o valor da aula avulsa da turma (se maior que zero), vencendo na data da aula.
- **Aula experimental** (`trial`): reserva sem cobranca.
- Aluno ja matriculado na turma nao pode reservar aula avulsa nela. Remover a reserva cancela a cobranca avulsa ainda nao paga.
- **Instrutor substituto:** troca o instrutor de uma aula especifica (motivo opcional) sem mudar o titular; pode ser desfeita.

## Regras de presenca

- A chamada so pode ser feita no dia da aula ou depois (regra dura).
- A lista de chamada de uma aula usa as matriculas validas **na data daquela aula**; quem ja tem presenca marcada continua na lista mesmo que a matricula mude depois. Avulsos e experimentais reservados na aula tambem aparecem.
- Status: `present` (presente), `absent` (falta), `justified` (justificada).
- Frequencia do aluno = presentes / (presentes + faltas). **Justificada nao penaliza.**

## Regras de cobranca (Modelo 3)

Regras de planos e mensalidades (regra padrao da academia, proporcional, antecipado/depois do uso, periodicidades, desconto, pausa, atraso, troca de plano, inativacao, reset) estao em [15-regras-de-cobranca.md](15-regras-de-cobranca.md). O calculo fica no motor unico descrito em [`../technical/02-motor-de-cobranca.md`](../technical/02-motor-de-cobranca.md).

## Regras de unidade e tenant

- Cada organizacao tem um modelo operacional e dados isolados; o mock tem dois tenants (Corte Nobre e Academia X).
- Cada organizacao tem uma unica unidade por enquanto.
- `organizationId` e `unitId` sao **carimbados pelo servidor** (os contratos `Create*` nao os recebem; os services usam o tenant ativo da sessao). Ver [`../technical/03-multi-tenant-e-escopo.md`](../technical/03-multi-tenant-e-escopo.md).
- A interface nao permite troca de unidade.

## Regras de auditoria

- As acoes de escrita dos principais services (cadastros, usuarios, configuracoes, agendamentos, turmas, matriculas, reservas e financeiro) sao registradas em um log imutavel, com autor, data e mudancas.
- Remarcacao registra o horario/profissional anterior e o novo, e o motivo quando informado.
- Ainda nao auditados: criacao de serie recorrente, bloqueios de horario, presenca, lista de espera e instrutor substituto.

## Fora de escopo (MVP)

- Encaixe com sobreposicao para o mesmo profissional (sobreposicao e bloqueio seguem como regra dura).
- Sistema de rotulos por segmento configuravel (label overrides).
- Origens de agendamento `online` e `whatsapp`.
- Recorrencia infinita.
- Reposicao de aula (removida).

## Pendencias

- Definir o fluxo de resolucao das ocorrencias recorrentes que nao foram criadas por conflito (hoje so ha o aviso).
- Decidir se remarcacao e criacao de serie devem aceitar as mesmas regras moles do criar/editar.
