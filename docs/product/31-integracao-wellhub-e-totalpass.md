# Integração com Wellhub, TotalPass e similares (levantamento)

Data: 13/11/2026 · Status: Proposta, adiada (levantamento guardado para depois, decisão do dono em 13/11/2026; nada feito) · Código: nenhum ainda; base que seria usada: `services/classes` (turmas, aulas, reservas, chamada), `services/clients`, `services/finance`, `app/api/webhooks` (padrão do Asaas e do WhatsApp), `webhook_events` e `job_runs` (doc technical/23) · Testes: nenhum

## Decisão

Adiado pelo dono em 13/11/2026: o levantamento fica guardado para quando a integração voltar à pauta (nenhuma fase começa sem pedido). Este doc junta o que as plataformas exigem de um sistema de gestão integrado, o que muda no GestaraHub, um caminho em fases e as perguntas que dependem do dono (fim do doc).

## Contexto

- **Quem são:** Wellhub (antigo Gympass) e TotalPass (grupo Smart Fit) vendem um plano de academia para empresas; o funcionário usa vários espaços e o espaço recebe um repasse por check-in validado, com teto mensal por aluno. ClassPass, Urban Sports Club e EGYM fazem o mesmo fora do Brasil (fora deste levantamento).
- **Por que importa:** os concorrentes generalistas já integram (a TotalPass cita Evo, Pacto, Next Fit, Tecnofit, Cloud Gym, Gym Brasil e Data Fitness; o Wellhub cita a Evo). Para quem já é parceiro das plataformas, "o sistema integra?" pesa na escolha.
- **O outro lado (doc 18 §1 e §4.3):** na academia de luta, os agregadores viraram dor (repasse de R$ 8 a R$ 25 por check-in, mudado sem consulta) e há academias saindo. A proposta do doc 18 é o contrário: dar à academia um canal próprio para depender menos deles. Integrar não contradiz isso (quem já recebe aluno de plataforma ganha controle), mas a prioridade é decisão de produto.
- **Hoje, sem integração:** o espaço aceita o aluno da plataforma e valida o check-in no portal dela (Wellhub e TotalPass têm validação manual). No GestaraHub esse aluno não tem lugar: ou vira aluno com plano (e gera mensalidade indevida), ou não entra na chamada.

## O que as plataformas exigem

### Wellhub

- **Dois tipos de integração** para o espaço: manual (valida no Portal do Parceiro) ou pelo sistema de gestão (CMS) por API, com a agenda de aulas sincronizada e o check-in validado na hora.
- **Validação de check-in (Access Control API):** o aluno faz check-in no app do Wellhub (com localização) e o sistema confirma com `POST /access/v1/validate` em `api.partners.gympass.com` (teste em `apitesting.partners.gympass.com`), com o token do integrador e o cabeçalho `X-Gym-Id` (o id da unidade no Wellhub). O aluno é identificado pelo Wellhub ID (antes "unique token", 13 dígitos). O integrador implementa dois métodos de validação, um deles automático: receber o aviso (webhook) de check-in e validar na hora.
- **Prazo:** o check-in precisa ser validado em até 20 minutos para ser pago; depois disso o aluno perde o acesso do dia. Na maioria dos planos, um check-in por dia. Na primeira visita, o sistema cadastra o aluno (alguns pedem o Wellhub ID); nas seguintes, a validação é automática.
- **Aulas com reserva (Booking API):** o sistema publica a agenda de aulas no app; cada reserva chega como pedido e precisa de resposta (aceita ou recusada) em até 15 minutos, ou é recusada sozinha. O botão de check-in abre 30 min antes da aula e fecha 30 min depois do fim; o sistema confirma reserva e presença, e a aula marcada como concluída gera o repasse. Aulas de no mínimo 30 minutos, vagas e descrição corretas, e cancelamento só pelo sistema (não por e-mail).
- **Configuração (Integration Setup API):** host próprio (`api.partners-integrations.gympass.com`), para o sistema gerenciar os webhooks do parceiro quando a academia escolhe o sistema no portal.
- **Credenciais:** o token vem do time comercial técnico do Wellhub (um token para Access Control e Booking). Não há cadastro aberto de integrador: o sistema precisa entrar na lista de compatíveis. A academia pede a integração no Portal do Parceiro (Integrações, escolhe a unidade e o sistema); se o sistema não está na lista, ela pede uma avaliação, e o Wellhub analisa caso a caso, com requisitos técnicos e operacionais.
- **Exemplo de quem já faz (bsport, Europa):** a academia informa o ID da unidade no sistema; aulas criadas, mudadas e canceladas aparecem no app na hora; reserva do Wellhub vira um passe "Wellhub" sem crédito; na primeira reserva o sistema cria o aluno com nome, sobrenome, e-mail e telefone; check-in sem reserva ou depois do início da aula não vale.

### TotalPass

- **Chave por unidade:** o dono da conta na TotalPass gera a chave (36 caracteres) em Integrações, escolhendo a unidade e o sistema parceiro; o sistema guarda a chave daquela unidade. Só o titular da conta vê a página de Integrações.
- **O que a integração faz (pelo exemplo da Fitune):** cada aula pode ser listada na TotalPass com vagas próprias e o plano exigido; as reservas do app entram na agenda do sistema; mudar as vagas no sistema muda lá; o check-in no app é validado sozinho pelo sistema.
- **Check-in:** pelo app ou QR Code, vale 30 minutos; sem integração, a academia valida no portal ("Check-ins").
- **Documentação técnica:** existe um portal de desenvolvedores (`dev.totalpass.com`, com um endpoint "Validate Token, Gym and Beneficiary"), mas não está aberto; o acesso e a entrada na lista de sistemas parceiros dependem de contato com a TotalPass.

### O que vale para as duas

- **Parceria antes do código:** sem entrar na lista de sistemas de cada plataforma, a academia não consegue escolher o GestaraHub no portal dela. O primeiro passo é comercial, não técnico.
- **Uma academia piloto** que já seja parceira das plataformas, para testar em produção (o sandbox do Wellhub cobre a API, não o fluxo do portal).
- **Dados pessoais:** o sistema recebe nome, e-mail, telefone e o ID do aluno na plataforma. O GestaraHub trata como operador do espaço, igual aos demais alunos; Termos e Privacidade precisam citar as plataformas parceiras (vai para a linha Jurídico das pendências se entrar).

## O que muda no GestaraHub

| Parte | Hoje | O que precisa |
| --- | --- | --- |
| Aluno da plataforma | Não existe | Marca no aluno: vem do Wellhub ou da TotalPass, com o ID dele lá. Não gera mensalidade; entra na chamada; aparece com selo, como o "Visitante" dos eventos. Primeira visita: ligar ao cadastro existente (mesmo telefone e nome, a regra do link público do evento) ou criar. |
| Check-in | Só a chamada da turma (e o QR do evento) | Registro do check-in da plataforma (recebido, validado, expirado, recusado), com a hora e a aula. Validar marca presença na chamada. Validação automática pelo aviso da plataforma e um botão "Validar" na aula ou numa lista de check-ins pendentes (o segundo método, para os 20 minutos). |
| Agenda e reservas | Turmas com horários; reservas de avulso e experimental | Publicar as aulas da turma na plataforma (com "vagas para plataformas" por turma), receber a reserva como reserva de um tipo novo, responder em 15 minutos pela lotação, cancelar quando a aula ou o dia é cancelado, e marcar a aula como concluída. |
| Conexão | `lib/asaas`, `lib/whatsapp`; webhooks em `app/api/webhooks` | `lib/wellhub` e `lib/totalpass` no mesmo padrão; `app/api/webhooks/wellhub` e `/totalpass` com conferência de origem, sem repetir aviso (`webhook_events`) e nova tentativa por rotina (`job_runs`). Credenciais: o token do GestaraHub no Wellhub (do servidor, como o `ASAAS_API_KEY`) e, por unidade, o ID do Wellhub e a chave da TotalPass (só no servidor, como `gateway_api_key`). |
| Configurações | Abas Geral, Horários, Cobrança, Certificado, Plano | Uma área "Plataformas" (ou na aba Geral): conectar Wellhub (ID da unidade), conectar TotalPass (colar a chave), situação da conexão e desligar. |
| Dinheiro | Mensalidade, pacote, curso, avulso, evento | O repasse cai na conta do espaço, fora do GestaraHub. Precisa de um relatório "Check-ins por plataforma" no mês (para conferir o repasse) e de uma categoria de entrada no Financeiro para lançar o repasse recebido. Sem cobrança ao aluno. |
| Plano GestaraHub | Grátis, Profissional, Expansão | Decidir se a integração é Grátis ou Profissional (doc 13). |

## Caminho em fases

| Fase | O que entrega | Depende de | Tamanho (só desenvolvimento) |
| --- | --- | --- | --- |
| 0. Aluno de plataforma, sem integração | Selo "Wellhub" ou "TotalPass" no aluno, sem mensalidade; presença na chamada; relatório de check-ins por plataforma no mês e categoria "Repasse de plataformas" no Financeiro. O espaço continua validando no portal da plataforma. | Nada externo | 2 a 3 dias |
| 1. Wellhub: validação de check-in | Aviso de check-in chega, liga ao aluno (ou cria na primeira visita), valida na hora e marca presença; lista de pendentes com "Validar" dentro dos 20 minutos; conexão em Configurações. | Entrar na lista de sistemas do Wellhub, token de teste e uma academia piloto | 1 a 2 semanas |
| 2. Wellhub: aulas com reserva | Aulas publicadas no app com vagas para plataformas; reserva aceita ou recusada pela lotação; cancelamentos e aula concluída. | Fase 1 e o Booking liberado no token | 2 semanas |
| 3. TotalPass (check-in e aulas) | O mesmo da 1 e da 2, com a chave por unidade. | Entrar na lista de parceiros da TotalPass e acesso à documentação | 2 a 3 semanas |

O tempo das plataformas (avaliação, contrato, credenciais) não está nas estimativas e costuma ser o maior.

## Alternativas

- **Só a fase 0 por enquanto:** resolve o furo de hoje (aluno de plataforma sem lugar no sistema) e mostra quanto vem das plataformas, sem depender delas. Recomendado como primeiro passo.
- **Integrar só o Wellhub:** é a maior plataforma e tem documentação aberta; a TotalPass vem depois.
- **Não integrar e investir no canal próprio (doc 18 §4.3):** coerente com a dor das academias de luta, mas deixa de fora quem depende das plataformas.

## Perguntas para o dono

1. A fase 0 entra já, sem esperar as plataformas?
2. Abrimos conversa com o Wellhub e a TotalPass como sistema de gestão? (contato comercial e técnico de cada uma; quem fala por você)
3. O professor de jiu-jitsu que testa o sistema (ou outra academia) recebe aluno de plataforma e topa ser piloto?
4. A integração fica no Grátis ou no Profissional?

## Fontes

- Wellhub, tipos de integração: https://digital.gympass.com/partnerbase/uk/types-of-integration
- Wellhub, como funcionam os check-ins: https://digital.gympass.com/partnerbase/uk/how-check-ins-work
- Wellhub, checklist de integração: https://digital.gympass.com/partnerbase/uk/integration-checklist
- Wellhub, sistemas compatíveis e pedido de avaliação: https://digital.gympass.com/partnerbase/uk/cms-compatible-with-wellhub
- Wellhub, APIs (Access Control, Booking, Integration Setup): https://developers.gympass.com/product/access-control-api/1.0/getting-started, https://developers.gympass.com/product/booking-api/1.0/getting-started, https://developers.gympass.com/product/integration-setup-api/1.0/getting-started
- Wellhub, guia de integração para parceiros (pt-BR): https://wellhub.com/pt-br/partner-academy/guia-integracao-cms/
- bsport, integração com o Wellhub: https://intercom.help/bsport-helpcenter/pt/articles/9943521-integracao-com-o-wellhub
- TotalPass, página de parceiros (sistemas integrados): https://totalpass.com/br/academias-estudios/
- Fitune, integração com a TotalPass: https://help.fitune.io/en/articles/10748288-integrate-totalpass-with-fitune
- TotalPass, check-in e recepção automatizada: https://totalpass.com/br/blog/para-academias/receprecepcao-automatizada/
