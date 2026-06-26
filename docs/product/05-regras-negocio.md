# Regras de Negocio

## Decisao

As regras de negocio devem ser documentadas separadas das telas para que possam orientar frontend mockado, backend futuro e testes.

No MVP, a interface usa uma linguagem unica e generica de navegacao: Clientes, Equipe, Servicos, Agenda e Agendamentos. O termo "Profissional" e usado no contexto de um agendamento e em telas de detalhe. A arquitetura conceitual deve prever um sistema FUTURO de rotulos por segmento (label overrides), que permitiria exibir, por exemplo, "Alunos" no lugar de "Clientes" sem reescrever telas. Esse sistema de rotulos NAO entra no MVP; e apenas previsao conceitual.

## Regras de agendamento

- Um agendamento deve ter cliente, profissional, servico, data, horario de inicio e horario de fim.
- A duracao padrao do agendamento vem do servico.
- O horario de fim pode ser calculado a partir do inicio e da duracao do servico.
- Um profissional nao deve ter dois agendamentos sobrepostos no mesmo horario.
- No MVP, a sobreposicao de horario para o mesmo profissional e SEMPRE bloqueada. Nao existe encaixe manual; o sistema impede a criacao de qualquer agendamento que conflite com outro agendamento, com o expediente ou com um bloqueio.
- Um agendamento deve registrar sua origem: `manual` ou `recorrencia` (futuro: `online`, `whatsapp`).
- Um profissional inativo nao deve ser sugerido para novos agendamentos.
- Um servico inativo nao deve ser sugerido para novos agendamentos.
- Um cliente inativo pode aparecer em historico, mas nao deve ser sugerido como primeira opcao para novos agendamentos.
- Agendamentos cancelados permanecem no historico.
- Agendamentos concluidos nao devem ser editados livremente como agendamentos futuros.
- No-show deve ser tratado como perda operacional, nao como atendimento concluido.

## Regras de status

| Chave | Rotulo | Significado |
| --- | --- | --- |
| pendente | Pendente | Agendamento criado, mas ainda nao confirmado. |
| confirmado | Confirmado | Cliente ou equipe confirmou o horario. |
| em_atendimento | Em atendimento | O servico esta acontecendo. |
| concluido | Concluido | O atendimento foi finalizado. |
| cancelado | Cancelado | O agendamento nao acontecera. |
| nao_compareceu | Nao compareceu | O cliente nao apareceu no horario marcado. |

## Regras de origem

- Todo agendamento tem uma origem que indica como foi criado.
- No MVP existem duas origens: `manual` (criado por alguem da equipe na Agenda) e `recorrencia` (gerado por uma serie recorrente).
- Origens `online` e `whatsapp` ficam previstas para o futuro e nao entram no MVP.

## Regras de receita estimada

- Receita estimada pode considerar agendamentos confirmados, em atendimento e concluidos.
- Agendamentos cancelados nao contam como receita estimada.
- No-show nao conta como receita realizada.
- No MVP, receita e apenas uma estimativa visual calculada a partir do preco do servico (em reais; preco armazenado em centavos quando fizer sentido para precisao).

## Regras de disponibilidade

- A disponibilidade inicial do MVP pode ser simples, baseada em horario de funcionamento da unidade e horarios de trabalho dos profissionais.
- Horarios fora do expediente nao devem ser sugeridos como opcoes principais e nao aceitam agendamento.
- Horarios cobertos por um bloqueio nao aceitam agendamento.
- A agenda deve deixar claro quando um profissional esta sem horarios livres no periodo filtrado.

## Regras de remarcacao

- Remarcar e mover um agendamento existente para outro horario e/ou outro profissional, mantendo o mesmo cliente e o mesmo servico.
- A remarcacao mantem rastro no historico: registra-se que o agendamento foi remarcado, com horario/profissional anterior e novo.
- A remarcacao NAO conclui o agendamento; o status nao vira "concluido" por causa da remarcacao.
- A remarcacao esta sujeita as mesmas regras de conflito e disponibilidade de um novo agendamento (expediente, bloqueios e sobreposicao com o mesmo profissional). Se houver conflito, a remarcacao e impedida.
- Se o agendamento faz parte de uma serie recorrente, a remarcacao pergunta o escopo: "somente esta ocorrencia" ou "esta e as futuras".

## Regras de bloqueio de horario

- Um profissional pode ter bloqueios de agenda (por exemplo: folga, almoco, indisponibilidade).
- Um bloqueio possui data, horario de inicio, horario de fim e motivo opcional.
- Horario bloqueado nao aceita agendamento e deve aparecer destacado na Agenda.
- Bloqueios participam das verificacoes de conflito: nenhum agendamento, remarcacao ou ocorrencia recorrente pode ser criado sobre um horario bloqueado.

## Regras de recorrencia

- A recorrencia do MVP e simples: repeticao de um compromisso individual (mesmo cliente, profissional e servico). Recorrencia NAO transforma o produto em modelo de turmas.
- Frequencias suportadas: semanal, quinzenal e mensal (mesmo dia da semana e mesmo horario).
- Termino: por numero de ocorrencias OU por data final. Nao existe recorrencia infinita no MVP; toda serie e finita.
- Geracao: a serie cria N agendamentos (ocorrencias) ligados por um `serieId`.
- Edicao e cancelamento de ocorrencias seguem o escopo: "somente esta ocorrencia" ou "esta e as futuras".
- Conflito: se uma ocorrencia cair em horario ja ocupado, fora do expediente ou em bloqueio, ela e sinalizada como conflito e NAO e criada automaticamente. Ela fica pendente de resolucao manual; as demais ocorrencias sem conflito sao criadas normalmente.

## Regras de unidade

- O MVP simula uma unica unidade.
- A estrutura dos dados deve manter `organizacaoId` e `unidadeId` onde fizer sentido para facilitar evolucao futura.
- A interface nao precisa permitir troca real de unidade no MVP.

## Fora de escopo (MVP)

- Encaixe manual com alerta de conflito. No MVP, a sobreposicao de horario para o mesmo profissional e sempre bloqueada; o encaixe manual e previsao para o futuro.
- Sistema de rotulos por segmento (label overrides). E previsao conceitual; o MVP usa linguagem unica e generica.
- Origens de agendamento `online` e `whatsapp`.
- Recorrencia infinita.

## Pendencias

- Definir como a remarcacao e a edicao de ocorrencias recorrentes registram detalhes no historico (formato e nivel de detalhe da auditoria).
- Definir o tratamento de conflitos pendentes de recorrencia na interface (fluxo de resolucao manual das ocorrencias sinalizadas).
