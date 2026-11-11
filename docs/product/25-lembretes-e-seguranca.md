# 25. Lembretes inteligentes e aviso de segurança

Data: 2026-10-23. Status: fases 1 a 5 feitas (seção 8); o resumo por e-mail fica para depois (seção 7); níveis, urgência e 7 lembretes novos decididos em 09/11/2026 (última seção), a implementar.

## 1. Problema

- **Lembretes:** quem não assina o Pro envia as mensagens à mão (WhatsApp assistido). Hoje o painel tem o bloco "Para fazer hoje" com atraso, pacote acabando, três faltas seguidas, aniversário do dia e troca de nível pela idade. Mas não avisa o que vai vencer, não lembra boas-vindas nem o agradecimento pelo pagamento, cobra de novo quem já recebeu o lembrete, não deixa adiar e obriga a abrir o WhatsApp aluno por aluno. Cada aviso é calculado num lugar diferente.
- **Segurança:** a verificação em duas etapas existe (doc technical/17), mas fica escondida em "Segurança", no menu do usuário. Quase ninguém liga sozinho.

## 2. Decisões do usuário (23/10/2026)

1. O aviso de segurança aparece nos **quatro momentos** da seção 5.
2. **Sino no topo** do app, com as pendências.
3. **Resumo da manhã por e-mail:** depois (registrado na seção 7).
4. **Lembretes de relacionamento** (boas-vindas, avanço de nível, agradecimento pelo pagamento) **entram** junto.

## 3. O motor de lembretes

**Um motor só.** As regras que hoje sugerem a mensagem na ficha do aluno (`features/communication/message-suggestions.ts`) passam a valer para todos os alunos, e o mesmo resultado aparece no painel, no sino, na fila de envio e, no Pro, no envio automático. Uma leitura no servidor traz os dados; a regra é pura e testada.

**Cada modelo de mensagem é uma regra de lembrete** (os prazos vêm do próprio modelo, em Comunicação):

| Grupo | Lembrete | Modelo |
| --- | --- | --- |
| Cobrança | Mensalidade vence em até 3 dias · vence hoje · em atraso · atraso crítico (10+ dias) | `billing_before_due`, `billing_due_date`, `billing_after_due`, `billing_critical` |
| Cobrança | Avulsa, parcela de curso ou compra de pacote a vencer ou em atraso | `charge_reminder` |
| Pacote | Última aula, aulas acabaram ou pacote vencendo | `package_ending` |
| Relacionamento | Aniversário (no dia e na semana) | `birthday_greeting` |
| Relacionamento | Três faltas seguidas | `absence_alert` |
| Relacionamento | Aluno que fez aula experimental e não voltou há 7 dias ou mais (`TRIAL_FOLLOW_UP_DAYS`, doc 11): "Chamar de volta"; o lembrete some quando ele vira aluno (matrícula, plano ou pacote) ou depois da mensagem enviada após a última experimental (09/11/2026) | `trial_follow_up` |
| Aviso | Inscrito em evento que acontece amanhã (09/11/2026) | `event_reminder` |
| Relacionamento | Visitante de evento sem matrícula, plano ou pacote, 7 dias depois do evento (09/11/2026) | `trial_follow_up` (texto citando o evento) |
| Relacionamento | Aluno de curso que termina em 15 dias sem outro vínculo (09/11/2026) | avulsa com texto pronto |
| Relacionamento | Aluno novo sem boas-vindas (até 7 dias). Com o WhatsApp oficial conectado e o modelo ligado, as boas-vindas saem sozinhas no cadastro (01/11/2026); o lembrete cobre o assistido e o envio que falhou | `welcome_student` |
| Relacionamento | Avançou de nível (até 14 dias) | `level_up` |
| Relacionamento | Pagamento recebido (agradecer, até 7 dias) | `payment_received` |
| Turma | Troca de nível pela idade (graduar) | sem mensagem; abre a graduação |
| Avisos | Depois de cancelar uma aula ou mudar horário: "Avisar os alunos?" | `class_canceled`, `schedule_change`, `holiday_notice` |

**O que faz ser inteligente:**
1. **Não repete o que já foi feito.** Mensagem daquele tipo já aberta no WhatsApp (ou enviada no Pro) para aquele aluno e aquela cobrança tira o lembrete. Atraso sem pagamento volta a lembrar depois de 7 dias.
2. **Prioridade:** dinheiro e prazo primeiro (atraso crítico, atraso, vence hoje, vence logo), depois risco de perder o aluno (faltas, pacote acabando), depois relacionamento. No mesmo grupo, o maior valor e o mais antigo antes.
3. **Agrupado:** "8 mensalidades vencem até sexta" vira uma linha com a lista, não oito linhas.
4. **Envio em sequência:** "Enviar em sequência" abre o WhatsApp do primeiro com o texto pronto; ao voltar para a aba, oferece o próximo ("2 de 8"), com "Pular". O WhatsApp gratuito não envia em massa: isso tira o trabalho repetitivo de quem não tem o Pro.
5. **Adiar e ignorar,** por lembrete: "Lembrar amanhã" e "Não lembrar deste aluno" (por exemplo, quem combinou pagar depois). Fica nas preferências de cada usuário.
6. **Mostra o efeito:** "Nesta semana, os lembretes ajudaram a receber R$ 1.250" (pago depois de um lembrete de cobrança; o cálculo já existe nas métricas de Comunicação).
7. **Mesmo motor no Pro:** com o WhatsApp oficial e o modelo em "enviar sozinho", o lembrete sai automático e aparece como "enviado automaticamente". O valor do Pro fica visível sem propaganda.

**Quem vê:** quem pode mandar mensagem (`communication:view`). O professor vê só os alunos das turmas dele (faltas, aniversário, boas-vindas, avanço); cobrança só para quem vê cobranças.

## 4. Onde aparece

- **Painel:** o bloco "Para fazer hoje" vira "Lembretes", agrupado em Cobrança, Relacionamento e Turma, com o que é mais importante primeiro.
- **Sino no topo:** número de pendências; abre a mesma lista num painel lateral. Some quando não há nada.
- **No contexto:** na ficha do aluno (já sugere hoje), na linha da cobrança e logo depois de cancelar uma aula ou mudar horário.

## 5. Aviso de segurança (verificação em duas etapas)

Uma janela curta explicando por que proteger a conta, com "Ativar agora" (abre Segurança na escolha entre aplicativo e código por e-mail, doc technical/17) e "Agora não".

**Momentos (os quatro):**

| Momento | Texto central |
| --- | --- |
| Ao ativar o pagamento online | "Sua conta agora recebe pagamentos. Proteja o acesso." |
| Ao convidar a primeira pessoa da equipe | "Mais pessoas acessam os dados dos alunos. Proteja sua conta." |
| Logo depois de criar uma nova senha (recuperação) | "Senha nova criada. Que tal uma proteção a mais?" |
| No login, depois de 7 dias de uso, se nenhum dos anteriores aconteceu | "Proteja sua conta com a verificação em duas etapas." |

**Regras:**
- Só dono e gerente; nunca conta só do Google (o Google já protege); nunca durante a configuração inicial; nunca para quem já ligou.
- "Agora não" volta a perguntar em 30 dias, no máximo três vezes. Depois, só um selo discreto em "Segurança" no menu.
- Uma janela por vez: se dois momentos coincidirem, aparece uma só.
- Texto sem jargão: "verificação em duas etapas", nunca "2FA" ou "TOTP".

## 6. Fases

1. **Motor de lembretes** (cobrança, pacote, faltas, aniversário, troca de nível) e o bloco "Lembretes" no painel no lugar do "Para fazer hoje".
2. **Envio em sequência.**
3. **Aviso de segurança** nos quatro momentos.
4. **Lembretes de relacionamento** (boas-vindas, avanço, pagamento recebido) e **avisos à turma** depois de cancelar aula ou mudar horário.
5. **Sino no topo.**

## 7. Depois (registrado)

- **Resumo da manhã por e-mail** para o dono, opcional: "Hoje: 5 cobranças vencem e 2 aniversários", com o link para os lembretes. Usa o MailerSend e o mesmo motor. Decisão do usuário (23/10/2026): entra depois.
- **Envio automático no Pro pelo mesmo motor**, quando a API oficial do WhatsApp estiver ligada de verdade (hoje só o parabéns roda na rotina).
- **Exigir a verificação em duas etapas** para ações sensíveis (trocar a conta de recebimento): doc technical/17.
- **Cancelar aula e feriados** (decisão do usuário, 23/10/2026: fazer mais à frente). Hoje o app não tem essas ações: o status "cancelada" existe no contrato da aula (`ClassSessionStatus`), mas nada marca uma aula assim, e a unidade só tem horário por dia da semana, sem datas fechadas. Os modelos "Aula cancelada" e "Feriado" já existem para envio manual. Quando as ações existirem, viram lembretes: depois de cancelar, "Avisar os 12 alunos?"; dias antes do feriado, "Feriado na segunda: avisar as turmas?". Decisões a tomar antes de construir:
  - **Cancelar aula** (uma data de uma turma, motivo opcional): a cobrança da aula avulsa ou da reserva cancela sozinha ou fica para decidir caso a caso? A aula cancelada não gasta aula do pacote (confirmar). Sai do pagamento do professor? Na chamada, some ou aparece riscada como "Cancelada"?
  - **Feriados:** a data fecha o espaço todo ou dá para escolher turmas? As datas são cadastradas à mão ou o sistema sugere os feriados nacionais do ano para confirmar? O feriado cancela as aulas do dia com as mesmas regras de "cancelar aula" (recomendado)?

## 8. Como ficou (23/10/2026)

**Não há tabela de notificações.** Os lembretes são calculados na hora, a partir da situação atual do espaço (cobranças em aberto, pacotes, presenças, aniversários, mensagens já enviadas), e descartados. Não acumulam: o que deixa de valer (pagou, foi avisado, passou a semana do aniversário) some sozinho. Só ficam gravados o "Lembrar amanhã" e o "Não lembrar", nas preferências de cada usuário (`reminderSnoozes`, limpos quando vencem).

**Código:**
- Dados numa leitura só, com recorte e respeitando o perfil: `communication.getReminderSources` (`services/communication/remindersService.ts`). Sem permissão de cobrança, sem cobranças e pacotes; o professor só vê os alunos das turmas dele.
- Motor puro: `features/communication/reminders.ts` (`buildReminders`), com as regras de prazo e texto que a ficha do aluno já usava (`message-suggestions.ts`, `message-values.ts`).
- Painel: `features/dashboard/components/dashboard-todo.tsx` (bloco "Lembretes"); sino: `reminders-bell.tsx`, no topo do app; envio em sequência: `features/communication/components/reminder-sequence-dialog.tsx`.
- Mudança de horário: `features/turmas/schedule-notice.ts` e `schedule-notice-host.tsx` (depois de salvar a turma com horário novo).
- Aviso de segurança: `features/auth/security-prompt.ts` e `components/security-prompt-host.tsx`; "Ativar agora" abre a janela de Segurança na escolha dos dois métodos (aplicativo ou e-mail). Não aparece no espaço de demonstração.

**Detalhes que importam:**
- **Grupo grande:** cada grupo mostra no máximo 20 alunos na tela, com "e mais N" e o link para a tela completa (Cobranças, que pagina). O título e o total contam todos.
- **Feito no dia:** avisar o único aluno de um grupo não some com o grupo na hora; ele fica no dia, marcado ("Avisado hoje"), sem contar como pendência. O item não muda de posição ao ser avisado.
- **Atualização:** qualquer gravação no app relê os lembretes (pagar, vender pacote, marcar presença, mandar mensagem).
- **Aviso de segurança:** só decide depois de chegarem as preferências do servidor (`remoteLoaded`); antes, o primeiro acesso parecia sempre o primeiro dia. O convite só pede o aviso no primeiro membro da equipe.
- **Avisos à turma:** "aula cancelada" e "feriado" ainda não têm ação no app; registrados na seção 7 com as decisões pendentes. Hoje o aviso vale para a mudança de horário.

**Testes:** `features/communication/__tests__/reminders.test.ts` (regras), `services/__tests__/reminders.test.ts` (leitura por perfil, com a conferência do recorte), `features/auth/__tests__/security-prompt.test.ts`; e2e em `painel-hoje` (bloco e sino), `dinheiro-pacotes` (envio em sequência), `turmas-geral` (aviso de horário) e `seguranca-aviso` (área `acesso`).

## Mensagem para vários alunos (24/10/2026)

"Nova mensagem" aceita vários alunos ("Selecionar todos com WhatsApp"). O texto vale para todos (`{aluno}` e `{empresa}` são trocados por aluno) e o envio segue pela janela "Enviar em sequência" (um toque por aluno). O calendário de turmas segue só com Grade e Lista.

## Avisos do espaço no sino (30/10/2026)

A pedido do usuário, o selo do plano saiu do topo e os avisos do espaço foram para o sino, acima dos lembretes dos alunos. Só dono e gerente veem, os mesmos que recebem o e-mail do plano.

- **Plano:** "Seu plano renova em 13/11" (Pix), "Pagamento do plano pendente" e "A assinatura do plano foi encerrada", com os textos do e-mail (`lib/plan-notice-copy.ts`). Levam a Configurações → Plano, onde fica o Pix; a encerrada leva aos Planos. Com o plano para cair ou já no Grátis, o aviso fica fixo no topo e sai do sino (doc 13 §6).
- **Mensagens automáticas:** restando 20% ou menos da franquia do ciclo, "Restam 50 mensagens automáticas no ciclo"; ao acabar, "As mensagens automáticas do ciclo acabaram". Só com o envio automático ligado e saindo de verdade. Leva a Comunicação → Conexão (`/communication?tab=connection`).
- Somem quando resolvidos; não têm "Lembrar amanhã" nem "Não lembrar deste". Contam no número do sino, não no bloco Lembretes do painel.
- Código: `features/dashboard/bell-alerts.ts` (`planBellAlert`, `quotaBellAlert`), no sino (`reminders-bell.tsx`). Testes: `features/dashboard/__tests__/bell-alerts.test.ts`; e2e em `plano-gestarahub` (aviso no sino e aviso fixo com 2 dias).

## Níveis, urgência e novos lembretes (decidido em 09/11/2026)

Revisão das notificações com o usuário. Até aqui os três tons do sino (info, âmbar, vermelho) eram só cor; passam a ter comportamento. O bloco Lembretes ganha uma segunda família, "Resolver no sistema" (tarefas internas, sem WhatsApp), ao lado da atual "Falar com alguém".

### Níveis

| Nível | O que entra | Comportamento |
| --- | --- | --- |
| **Informativo** (`info`, azul) | aniversário, boas-vindas, avanço de nível, pagamento para agradecer, cobrança a vencer, franquia em 20%, "Ative o WhatsApp oficial", evento amanhã (aviso ao inscrito), chamada de ontem em aberto | só conta no número do sino |
| **Atenção** (`warning`, âmbar) | cobrança em atraso, cobrança vence hoje, pacote acabando, 3 faltas seguidas, experimental ou visitante sem voltar, documento vencendo, curso terminando, plano do aluno vencendo, presentes sem certificado, plano do espaço pendente, franquia esgotada | conta no sino e o sino **pulsa** |
| **Urgente** (`danger`, vermelho) | plano do espaço a 2 dias de cair ou já no Grátis, assinatura encerrando, pagamento online desligado ou com falha do parceiro, estorno ou contestação, documento de saúde vencido de aluno ativo | conta no sino, pulsa, **aviso fixo no topo** até resolver e, nos casos que afetam o funcionamento do espaço, uma **modal** uma vez por item |

- O nível é de cada item; o grupo do Painel herda o maior nível dos itens pendentes.
- Lembrete de aluno (mesmo atraso crítico) nunca passa de Atenção: é rotina, e o bloco Lembretes já resolve.

### Pulsar do sino

- O sino pulsa três vezes ao abrir o app quando há item de Atenção ou Urgente **novo desde a última vez que o sino foi aberto**, e de novo quando uma pendência dessas chega durante a sessão.
- Item já visto não pulsa; nada de intervalo fixo (vira ruído em uma semana).
- "Visto" = abriu o painel do sino; guardado por usuário nas preferências (`bellSeenAt`), como os adiamentos.
- Respeita a preferência de movimento reduzido do sistema e o som de Aparência (sem som novo; só o pulsar).

### Modal de urgência

- Só para o que afeta ou já está afetando o funcionamento do espaço: plano a 2 dias de cair, plano que voltou ao Grátis, pagamento online desligado ou recusado pelo parceiro, estorno ou contestação de uma cobrança paga.
- Uma vez por item e por usuário ("Ciente" e "Resolver agora"), só para dono e gerente, nunca no primeiro desenho depois do login do professor. O item continua no aviso fixo até resolver.
- Nenhuma modal para lembrete de aluno, documento, evento ou chamada.

### Lembretes novos (ordem de implementação)

| # | Lembrete | Família | Nível | Fonte | Texto do grupo e do item | Ação |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Evento amanhã** | Falar com alguém | info | `eventSessions` de amanhã (não canceladas) e inscrições confirmadas que cobrem o dia; feito quando saiu `event_reminder` para o aluno depois do dia anterior ao evento | "N inscritos para avisar do evento de amanhã" · "Seminário X · sáb 15/11, 09:00 às 12:00" | modelo de WhatsApp novo `event_reminder` (manual no Grátis, automático no Pro): "Oi, {aluno}! Amanhã tem {evento} na {empresa}, {dia} às {horario}. Te esperamos!" |
| 2 | **Chamada de ontem em aberto** | Resolver no sistema | info | aulas de turma de ontem (e dias de evento de ontem) sem nenhuma marcação; o professor só as dele | "N chamadas de ontem em aberto" · "Jiu-Jitsu adulto · seg 09/11, 19:00" | abre a aula ("Fazer chamada") |
| 3 | **Visitante para virar aluno** | Falar com alguém | warning | aluno sem matrícula, plano ou pacote, com inscrição confirmada em evento já terminado há 7 dias ou mais (`TRIAL_FOLLOW_UP_DAYS`); some quando vira aluno ou depois da mensagem | "N visitantes para oferecer turma" · "Seminário X · há 9 dias" | modelo `trial_follow_up` reaproveitado, com texto próprio quando o espaço não editou ("Foi muito bom ter você no {evento}...") |
| 4 | **Presentes sem certificado** (Pro) | Resolver no sistema | warning | evento terminado com inscritos presentes sem `IssuedCertificate` | "N presentes sem certificado" · "Seminário X · 3 de 5 presentes" | abre os certificados do evento (lote) |
| 5 | **Curso terminando** | Falar com alguém | warning | turma `course` com fim nos próximos 15 dias e aluno ativo sem outra matrícula, plano ou pacote | "N alunos com curso terminando" · "Confeitaria · termina 30/11" | mensagem avulsa com texto sugerido "Seu curso {curso} termina em {fim}. Quer continuar em outra turma?" |
| 6 | **Plano do aluno vencendo** | Falar com alguém | warning | aluno com `planEndDate` nos próximos 7 dias (plano com fim fixo, sem renovação automática); some ao renovar | "N planos vencendo" · "Plano anual · vence 15/11" | mensagem avulsa "Seu {plano} vence em {fim}. Vamos renovar?" |
| 7 | **Documento vencendo ou vencido** no Painel | Resolver no sistema | warning / danger (saúde vencido de aluno ativo) | o que já alimenta o sino (`useExpiringDocuments`) | "N documentos para renovar" · "Atestado de Ana Souza · vence em 12 dias" | abre a ficha na aba Documentos |

- 1, 3 e 4 dependem do módulo Eventos (doc 29) e fecham o que ficou pendente lá; 7 só muda onde aparece (o sino já tem).
- Cada item segue as regras do motor: não repete o que já foi feito, "Lembrar amanhã" e "Não lembrar deste", no máximo 20 por grupo com "e mais N".
- Permissões: cobrança e plano do aluno só com `billing:view`; chamada em aberto e documentos seguem o recorte do professor; certificados só com o recurso `certificates`.

### Como ficou a fase 1 (09/11/2026)

- **Nível nos lembretes:** `ReminderGroup.level` (`info`, `warning`, `danger`) pelo grupo (`GROUP_LEVEL` em `features/communication/reminders.ts`): atraso, vence hoje, pacote, faltas e experimental sem voltar são atenção; a vencer, aniversário, boas-vindas, avanço, pagamento para agradecer, mudança de horário e mensagem em lote são informação. Os avisos do espaço (`BellAlert.tone`) já tinham o nível; ganharam `pinned` (fixo no topo) e `modal`.
- **Pulsar do sino** (`features/dashboard/bell-pulse.ts` e `reminders-bell.tsx`): o sino pulsa 3 vezes (CSS `bell-pulse`, só sem movimento reduzido) quando há chave de atenção ou urgência nova desde a última abertura; abrir o sino guarda as chaves atuais em `preferences.bellSeenKeys` (até 300). Chega item novo na sessão, pulsa de novo. Item já visto ou só informativo não pulsa.
- **Estorno e contestação** (`online_payments.dispute_status` e `disputed_at`, migração 93): o webhook do parceiro grava o aviso no pagamento pago (`PAYMENT_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_CHARGEBACK_*`), registra na Auditoria ("avisou estorno no pagamento online de Ana (R$ 150,00); a cobrança continua paga até você decidir") e o app mostra no sino, fixo no topo e numa modal. A cobrança continua paga: o que fazer com ela segue decisão do dono (pendência "Estorno e contestação").
- **Pagamento online recusado pelo parceiro** (`gatewayStatus: "rejected"` com o recurso ligado): urgente, fixo e modal, levando a Recebimentos online.
- **Documento de saúde vencido de aluno ativo** (atestado, anamnese, exame): urgente e fixo no topo; os outros documentos seguem como atenção no sino.
- **Aviso fixo e modal** (`features/dashboard/components/urgent-notices.tsx`, montado no layout abaixo do aviso do plano): os urgentes `pinned` ficam no topo até resolver; a modal abre uma vez por item e por pessoa (`preferences.urgentSeenKeys`), só para dono e gerente, com "Ciente" e "Resolver agora". O plano a 2 dias de cair ou já no Grátis também abre a modal (o banner do plano continua o mesmo).
- **Testes:** `features/dashboard/__tests__/bell-alerts.test.ts` (estorno, parceiro, documento de saúde, pulsar) e `features/communication/__tests__/reminders.test.ts` (nível por grupo).

### Como ficou a fase 2 (09/11/2026)

- **Família "Resolver no sistema"** (`ReminderCategory` `task`): grupos sem WhatsApp, cada item com uma tela para abrir (`ReminderItem.href`); "Lembrar amanhã" e "Não lembrar deste" valem como nos outros. Sem "Enviar em sequência".
- **Chamada de ontem em aberto** (`roll_call`, informativo): aula de turma ativa com matriculados na data e dia de evento com inscritos, sem nenhuma marcação; o professor só as dele (titular ou substituto). Item "Jiu-Jitsu adulto · 21/09, 19:00 às 20:00 · 8 alunos", botão "Fazer chamada".
- **Documentos para renovar** (`documents`, atenção): a mesma leitura do sino (`expiringDocuments`, por pessoa e tipo só o de validade mais longa, respeitando quem vê alunos ou equipe). Item "Atestado médico de Ana · vence em 8 dias (30/09)", botão "Abrir" na aba Documentos da ficha (ou Equipe).
- **Presentes sem certificado** (`event_certificates`, atenção; só com o recurso `certificates` e `events:view`): evento terminado com inscritos presentes sem certificado emitido. Item "Seminário · 3 de 5 presentes sem certificado", botão "Emitir" (tela dos certificados do evento).
- **Fonte:** `ReminderSources.openRollCalls`, `documents` e `eventCertificates` (`services/communication/remindersService.ts`); o recorte carrega eventos, dias, inscrições, chamadas de evento, documentos e certificados emitidos.
- **Testes:** `features/communication/__tests__/reminders.test.ts` (grupos, textos, adiamento).

### Como ficou a fase 3 (09/11/2026)

- **Evento amanhã** (`event_tomorrow`, informativo, aviso): dias de evento de amanhã com os inscritos confirmados que os cobrem; um item por inscrito ("Seminário X · 23/09, 09:00 às 12:00"). Modelo de WhatsApp novo **"Evento amanhã"** (`event_reminder`, administrativo, só manual: "Oi, {aluno}! Amanhã tem {evento} na {empresa}, {dia} às {horario}. Te esperamos!", variáveis {aluno}, {evento}, {dia}, {horario}, {empresa}). Feito quando saiu a mensagem hoje. O envio automático no Pro não entrou: o modelo é manual como os avisos; fica para a rotina diária, se o espaço pedir.
- **Visitante para oferecer turma** (`visitor_follow_up`, atenção, relacionamento): aluno ativo sem matrícula, plano ou pacote, com inscrição confirmada em evento terminado há 7 dias ou mais (`VISITOR_FOLLOW_UP_DAYS`). Reusa o modelo "Chamar de volta" com o texto pronto citando o evento ("Foi muito bom ter você no Seminário X..."); feito quando saiu `trial_follow_up` depois do fim do evento.
- **Curso terminando** (`course_ending`, atenção, relacionamento): turma de curso ativa com fim nos próximos 15 dias e aluno matriculado sem outra turma em andamento, plano ou pacote; texto pronto "Seu curso X termina em dd/mm. Quer continuar com a gente em outra turma?" (mensagem avulsa; sem marca de "já avisado", porque a avulsa não tem gatilho próprio). O professor só as turmas dele.
- **Plano do aluno vencendo (item 6) não entrou:** o plano de mensalidade do GestaraHub é recorrente (mensal, quinzenal, semanal) e não tem data de fim; "plano com fim fixo" não existe no modelo. O equivalente que existe, "pacote acabando", já está nos lembretes. Se um dia houver plano com prazo (anual sem renovação, por exemplo), o lembrete entra junto com o campo.
- **Fonte:** `ReminderSources.eventsTomorrow`, `visitors` e `coursesEnding` (`remindersService`); o recorte já carregava eventos, dias e inscrições. `REMINDER_TRIGGERS` ganhou `event_reminder`.
- **Testes:** `features/communication/__tests__/reminders.test.ts` (os três grupos, feito, 7 dias do visitante) e `communication.test.ts` (16 modelos).

### Fases

1. **Níveis e sino** (**feita 09/11/2026**): nível em cada item e grupo, pulsar com `bellSeenAt`, aviso fixo para os urgentes que ainda não têm (documento de saúde vencido), modal de urgência para plano, pagamento online e estorno (com a leitura do webhook `PAYMENT_REFUNDED` e `PAYMENT_CHARGEBACK_*`, hoje só no registro de erros).
2. **Resolver no sistema** (**feita 09/11/2026**): chamada de ontem em aberto, documentos no Painel, presentes sem certificado.
3. **Falar com alguém** (**feita 09/11/2026**, sem o plano do aluno vencendo, que não tem base no modelo): evento amanhã (modelo `event_reminder`), visitante para virar aluno, curso terminando.
4. Docs 11, 13, 25 e 29 e os testes de regra (`reminders.test.ts`, `bell-alerts.test.ts`) a cada fase.

## Lista dos lembretes mais enxuta (10/11/2026)

- Na gaveta do sino, só o primeiro grupo abre sozinho; no Painel, todos começam fechados.
- Cada grupo mostra 5 itens e "Ver mais N"; acima de 20, "e mais N" e o link da tela completa, como antes.
- O resumo de nomes aparece só com o grupo fechado. Nas cobranças e nos pagamentos o resumo é o valor e fica sempre.
- Título, nomes e o número do sino contam só o que falta fazer ("1 aniversariante na semana" quando o outro já recebeu parabéns).
- O feito hoje fica no lugar, com a confirmação em verde (não pula de posição enquanto se envia em sequência). O feito em outro dia vai para o fim, apagado, sob "Já feitos".
- Boas-vindas: a data do cadastro virou subtítulo ("Cadastrados ontem", "Cadastrados há 3 dias") em vez de repetir em cada linha.
