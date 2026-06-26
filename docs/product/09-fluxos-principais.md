# Fluxos Principais

## Decisao

Os fluxos (jornadas) do MVP devem ser documentados de forma explicita, cada um com pre-condicoes, passos numerados e pos-condicao/estados resultantes. Isso orienta o frontend mockado, alinha o time e serve de contrato comportamental para testes e para a evolucao futura do backend.

A interface do MVP usa uma linguagem unica e generica de navegacao: Clientes, Equipe, Servicos, Agenda e Agendamentos. O termo "Profissional" e usado no contexto de um agendamento e em telas de detalhe. O sistema futuro de rotulos por segmento (label overrides) NAO entra no MVP.

## Contexto

- As regras de negocio que regem estes fluxos estao em `docs/product/05-regras-negocio.md`. Sempre que um fluxo cita uma regra (conflito, disponibilidade, status, origem, remarcacao, bloqueio, recorrencia), a fonte normativa e aquele documento.
- O cenario, os dados e os exemplos usados aqui sao a barbearia ficticia Corte Nobre, documentada em `docs/product/08-barbearia-corte-nobre.md` (fonte unica de verdade dos dados mock).
- Os perfis e quem pode executar cada acao estao em `docs/product/06-perfis-permissoes.md`. No MVP, o usuario logado e tratado como Proprietario/Admin.
- Os modulos e telas envolvidos estao em `docs/product/03-modulos.md`.

## Escopo

Fluxos documentados neste arquivo:

1. Login mockado
2. Abrir o dia (dashboard operacional)
3. Criar agendamento (incluindo o caminho de conflito de horario)
4. Remarcar agendamento (com escopo de serie)
5. Mudar status do agendamento (confirmar, em atendimento, concluir, cancelar, no-show)
6. Bloquear horario de um profissional
7. Criar agendamento recorrente (frequencia, termino e ocorrencia em conflito)
8. Cadastrar/editar Cliente
9. Cadastrar/editar Servico
10. Cadastrar/editar Profissional
11. Buscar cliente e ver historico

## Fora de escopo

- Encaixe manual com alerta de conflito. No MVP, a sobreposicao de horario para o mesmo profissional e SEMPRE bloqueada (ver `docs/product/05-regras-negocio.md`).
- Backend real, persistencia real e autenticacao real. Tudo e mockado.
- Origens de agendamento `online` e `whatsapp`.
- Recorrencia infinita.
- Sistema de rotulos por segmento (label overrides).

## Convencoes dos fluxos

- Entidades: Cliente, Profissional, Servico, Agendamento, Bloqueio de horario, Serie (recorrencia), Organizacao, Unidade.
- Status de agendamento (chave -> rotulo): `pendente` -> Pendente; `confirmado` -> Confirmado; `em_atendimento` -> Em atendimento; `concluido` -> Concluido; `cancelado` -> Cancelado; `nao_compareceu` -> Nao compareceu.
- Origem de agendamento (enum): `manual`, `recorrencia`. (futuro: `online`, `whatsapp`)
- Funcionamento da unidade Corte Nobre - Matriz: Seg a Sex 09:00-20:00, Sab 08:00-18:00, Domingo fechado.

---

## Fluxo 1: Login mockado

### Pre-condicoes

- Aplicacao frontend carregada, sem sessao ativa.
- Usuario mock de Proprietario/Admin disponivel no mock (ex.: Marcelo Andrade, proprietario da Corte Nobre).

### Passos

1. O usuario abre a aplicacao e ve a tela de login.
2. O usuario informa as credenciais mockadas (ou usa um acesso de demonstracao).
3. O usuario aciona "Entrar".
4. O sistema valida de forma simulada e cria uma sessao mockada com perfil Proprietario/Admin.
5. O sistema redireciona para o dashboard operacional (abrir o dia).

### Pos-condicao / Estados resultantes

- Sessao mockada ativa com a organizacao Corte Nobre e a unidade Corte Nobre - Matriz selecionadas.
- Usuario na tela inicial (dashboard) com a navegacao disponivel: Clientes, Equipe, Servicos, Agenda, Agendamentos.

### Entidades e regras envolvidas

- Entidades: Organizacao, Unidade.
- Perfis: usuario logado tratado como Proprietario/Admin (ver `docs/product/06-perfis-permissoes.md`).
- Autenticacao visual mockada, sem backend (ver `docs/product/04-mvp-barbearia.md`).

---

## Fluxo 2: Abrir o dia (dashboard operacional)

### Pre-condicoes

- Sessao mockada ativa.
- Dados mock de agendamentos do dia carregados (ver `docs/product/08-barbearia-corte-nobre.md`).

### Passos

1. Apos o login, o sistema exibe o dashboard operacional para a data de hoje.
2. O sistema apresenta os cards de indicadores do dia: agendamentos de hoje, proximos atendimentos, concluidos, cancelamentos e no-shows e receita estimada do dia.
3. O sistema mostra a ocupacao por profissional (ex.: Marcelo Andrade com agenda mais cheia, Diego Santos com a mais vazia).
4. O usuario consulta a lista de proximos atendimentos com horario, cliente, servico, profissional e status.
5. O usuario pode clicar em um atendimento para abrir o detalhe, ou navegar para a Agenda.

### Pos-condicao / Estados resultantes

- Usuario tem a visao operacional do dia e os atalhos para as proximas acoes.
- Nenhum dado e alterado; o fluxo e de leitura.

### Entidades e regras envolvidas

- Entidades: Agendamento, Profissional, Servico, Cliente.
- Regras de receita estimada: considera confirmados, em atendimento e concluidos; cancelados e no-shows nao contam (ver `docs/product/05-regras-negocio.md`).
- Calculo a partir do preco do servico (em reais; armazenado em centavos), ex.: um Combo Completo concluido soma R$ 90,00 a receita estimada.

---

## Fluxo 3: Criar agendamento

### Pre-condicoes

- Sessao mockada ativa.
- Existem clientes, profissionais e servicos ativos no mock.
- O usuario esta na Agenda ou na acao "Novo agendamento".

### Passos (caminho feliz)

1. O usuario abre a Agenda e escolhe a data e o profissional (ex.: 26/06/2026, Rafael Lima).
2. O usuario aciona "Novo agendamento" em um horario livre (ex.: 14:00).
3. O usuario seleciona o cliente (ex.: Carlos Mendes). Clientes inativos nao aparecem como primeira opcao.
4. O usuario seleciona o servico (ex.: Corte Degrade, 40 min, R$ 55,00). So aparecem servicos ativos que o profissional realiza.
5. O sistema calcula o horario de fim a partir do inicio mais a duracao do servico (14:00 + 40 min = 14:40).
6. O sistema valida disponibilidade: dentro do expediente da unidade, sem sobreposicao com outro agendamento do mesmo profissional e sem coincidir com um bloqueio.
7. O usuario confirma. O sistema cria o agendamento com origem `manual` e status inicial `pendente` (Pendente).

### Passos (caminho de conflito - bloqueado no MVP)

1. O usuario tenta criar um agendamento que se sobrepoe a outro do mesmo profissional, cai fora do expediente ou coincide com um bloqueio.
   - Exemplo: Marcelo Andrade ja tem Combo Corte + Barba das 10:00 as 11:00 no sabado; o usuario tenta marcar um Corte Masculino as 10:30 para Marcelo.
2. O sistema detecta o conflito durante a validacao de disponibilidade.
3. O sistema impede a criacao e exibe mensagem de conflito, indicando o motivo (sobreposicao, fora do expediente ou bloqueio).
4. O usuario ajusta horario, profissional ou desiste. No MVP NAO existe encaixe manual; nao ha opcao de salvar mesmo assim.

### Pos-condicao / Estados resultantes

- Caminho feliz: novo Agendamento criado com status `pendente`, origem `manual`, vinculado a cliente, profissional e servico; visivel na Agenda e no dashboard.
- Caminho de conflito: nenhum agendamento e criado; nenhum estado e alterado.

### Entidades e regras envolvidas

- Entidades: Agendamento, Cliente, Profissional, Servico, Bloqueio de horario.
- Regras de agendamento, disponibilidade e conflito; sobreposicao para o mesmo profissional e SEMPRE bloqueada (ver `docs/product/05-regras-negocio.md`).
- Duracao do agendamento segue a duracao do servico.
- Profissional/servico/cliente inativos nao sao sugeridos para novos agendamentos.

---

## Fluxo 4: Remarcar agendamento

### Pre-condicoes

- Sessao mockada ativa.
- Existe um agendamento que ainda nao foi concluido (ex.: agendamento pendente ou confirmado de Joao Pereira com Bruno Costa).

### Passos

1. O usuario abre o agendamento na Agenda ou no detalhe.
2. O usuario aciona "Remarcar".
3. O sistema verifica se o agendamento pertence a uma serie recorrente:
   - Se pertence a uma serie, o sistema pergunta o escopo: "somente esta ocorrencia" ou "esta e as futuras".
   - Se nao pertence, segue direto para a escolha de novo horario/profissional.
4. O usuario escolhe o novo horario e/ou o novo profissional, mantendo o mesmo cliente e o mesmo servico.
5. O sistema valida o novo horario com as mesmas regras de um novo agendamento: expediente, bloqueios e sobreposicao com o mesmo profissional.
   - Se houver conflito, a remarcacao e impedida e o usuario deve ajustar (mesmo comportamento do Fluxo 3, caminho de conflito).
6. O usuario confirma. O sistema move o agendamento e registra rastro no historico (horario/profissional anterior e novo).

### Pos-condicao / Estados resultantes

- Agendamento movido para o novo horario e/ou profissional, mantendo cliente e servico.
- O status NAO vira `concluido` por causa da remarcacao; permanece no status anterior (ex.: continua `confirmado`).
- Historico registra que houve remarcacao.
- Se a escolha foi "esta e as futuras" em uma serie, as ocorrencias futuras da serie tambem sao movidas conforme o padrao escolhido.
- Em caso de conflito: nenhuma alteracao e aplicada.

### Entidades e regras envolvidas

- Entidades: Agendamento, Serie (recorrencia), Profissional, Bloqueio de horario.
- Regras de remarcacao, conflito e disponibilidade; escopo "somente esta ocorrencia" / "esta e as futuras" para series (ver `docs/product/05-regras-negocio.md`).
- Acao disponivel para Admin, Gerente e Atendente (ver `docs/product/06-perfis-permissoes.md`).

---

## Fluxo 5: Mudar status do agendamento

### Pre-condicoes

- Sessao mockada ativa.
- Existe um agendamento em um status que admite a transicao desejada.

### Passos

1. O usuario abre o agendamento (na Agenda, no dashboard ou no detalhe).
2. O usuario escolhe a acao de status conforme a situacao:
   - **Confirmar**: de `pendente` para `confirmado` (ex.: confirmar o Corte Masculino de Pedro Henrique Alves com Diego Santos).
   - **Iniciar atendimento**: de `confirmado` (ou `pendente`) para `em_atendimento`, quando o servico comeca.
   - **Concluir**: de `em_atendimento` para `concluido`, quando o atendimento termina.
   - **Cancelar**: de `pendente`, `confirmado` ou `em_atendimento` para `cancelado`.
   - **Registrar nao comparecimento (no-show)**: de `pendente` ou `confirmado` para `nao_compareceu`, quando o cliente nao aparece.
3. O sistema aplica a mudanca de status e atualiza a Agenda e os indicadores do dashboard.

### Pos-condicao / Estados resultantes

- O agendamento assume o novo status.
- `concluido`: conta como receita realizada/estimada e como atendimento finalizado; nao deve ser editado livremente como agendamento futuro.
- `cancelado`: permanece no historico; nao conta como receita estimada.
- `nao_compareceu`: tratado como perda operacional; nao conta como atendimento concluido nem como receita realizada.
- Os indicadores do dashboard (concluidos, cancelamentos, no-shows, receita estimada) sao recalculados.

### Entidades e regras envolvidas

- Entidades: Agendamento.
- Regras de status, receita estimada e tratamento de no-show (ver `docs/product/05-regras-negocio.md`).
- Tabela de status (chave -> rotulo) na secao "Convencoes dos fluxos".

---

## Fluxo 6: Bloquear horario de um profissional

### Pre-condicoes

- Sessao mockada ativa com perfil que pode criar bloqueios (Admin ou Gerente).
- Profissional alvo existe e esta ativo (ex.: Marcelo Andrade).

### Passos

1. O usuario abre a Agenda e seleciona o profissional (ex.: Marcelo Andrade).
2. O usuario aciona "Bloquear horario".
3. O usuario informa data, horario de inicio, horario de fim e, opcionalmente, o motivo (ex.: almoco 12:00-13:00; folga; indisponibilidade).
4. O sistema verifica se ja existe agendamento no intervalo escolhido. Se existir, sinaliza o conflito para que o usuario resolva (ex.: remarcar o agendamento antes de bloquear).
5. O usuario confirma. O sistema cria o Bloqueio de horario para aquele profissional.

### Pos-condicao / Estados resultantes

- Bloqueio criado e exibido destacado na Agenda do profissional.
- O intervalo bloqueado nao aceita novos agendamentos, remarcacoes nem ocorrencias recorrentes.
- Tentativas futuras de agendar nesse intervalo seguem o caminho de conflito (bloqueado).

### Entidades e regras envolvidas

- Entidades: Bloqueio de horario, Profissional, Agendamento.
- Regras de bloqueio de horario e de disponibilidade/conflito (ver `docs/product/05-regras-negocio.md`).
- Criacao de bloqueio: Admin e Gerente. Atendente apenas visualiza (ver `docs/product/06-perfis-permissoes.md`).

---

## Fluxo 7: Criar agendamento recorrente (serie)

### Pre-condicoes

- Sessao mockada ativa.
- Existem cliente, profissional e servico ativos (ex.: Carlos Mendes, cliente recorrente que faz Combo Corte + Barba quinzenalmente aos sabados com Marcelo Andrade).

### Passos

1. O usuario inicia um novo agendamento (Fluxo 3) e ativa a opcao "Repetir / Recorrente".
2. O usuario escolhe a frequencia: semanal, quinzenal ou mensal (mantendo o mesmo dia da semana e o mesmo horario).
   - Exemplo: a cada duas semanas (quinzenal), no sabado as 10:00, Combo Corte + Barba (60 min, R$ 75,00) com Marcelo Andrade.
3. O usuario escolhe o termino: por numero de ocorrencias (ex.: 8 ocorrencias) OU por data final. Nao existe opcao infinita.
4. O sistema calcula as datas das ocorrencias e gera N agendamentos ligados por um `serieId`, com origem `recorrencia`.
5. Para cada ocorrencia, o sistema valida disponibilidade (expediente, bloqueios e sobreposicao com o mesmo profissional):
   - Ocorrencias sem conflito sao criadas normalmente (status inicial `pendente`).
   - Ocorrencia que cair em horario ocupado, fora do expediente ou em bloqueio e sinalizada como conflito e NAO e criada automaticamente; fica pendente de resolucao manual.
6. O sistema apresenta o resumo: quantas ocorrencias foram criadas e quais ficaram em conflito a resolver.

### Pos-condicao / Estados resultantes

- Serie criada com `serieId`; ocorrencias sem conflito criadas como agendamentos com origem `recorrencia` e status `pendente`.
- Ocorrencias em conflito ficam sinalizadas e nao criadas, aguardando resolucao manual (ex.: escolher outro horario para aquela data especifica).
- A serie e finita; nao gera ocorrencias indefinidamente.

### Entidades e regras envolvidas

- Entidades: Serie (recorrencia), Agendamento, Cliente, Profissional, Servico, Bloqueio de horario.
- Regras de recorrencia, conflito e disponibilidade (ver `docs/product/05-regras-negocio.md`).
- Recorrencia simples e repeticao de compromisso individual; NAO transforma o produto em modelo de turmas.
- Edicao/cancelamento de ocorrencias seguem o escopo "somente esta ocorrencia" / "esta e as futuras".
- Acao disponivel para Admin, Gerente e Atendente (ver `docs/product/06-perfis-permissoes.md`).

---

## Fluxo 8: Cadastrar/editar Cliente

### Pre-condicoes

- Sessao mockada ativa.
- Usuario na navegacao Clientes.

### Passos (cadastrar)

1. O usuario abre Clientes e aciona "Novo cliente".
2. O usuario preenche os dados: nome (ex.: Henrique Azevedo), telefone, email opcional e observacoes.
3. O usuario salva. O sistema cria o cliente com status ativo.

### Passos (editar / inativar)

1. O usuario abre um cliente existente (ex.: um cliente inativo da lista).
2. O usuario altera dados ou muda o status para ativo/inativo.
3. O usuario salva. O sistema atualiza o cliente.

### Pos-condicao / Estados resultantes

- Cliente criado ou atualizado, disponivel na lista e na busca.
- Cliente ativo pode ser selecionado em novos agendamentos.
- Cliente inativo aparece no historico, mas nao e sugerido como primeira opcao para novos agendamentos.

### Entidades e regras envolvidas

- Entidades: Cliente.
- Campos esperados em `docs/product/04-mvp-barbearia.md`.
- Regra: cliente inativo nao e sugerido como primeira opcao (ver `docs/product/05-regras-negocio.md`).

---

## Fluxo 9: Cadastrar/editar Servico

### Pre-condicoes

- Sessao mockada ativa.
- Usuario na navegacao Servicos.

### Passos (cadastrar)

1. O usuario abre Servicos e aciona "Novo servico".
2. O usuario preenche: nome (ex.: Pigmentacao de Barba), categoria (Barba), duracao em minutos (45) e preco (R$ 60,00 / 6000 centavos), com descricao opcional.
3. O usuario salva. O sistema cria o servico com status ativo.

### Passos (editar / inativar)

1. O usuario abre um servico existente (ex.: Relaxamento / Progressiva).
2. O usuario altera duracao, preco, categoria ou muda o status para ativo/inativo.
3. O usuario salva. O sistema atualiza o servico.

### Pos-condicao / Estados resultantes

- Servico criado ou atualizado, agrupado por categoria (Cabelo, Barba, Cuidados, Combos).
- Servico ativo pode ser escolhido em agendamentos; servico inativo nao e sugerido para novos agendamentos.
- A duracao do servico passa a definir o horario de fim dos novos agendamentos que o usarem.

### Entidades e regras envolvidas

- Entidades: Servico.
- Preco em reais, armazenado em centavos; coerente com o catalogo de 12 servicos da Corte Nobre (ver `docs/product/08-barbearia-corte-nobre.md`).
- Regra: servico inativo nao e sugerido para novos agendamentos (ver `docs/product/05-regras-negocio.md`).

---

## Fluxo 10: Cadastrar/editar Profissional

### Pre-condicoes

- Sessao mockada ativa.
- Usuario na navegacao Equipe.

### Passos (cadastrar)

1. O usuario abre Equipe e aciona "Novo profissional".
2. O usuario preenche: nome (ex.: Diego Santos), cargo/especialidade (Barbeiro junior), telefone opcional, horarios de trabalho (ex.: Qua-Sab) e os servicos que realiza.
3. O usuario salva. O sistema cria o profissional com status ativo.

### Passos (editar / inativar)

1. O usuario abre um profissional existente (ex.: Rafael Lima).
2. O usuario ajusta especialidade, horarios de trabalho, servicos realizados ou muda o status para ativo/inativo.
   - Exemplo: Rafael Lima faz todos os servicos, exceto Relaxamento / Progressiva.
3. O usuario salva. O sistema atualiza o profissional.

### Pos-condicao / Estados resultantes

- Profissional criado ou atualizado na Equipe, com seus servicos e disponibilidade basica.
- Profissional ativo pode ser selecionado em novos agendamentos; profissional inativo nao e sugerido.
- A lista de servicos realizados limita quais servicos aparecem ao agendar com aquele profissional (ex.: Diego Santos nao aparece para Relaxamento / Progressiva).

### Entidades e regras envolvidas

- Entidades: Profissional, Servico.
- Vocabulario: "Equipe" e o rotulo da navegacao; "Profissional" e o termo de detalhe e de agendamento.
- Regra: profissional inativo nao e sugerido para novos agendamentos; disponibilidade baseada em horarios de trabalho (ver `docs/product/05-regras-negocio.md`).

---

## Fluxo 11: Buscar cliente e ver historico

### Pre-condicoes

- Sessao mockada ativa.
- Existem clientes com historico mockado de agendamentos.

### Passos

1. O usuario abre a navegacao Clientes.
2. O usuario busca por nome ou telefone (ex.: "Lucas" para encontrar Lucas Ferreira).
3. O sistema exibe os resultados, incluindo clientes inativos identificados como tal.
4. O usuario abre o cliente desejado.
5. O sistema mostra os dados basicos e o historico de agendamentos, com data, servico, profissional, status (Concluido, Cancelado, Nao compareceu, etc.) e valor.
6. A partir do detalhe, o usuario pode iniciar um novo agendamento, editar o cliente ou consultar atendimentos passados.

### Pos-condicao / Estados resultantes

- Usuario localiza o cliente e visualiza seu historico completo (leitura).
- Nenhum dado e alterado neste fluxo, salvo se o usuario seguir para criar/editar (Fluxos 3 ou 8).

### Entidades e regras envolvidas

- Entidades: Cliente, Agendamento, Servico, Profissional.
- Regra: agendamentos cancelados e no-shows permanecem no historico; cliente inativo aparece no historico, mas nao e primeira opcao em novos agendamentos (ver `docs/product/05-regras-negocio.md`).

---

## Pendencias

- Definir formato e nivel de detalhe do rastro de historico para remarcacao e edicao de ocorrencias recorrentes (auditoria mockada).
- Definir o fluxo de interface para resolucao manual de ocorrencias recorrentes sinalizadas como conflito.
- Confirmar as transicoes de status permitidas (maquina de estados) e quais sao reversiveis no MVP (ex.: reverter um cancelamento).
- Definir o comportamento ao inativar um profissional ou servico que possui agendamentos futuros.
