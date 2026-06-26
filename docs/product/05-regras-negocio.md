# Regras de Negocio

## Decisao

As regras de negocio devem ser documentadas separadas das telas para que possam orientar frontend mockado, backend futuro e testes.

## Regras de agendamento

- Um agendamento deve ter cliente, profissional, servico, data, horario de inicio e horario de fim.
- A duracao padrao do agendamento vem do servico.
- O horario de fim pode ser calculado a partir do inicio e da duracao do servico.
- Um profissional nao deve ter dois agendamentos sobrepostos no mesmo horario.
- Um profissional inativo nao deve ser sugerido para novos agendamentos.
- Um servico inativo nao deve ser sugerido para novos agendamentos.
- Um cliente inativo pode aparecer em historico, mas nao deve ser sugerido como primeira opcao para novos agendamentos.
- Agendamentos cancelados permanecem no historico.
- Agendamentos concluidos nao devem ser editados livremente como agendamentos futuros.
- No-show deve ser tratado como perda operacional, nao como atendimento concluido.

## Regras de status

- Pendente indica que o agendamento foi criado, mas ainda nao foi confirmado.
- Confirmado indica que o cliente ou a equipe confirmou o horario.
- Em atendimento indica que o servico esta acontecendo.
- Concluido indica que o atendimento foi finalizado.
- Cancelado indica que o agendamento nao acontecera.
- Nao compareceu indica que o cliente nao apareceu no horario marcado.

## Regras de receita estimada

- Receita estimada pode considerar agendamentos confirmados, em atendimento e concluidos.
- Agendamentos cancelados nao contam como receita estimada.
- No-show nao conta como receita realizada.
- No MVP, receita e apenas uma estimativa visual calculada a partir do preco do servico.

## Regras de disponibilidade

- A disponibilidade inicial do MVP pode ser simples, baseada em horario de funcionamento e horarios de trabalho dos profissionais.
- Horarios fora do expediente nao devem ser sugeridos como opcoes principais.
- A agenda deve deixar claro quando um profissional esta sem horarios livres no periodo filtrado.

## Regras de unidade

- O MVP simula uma unica unidade.
- A estrutura dos dados deve manter `organizacaoId` e `unidadeId` onde fizer sentido para facilitar evolucao futura.
- A interface nao precisa permitir troca real de unidade no MVP.

## Pendencias

- Definir regras para remarcacao.
- Definir regras para bloqueio de horario.
- Definir se o sistema permitira encaixes manuais com alerta de conflito.
- Definir regras futuras de recorrencia.

