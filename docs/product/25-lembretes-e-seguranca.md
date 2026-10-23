# 25. Lembretes inteligentes e aviso de segurança

Data: 2026-10-23. Status: decidido; implementação em fases (seção 6).

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
| Relacionamento | Aluno novo sem boas-vindas (até 7 dias) | `welcome_student` |
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

Uma janela curta explicando por que proteger a conta, com "Ativar agora" (vai direto ao passo do QR code em Segurança) e "Agora não".

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
