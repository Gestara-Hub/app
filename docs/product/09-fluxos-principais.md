# Fluxos Principais

## Decisao

Os fluxos (jornadas) do MVP devem ser documentados de forma explicita, cada um com pre-condicoes, passos numerados e pos-condicao/estados resultantes. Isso orienta o frontend mockado, alinha o time e serve de contrato comportamental para testes e para a evolucao futura do backend.

A navegacao depende do modelo operacional do tenant (`Organization.model`, ver [`../technical/03-multi-tenant-e-escopo.md`](../technical/03-multi-tenant-e-escopo.md)). No Modelo 1 (`scheduling`): Dashboard, Clientes, Equipe, Servicos e Agenda (a Agenda tem as abas Calendario e Lista; "Agendamentos" nao e mais item proprio). No Modelo 3 (`classes`): Dashboard, Alunos, Equipe, Turmas, Calendario, Modalidades, Planos e Mensalidades. Em ambos, no rodape: Usuarios, Auditoria e Configuracoes. O termo "Profissional" e usado no contexto de um agendamento e em telas de detalhe.

## Contexto

- As regras de negocio que regem estes fluxos estao em `docs/product/05-regras-negocio.md`. Sempre que um fluxo cita uma regra (conflito, disponibilidade, status, origem, remarcacao, bloqueio, recorrencia), a fonte normativa e aquele documento; aqui fica a jornada.
- O cenario usado nos exemplos e a barbearia ficticia Corte Nobre, documentada em `docs/product/08-barbearia-corte-nobre.md`. Atencao: ela e um roteiro de cadastro manual, **nao** o seed. O seed cria o tenant vazio, so com o proprietario (Marcelo Andrade).
- Os perfis e quem pode executar cada acao estao em `docs/product/06-perfis-permissoes.md`. O perfil vem do usuario escolhido no login (`owner`, `manager`, `attendant`, `professional`) e cada acao e liberada por permissao (`can`/`useCan`).
- Os modulos e telas envolvidos estao em `docs/product/03-modulos.md`.
- Modelo 3 (turmas): regras em [`11-modelo-3-turmas.md`](11-modelo-3-turmas.md); mensalidades em [`15-regras-de-cobranca.md`](15-regras-de-cobranca.md).

## Escopo

Fluxos documentados neste arquivo:

Modelo 1 (agenda individual):

1. Login mockado
2. Abrir o dia (dashboard operacional)
3. Criar agendamento (incluindo conflitos bloqueantes e confirmacoes "mesmo assim")
4. Remarcar agendamento (com escopo de serie)
5. Mudar status do agendamento (confirmar, em atendimento, concluir, cancelar, no-show)
6. Bloquear horario de um profissional
7. Criar agendamento recorrente (frequencia, termino e ocorrencia em conflito)
8. Cadastrar/editar Cliente
9. Cadastrar/editar Servico
10. Cadastrar/editar Profissional
11. Buscar cliente (sem tela de historico)

Modelo 3 (turmas), resumido:

12. Cadastrar aluno com plano e 1a cobranca
13. Gerar mensalidades da competencia
14. Registrar pagamento
15. Matricular aluno e lista de espera
16. Fazer a chamada

## Fora de escopo

- Encaixe sobre outro agendamento. A sobreposicao de horario para o mesmo profissional e SEMPRE bloqueada, assim como o horario com bloqueio.
- Backend real, persistencia real e autenticacao real. Tudo e mockado.
- Origens de agendamento `online` e `whatsapp`.
- Recorrencia infinita.
- Sistema completo de rotulos por segmento (label overrides). Hoje so existe a troca simples cliente/aluno e categoria/modalidade por modelo.

## Convencoes dos fluxos

- Entidades (contrato em ingles): `Client`, `Professional`, `Service`, `Category`, `Role`, `Appointment`, `TimeBlock`, `RecurrenceSeries`, `Organization`, `Unit`. Modelo 3: `ClassGroup`, `Enrollment`, `ClassSession`, `Attendance`, `ClassReservation`, `WaitlistEntry`, `Plan`, `Charge`.
- Status de agendamento (chave -> rotulo): `pending` -> Pendente; `confirmed` -> Confirmado; `in_service` -> Em atendimento; `completed` -> Concluído; `canceled` -> Cancelado; `no_show` -> Não compareceu.
- Origem de agendamento (enum): `manual`, `recurrence`. (futuro, fora do tipo: `online`, `whatsapp`)
- Funcionamento da unidade: nasce vazio no seed e e definido em Configuracoes. Enquanto vazio, nao ha validacao de expediente. No cenario Corte Nobre: Seg a Sex 09:00-20:00, Sab 08:00-18:00, Domingo fechado.

---

## Fluxo 1: Login mockado

### Pre-condicoes

- Aplicacao frontend carregada, sem sessao ativa (cookie `gestarahub_session` ausente).
- Existe ao menos um usuario ativo. O seed traz dois proprietarios: Marcelo Andrade (Corte Nobre, `scheduling`) e Ana Ribeiro (Academia X, `classes`).

### Passos

1. O usuario abre a aplicacao e ve a tela de login.
2. A tela lista os usuarios de todas as organizacoes (nome, organizacao e perfil). Nao ha campo de e-mail nem senha.
3. O usuario clica no usuario desejado.
4. A server action `signIn` grava o `UserView` no cookie de sessao. O perfil de acesso e o do usuario escolhido; a organizacao ativa passa a ser a dele.
5. O sistema redireciona para a rota de origem (se permitida) ou para a primeira rota acessivel: o Dashboard (`/`) para quem tem `dashboard:view`; senao, a rota nucleo do modelo (`/schedule` ou `/classes/calendar`).

### Pos-condicao / Estados resultantes

- Sessao mockada ativa com a organizacao e a unidade do usuario.
- Navegacao filtrada pelo modelo do tenant e pelas permissoes do perfil.
- A topbar permite trocar de usuario (`switchUser`), o que tambem troca de organizacao.

### Entidades e regras envolvidas

- Entidades: `User`, `Organization`, `Unit`.
- Perfis e permissoes: ver `docs/product/06-perfis-permissoes.md`.
- Sessao e escopo do tenant: ver [`../technical/03-multi-tenant-e-escopo.md`](../technical/03-multi-tenant-e-escopo.md).

---

## Fluxo 2: Abrir o dia (dashboard operacional)

### Pre-condicoes

- Sessao mockada ativa em um tenant `scheduling`, com perfil que tem `dashboard:view`.

### Passos

1. O sistema exibe o Dashboard com a data de hoje ("Visão geral · <data>") e, enquanto houver passos pendentes, o checklist de onboarding.
2. O sistema apresenta quatro cards do dia:
   - **Agendamentos hoje**: agendamentos do dia, exceto cancelados.
   - **Receita estimada**: soma dos precos dos agendamentos confirmados, em atendimento e concluidos.
   - **Concluídos hoje**.
   - **A confirmar**: agendamentos pendentes.
3. O card **Próximos agendamentos** lista os pendentes e confirmados de hoje por horario (horario, cliente, servicos, profissional e status), com o atalho "Ver agenda".
4. O card **Por profissional** mostra quantos agendamentos (nao cancelados) cada profissional ativo tem hoje. E uma contagem, nao uma taxa de ocupacao.

### Pos-condicao / Estados resultantes

- Usuario tem a visao do dia e o atalho para a Agenda.
- Nenhum dado e alterado; o fluxo e de leitura.
- Nao existem cards de cancelamentos ou no-shows, nem ocupacao percentual por profissional. Os itens da lista nao abrem o detalhe (ainda nao implementado).

### Entidades e regras envolvidas

- Entidades: `Appointment`, `Professional`, `Service`, `Client`.
- Receita estimada: confirmados, em atendimento e concluidos; cancelados, pendentes e no-shows nao contam. Valor de cada agendamento = soma dos precos dos seus servicos (`totalPriceCents`).
- No tenant `classes`, o Dashboard e outro (Aulas hoje, Alunos matriculados, Presenças hoje, Mensalidades recebidas).

---

## Fluxo 3: Criar agendamento

### Pre-condicoes

- Sessao mockada ativa com permissao de criar agendamento.
- Existem ao menos um cliente, um profissional e um servico ativos. Se faltar algum, o formulario mostra "Antes de agendar, cadastre" com atalhos e o botao fica desabilitado.

### Passos (caminho feliz)

1. O usuario abre a Agenda e aciona "Novo agendamento" (ou clica num horario livre do calendario, que ja preenche data, horario e profissional).
2. O usuario seleciona o cliente. So clientes **ativos** aparecem.
3. O usuario seleciona o profissional (so ativos) e **um ou mais servicos** (so ativos). Todos os servicos ativos aparecem para qualquer profissional; os que ele realiza vem no topo com o selo "realiza", sem impedir os demais.
4. O sistema calcula o fim a partir do inicio mais a soma das duracoes (ex.: Corte Degrade 40 min + Sobrancelha 15 min, 14:00 -> 14:55).
5. O usuario informa data, horario e observacoes opcionais e aciona "Criar agendamento".
6. O sistema valida o horario (`checkSlotAvailability` em `packages/core/src/scheduling.ts`) e cria o agendamento com origem `manual` e status `pending`.

### Passos (conflitos bloqueantes)

1. O horario escolhido se sobrepoe a outro agendamento do mesmo profissional (que nao esteja cancelado nem com no-show) ou cai sobre um bloqueio.
2. O sistema recusa e mostra a mensagem no campo de horario: "Este horário já está ocupado para [Profissional]." ou "Este horário está bloqueado e não aceita agendamento."
3. O usuario ajusta horario ou profissional. Nao ha opcao de salvar mesmo assim.

### Passos (regras moles, com confirmacao)

Estes casos pedem confirmacao e, se o usuario aceitar, o agendamento e criado:

- Fora do expediente da unidade: "Agendar fora do expediente da unidade?"
- Fora do horario do profissional: "Agendar fora do horário do profissional?" (ou "Agendar sem horário de trabalho cadastrado?" quando ele nao tem escala).
- No intervalo de almoco: "Agendar durante o intervalo?"
- Data/horario no passado: "Agendar para um horário no passado?"

O botao de confirmacao e sempre "Agendar mesmo assim".

### Pos-condicao / Estados resultantes

- Caminho feliz ou confirmado: novo `Appointment` com status `pending`, origem `manual`, `serviceIds` com 1..n servicos; visivel na Agenda e no Dashboard; entrada na Auditoria.
- Conflito bloqueante ou confirmacao recusada: nada e criado.

### Entidades e regras envolvidas

- Entidades: `Appointment`, `Client`, `Professional`, `Service`, `TimeBlock`.
- Duracao e preco do agendamento = soma dos servicos.
- Profissional inativo: "Este profissional está inativo."; servico inativo: "[Servico] está inativo." (validacao do service; a UI ja so oferece ativos).
- A associacao profissional x servico e informativa no agendamento avulso (ver `appointmentsService`).

---

## Fluxo 4: Remarcar agendamento

### Pre-condicoes

- Sessao mockada ativa com `appointments:reschedule`.
- O agendamento nao esta em status final (`completed`, `canceled` ou `no_show`); nesses status o menu de acoes nao aparece.

### Passos

1. O usuario abre o agendamento e, em "Mais ações", aciona "Remarcar".
2. Se o agendamento pertence a uma serie, o sistema pergunta: "Este agendamento faz parte de uma série. Remarcar quais ocorrências?" com "Somente esta ocorrência" / "Esta e as futuras".
3. O usuario escolhe profissional e horario (e data, se for so esta ocorrencia) e, opcionalmente, o "Motivo (opcional)". Cliente e servicos sao mantidos.
4. O sistema valida o novo horario. Na remarcacao, sobreposicao, bloqueio, fora do expediente da unidade, fora do horario do profissional e intervalo sao **todos bloqueantes** (o service de remarcacao nao aceita as confirmacoes moles do Fluxo 3). So o horario no passado pede confirmacao ("Remarcar para um horário no passado?").
5. O sistema move o agendamento e acrescenta o horario anterior em `rescheduledFrom` (data, horario, profissional e motivo), alem de registrar a remarcacao na Auditoria.

### Pos-condicao / Estados resultantes

- Agendamento movido, mantendo cliente, servicos e status.
- Rastro em `Appointment.rescheduledFrom` + evento `rescheduled` na Auditoria. O detalhe do agendamento mostra "Remarcado — originalmente dd/MM às HH:mm" com o ultimo motivo.
- "Esta e as futuras": aplica o novo horario/profissional a esta e as proximas ocorrencias ativas da serie, mantendo a data de cada uma. Ocorrencias em conflito sao puladas: "N ocorrência(s) remarcada(s); M em conflito não foram remarcadas."
- Em caso de conflito na remarcacao simples: nada muda.

### Entidades e regras envolvidas

- Entidades: `Appointment`, `RecurrenceSeries`, `Professional`, `TimeBlock`.
- Para mudar data/horario use Remarcar; "Editar" altera cliente, profissional, servicos e observacoes, mas nao data/horario.

---

## Fluxo 5: Mudar status do agendamento

### Pre-condicoes

- Sessao mockada ativa com `appointments:status` (e `appointments:cancel` para cancelar).

### Passos

1. O usuario abre o agendamento (na Agenda).
2. A acao principal depende do status atual:
   - **Confirmar**: `pending` -> `confirmed`.
   - **Iniciar atendimento**: `confirmed` -> `in_service`.
   - **Concluir**: `in_service` -> `completed`.
3. Em "Mais ações":
   - **Não compareceu** (so em `pending` ou `confirmed`): pede confirmacao com motivo opcional -> `no_show`.
   - **Cancelar agendamento** (em qualquer status nao final): exige "Motivo do cancelamento" -> `canceled`.
4. O sistema aplica a mudanca, registra na Auditoria e atualiza Agenda e Dashboard.

### Pos-condicao / Estados resultantes

- `completed`: conta na receita estimada; sem acoes de edicao na UI.
- `canceled`: permanece no historico com `cancellationReason`; libera o horario; nao conta na receita.
- `no_show`: guarda `noShowReason` quando informado; libera o horario; nao conta na receita.
- Nao ha como reverter um status final pela UI.

### Entidades e regras envolvidas

- Entidades: `Appointment`.
- **Nao existe maquina de estados no service**: `appointmentsService.setStatus` aceita qualquer transicao. Quem limita as transicoes e so a UI (botoes acima). Uma API real deve validar.

---

## Fluxo 6: Bloquear horario de um profissional

### Pre-condicoes

- Sessao mockada ativa com `appointments:block`.
- Existe ao menos um profissional.

### Passos

1. Na Agenda, o usuario aciona o bloqueio e abre o dialogo "Bloquear horário".
2. Informa profissional, data, inicio, fim e, opcionalmente, o motivo (ex.: folga, indisponibilidade).
3. O sistema valida so os campos ("O horário de início deve ser anterior ao de fim.") e cria o `TimeBlock`.

### Pos-condicao / Estados resultantes

- Bloqueio exibido na Agenda como "Bloqueado" + motivo.
- O intervalo passa a recusar novos agendamentos, remarcacoes e ocorrencias de serie.
- **O sistema nao verifica agendamentos ja existentes no intervalo**: eles continuam la, sobrepostos ao bloqueio (aviso ainda nao implementado).
- Criar bloqueio nao entra na Auditoria (ainda nao implementado).

### Entidades e regras envolvidas

- Entidades: `TimeBlock`, `Professional`, `Appointment`.
- Almoco recorrente nao e bloqueio: e o intervalo do horario de trabalho (`breakStart`/`breakEnd`), que so pede confirmacao.

---

## Fluxo 7: Criar agendamento recorrente (serie)

### Pre-condicoes

- Sessao mockada ativa.
- Existem cliente, profissional e servicos ativos; o profissional precisa ter os servicos escolhidos em "Servicos que faz" (a serie ainda aplica essa regra, diferente do agendamento avulso).

### Passos

1. Na Agenda, o usuario aciona "Série recorrente" e abre "Nova série recorrente".
2. Escolhe cliente, profissional, servicos, data de inicio e horario.
3. Escolhe a frequencia: semanal, quinzenal ou mensal (`weekly`, `biweekly`, `monthly`).
4. Escolhe o termino: "Número de ocorrências" ou data final. Nao existe opcao infinita.
5. O sistema gera as datas e, para cada uma, valida o horario sem confirmacoes moles: sobreposicao, bloqueio, fora do expediente, fora do horario do profissional e intervalo contam como conflito.
6. Ocorrencias sem conflito sao criadas com origem `recurrence`, status `pending` e `seriesId`. As em conflito nao sao criadas.
7. O sistema avisa: "Série criada com N ocorrência(s)." ou "N ocorrência(s) criada(s); M em conflito não foram criadas. Resolva manualmente." (ou "Nenhuma ocorrência pôde ser criada (todas em conflito).").

### Pos-condicao / Estados resultantes

- `RecurrenceSeries` criada; ocorrencias sem conflito viram agendamentos.
- As datas em conflito nao ficam guardadas em lugar nenhum; a resolucao e criar um agendamento avulso para a data.
- A serie e finita.
- A criacao da serie nao entra na Auditoria (ainda nao implementado).

### Entidades e regras envolvidas

- Entidades: `RecurrenceSeries`, `Appointment`, `Client`, `Professional`, `Service`, `TimeBlock`.
- Remarcacao tem escopo de serie (Fluxo 4). Cancelamento e sempre de uma ocorrencia; nao existe cancelar/excluir a serie.

---

## Fluxo 8: Cadastrar/editar Cliente

### Pre-condicoes

- Sessao mockada ativa, na navegacao Clientes (no tenant de turmas, "Alunos").

### Passos (cadastrar)

1. O usuario aciona "Novo cliente" ("Novo aluno").
2. Preenche nome, telefone (obrigatorio, ao menos 10 digitos), e-mail opcional, observacoes e endereco opcional. No tenant de turmas ha tambem a secao de plano (Fluxo 12).
3. O usuario salva. O sistema cria o cliente ativo e registra na Auditoria.

### Passos (editar / inativar / reativar)

1. Na lista, o usuario usa as acoes da linha: editar, inativar ("Inativar cliente?") ou reativar ("Reativar cliente?").
2. Fechar o formulario com alteracoes pede "Descartar alterações?".

### Pos-condicao / Estados resultantes

- Cliente ativo aparece para novos agendamentos; cliente inativo **nao aparece** no seletor de novos agendamentos, mas os agendamentos antigos continuam com o nome dele.
- No tenant de turmas, inativar o aluno cancela as mensalidades em aberto de periodos que ainda nao comecaram (ver [`15-regras-de-cobranca.md`](15-regras-de-cobranca.md)).

### Entidades e regras envolvidas

- Entidades: `Client`.
- Mensagens de validacao: ver `10-estados-e-mensagens.md`.

---

## Fluxo 9: Cadastrar/editar Servico

### Pre-condicoes

- Sessao mockada ativa em tenant `scheduling`, na navegacao Servicos.

### Passos (cadastrar)

1. O usuario aciona "Novo serviço".
2. Preenche nome, categoria (opcional; entidade `Category` do tenant), duracao em minutos (> 0), preco (>= 0) e descricao opcional.
3. O usuario salva. O sistema cria o servico ativo.

### Passos (editar / inativar / reativar)

1. O usuario edita o servico ou usa "Inativar serviço?" / "Reativar serviço?".

### Pos-condicao / Estados resultantes

- Servico sem categoria aparece como "Sem categoria".
- Servico ativo pode ser escolhido em agendamentos; inativo nao aparece no seletor.
- A duracao entra na soma que define o fim dos novos agendamentos.

### Entidades e regras envolvidas

- Entidades: `Service`, `Category`.
- Preco em reais, armazenado em centavos (`priceCents`).

---

## Fluxo 10: Cadastrar/editar Profissional

### Pre-condicoes

- Sessao mockada ativa, na navegacao Equipe.

### Passos (cadastrar)

1. O usuario aciona "Novo profissional".
2. Preenche nome (obrigatorio), cargo (opcional; escolhido entre os `Role` ja cadastrados), telefone opcional, endereco opcional e horarios de trabalho (opcionais, com intervalo de almoco opcional).
3. No tenant `scheduling`, marca os servicos que realiza (opcional). No tenant `classes`, marca as modalidades que leciona (**ao menos uma e obrigatoria**).
4. O usuario salva. O sistema cria o profissional ativo.

### Passos (editar / inativar / reativar)

1. O usuario ajusta os dados ou usa "Inativar profissional?" / "Reativar profissional?".

### Pos-condicao / Estados resultantes

- Profissional ativo aparece para novos agendamentos; inativo nao aparece.
- Sem horario cadastrado, o profissional aparece em todo dia aberto da Agenda e agendar com ele pede confirmacao.
- "Servicos que faz" so destaca servicos no agendamento avulso (e ainda restringe a serie recorrente).

### Entidades e regras envolvidas

- Entidades: `Professional`, `Role`, `Service`, `Category` (modalidade).
- Inativar profissional com agendamentos futuros nao faz nada com esses agendamentos (sem aviso; ainda nao implementado).

---

## Fluxo 11: Buscar cliente

### Pre-condicoes

- Sessao mockada ativa, com clientes cadastrados.

### Passos

1. O usuario abre Clientes.
2. Busca por nome ou telefone e, se quiser, filtra por status.
3. O sistema lista os resultados, com os inativos identificados.
4. A partir da linha, o usuario pode editar, inativar ou reativar.

### Pos-condicao / Estados resultantes

- Leitura apenas.
- **Nao existe tela de detalhe nem historico de agendamentos do cliente** (ainda nao implementado). Para ver os agendamentos de um cliente, use a aba Lista da Agenda com busca por cliente.

### Entidades e regras envolvidas

- Entidades: `Client`, `Appointment`.

---

## Fluxo 12 (M3): Cadastrar aluno com plano e 1a cobranca

1. Em Alunos, "Novo aluno": dados basicos + plano (`Client.planId`), inicio da vigencia (`planStartDate`) e situacao da assinatura (`membershipStatus`: ativa, trancada/pausada, cancelada).
2. A regra de cobranca vem da academia (Configuracoes -> Regras de Cobrança) e pode ser personalizada no aluno: momento do pagamento, entrada no meio do periodo, dia de vencimento e desconto.
3. O formulario calcula a 1a mensalidade pelo motor (`@gestarahub/core/billing`) e mostra valor e vencimento, que podem ser ajustados.
4. Ao salvar, o aluno e criado e, se o valor for maior que zero, a 1a cobranca (`Charge` `kind: "membership"`) nasce junto.

Regras completas: [`15-regras-de-cobranca.md`](15-regras-de-cobranca.md).

## Fluxo 13 (M3): Gerar mensalidades da competencia

1. Em Mensalidades, o usuario escolhe a competencia (mes) e aciona "Gerar cobranças".
2. Confirma em "Gerar cobranças de <Mês de AAAA>?".
3. O sistema cria as mensalidades que vencem naquele mes para cada aluno ativo com plano e assinatura ativa, pela regra dele. E idempotente: um periodo de uso nunca gera duas cobrancas ("Nenhuma cobrança nova (já geradas).").
4. A geracao entra na Auditoria.

## Fluxo 14 (M3): Registrar pagamento

1. Na lista de Mensalidades, o usuario aciona o pagamento de uma cobranca.
2. O dialogo "Registrar pagamento" mostra aluno, valor e periodo e exige a forma (Pix, Dinheiro, Cartão, Outro).
3. A cobranca vira `paid` com `paidAt` e `method`.
4. Correcoes, todas com confirmacao: "Desfazer pagamento?", "Cancelar cobrança", "Reabrir cobrança?" e, para a competencia inteira, "Resetar cobranças da competência" (nunca apaga pagas).

## Fluxo 15 (M3): Matricular aluno e lista de espera

1. No detalhe da turma, "Matricular alunos" abre a selecao multipla de alunos.
2. Se o aluno ja tem aula no mesmo dia e horario em outra turma, a matricula e recusada (`CLASS_SCHEDULE_CONFLICT`).
3. Com a turma lotada, o dialogo avisa e oferece "Pôr na lista de espera" ou "Matricular mesmo assim (N)".
4. A lista de espera fica no detalhe da turma. Ao abrir vaga, a promocao e manual: "Promover da lista de espera?" (matricula mesmo se lotada) ou "Remover da lista de espera?".
5. "Cancelar matrícula?" tira o aluno da turma e da chamada; a mensalidade do aluno nao muda (o plano e do aluno).

## Fluxo 16 (M3): Fazer a chamada

1. No Calendario, o usuario abre a aula (sessao gerada a partir da grade da turma).
2. A lista mostra matriculados vigentes naquela data, avulsos e experimentais, cada um com Presente / Faltou / Justificada (um clique, sem confirmacao).
3. Aula futura: a chamada fica desabilitada ("A chamada só pode ser feita no dia da aula ou depois.").
4. Na mesma tela: "Adicionar aluno nesta aula" (Aula Avulsa gera cobranca avulsa; Experimental nao gera), "Remover da aula?" (so avulsos/experimentais; cancela a cobranca avulsa em aberto) e "Trocar instrutor" (substituto so desta aula; restaurar o titular e um clique).

Regras completas: [`11-modelo-3-turmas.md`](11-modelo-3-turmas.md).

---

## Pendencias

- Resolucao de ocorrencias de serie em conflito: hoje so um aviso; as datas nao ficam guardadas para resolver depois.
- Maquina de estados de agendamento no service (hoje so a UI limita) e decisao sobre reverter status final.
- Comportamento ao inativar profissional ou servico com agendamentos futuros.
- Aviso de agendamentos existentes ao criar bloqueio.
- Auditoria de bloqueios e da criacao de series.
- Tela de detalhe/historico do cliente e do aluno.
