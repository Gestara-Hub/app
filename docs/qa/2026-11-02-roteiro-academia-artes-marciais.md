# Roteiro de teste manual: academia de artes marciais (02/11/2026)

Teste de ponta a ponta do modelo de turmas, feito por você no navegador, em etapas curtas. Ao terminar cada etapa, avise "Etapa N feita" (e o que estranhou); o agente confere no banco local o que a etapa deveria ter gravado e responde item a item. Achados vão para uma seção "Achados" no fim deste arquivo, com número, gravidade e commit da correção, no formato de [2026-10-23-teste-geral.md](2026-10-23-teste-geral.md).

> **Versão em slides:** [2026-11-02-roteiro-academia-artes-marciais.html](2026-11-02-roteiro-academia-artes-marciais.html), um passo por tela, com "Feito", anotações e o botão "Copiar aviso" da conferência (tudo guardado no navegador). É gerada deste arquivo por `pnpm --filter @gestarahub/web qa:roteiro`: edite o .md e rode de novo. Abra com `open docs/qa/2026-11-02-roteiro-academia-artes-marciais.html`.
>
> Regras de negócio citadas: turmas [product/11](../product/11-modelo-3-turmas.md), cobrança [product/15](../product/15-regras-de-cobranca.md), lembretes [product/25](../product/25-lembretes-e-seguranca.md), certificados e notas [product/21](../product/21-ideias-certificados-e-notas.md), financeiro [technical/05](../technical/05-modulo-financeiro.md), pagamento online [technical/25](../technical/25-pagamento-online.md), WhatsApp [technical/07](../technical/07-integracao-whatsapp.md), perfis [product/06](../product/06-perfis-permissoes.md).

## Como usar

- **Uma etapa por vez, na ordem.** As etapas seguintes dependem dos dados das anteriores (alunos, turmas, aulas dadas).
- **Dados fictícios.** Nomes, CPFs e telefones inventados, menos o seu WhatsApp (final 4219), que recebe as mensagens. CPF precisa ter dígitos válidos (o Asaas e o cadastro conferem): use um gerador de CPF de teste.
- **Ambiente:** `pnpm dev` (sem HTTPS), túnel do Asaas na aba [túnel Asaas](#terminal/c2), Asaas sandbox, Meta com o número real (envios por modelo só depois de arrumar a forma de pagamento na Meta; texto livre dentro da janela de 24 h).
- **E-mail:** a conta do MailerSend só entrega para um destinatário. Links de confirmação, convite e nova senha saem no terminal do `pnpm dev` quando o e-mail não é entregue.
- **Não corrija no meio.** Anote e siga; a correção entra depois, com commit e teste, uma por achado.
- **Paginação.** Têm paginação: Alunos, Cobranças, Histórico de Comunicação e Lançamentos do Financeiro (barra com "por página" 10, 20 ou 50; o padrão fica salvo nas preferências), Recebimentos online (10 por página), Registros de aula do aluno (10 por vez) e Auditoria ("Carregar mais"). O roteiro garante mais de 10 itens em cada uma; em cada lista, teste com "por página: 10": primeira, anterior, próxima e última página, trocar o tamanho e conferir que filtro e busca voltam à página 1.

## O espaço de teste

**Recomendado: espaço novo**, criado pelo cadastro da landing, para passar pela configuração inicial e pelo plano. O Jessy continua como está (Asaas e WhatsApp já ativos) e serve de comparação. Se preferir usar o Jessy, pule a etapa 1 e inative os alunos atuais antes de começar.

| Item | Valor sugerido |
| --- | --- |
| Nome do espaço | Dojo Norte |
| Área | Lutas |
| Cidade / fuso | Manaus (America/Manaus) |
| Dono | você, com o seu e-mail; senha nova |
| Modalidades | Jiu-Jitsu, Jiu-Jitsu Kids, Muay Thai, Judô |
| Turmas | 5 (tabela na etapa 5) |
| Equipe | 6 professores (etapa 3) |
| Alunos | 22 (etapas 6 e 7) |

## Etapa 1: cadastro do espaço e configuração inicial

**Objetivo:** cadastro pela landing, termos, configuração inicial (3 telas), horários e regras de cobrança.

1. Na landing (`/`), cadastre com nome, e-mail e senha. Confirme o e-mail pelo link (terminal, se não chegar).
2. Configuração inicial: tela 1 "Dojo Norte" (Enter avança); tela 2 área **Lutas** (avança sozinha); tela 3 confirme como os alunos avançam (faixas) e marque as modalidades sugeridas. Conclua.
3. No Painel, feche as boas-vindas e siga a lista de primeiros passos: **Horários** (seg a sex 06:00 a 22:00, sáb 08:00 a 13:00; dom fechado), **Regras da mensalidade** (vencimento dia 10, 1ª cobrança proporcional), **Modalidades**, **Planos**, **Equipe** (as próximas etapas cobrem cada uma).
4. Configurações → Geral: telefone do espaço (seu 4219), endereço, fuso Manaus. Configurações → Segurança: ligue a verificação em duas etapas por e-mail e lembre este dispositivo.

**Você deve ver:** barra de primeiros passos no topo mudando conforme completa; tour do menu uma vez; "Atual" no mês do Financeiro; o fuso no rodapé de Configurações.

**No banco:** `organizations` (nome, área, fuso, regras de cobrança em `settings`), `units` (horários), `users` (dono), `legal_consents` (termos aceitos), `financial_categories` (17 categorias de sistema e padrão), `two_factor_*`, `audit_logs` (criação).

## Etapa 2: modalidades e trilhas

**Objetivo:** 4 modalidades com trilhas diferentes; avaliações ligadas em uma.

| Modalidade | Trilha | Critério para graduar | Idade por nível |
| --- | --- | --- | --- |
| Jiu-Jitsu | Branca, Azul, Roxa, Marrom, Preta; 4 graus por faixa | 40 presenças **e** 12 meses | não |
| Jiu-Jitsu Kids | Branca, Cinza, Amarela, Laranja, Verde (duas cores: ponta branca/preta) | 30 presenças | sim: até 15 anos |
| Muay Thai | Kruang (cordões): Branco, Amarelo, Laranja, Verde, Azul, Marrom, Preto | 6 meses | não |
| Judô | Branca, Cinza, Azul, Amarela, Laranja, Verde, Roxa, Marrom, Preta | 20 presenças | sim (kids até 12) |

1. Em Modalidades, edite as sugeridas e crie as que faltam. Arraste para reordenar níveis, escolha cores (uma faixa com 2 cores), defina graus, meta de presenças, tempo mínimo e idade por nível.
2. Em Judô, ligue **"Esta modalidade tem avaliações"** (escala 0 a 10, nota mínima 7, frequência mínima 75%).
3. Inative e reative uma modalidade; tente excluir uma com turma (depois da etapa 5) e veja a recusa.
4. Troque a visão lista/cartões (a dica aparece uma vez só aqui).

**Você deve ver:** selo de faixa colorido na lista; "Nível" chamado de "Faixa" nas lutas; a ordem salva.

**No banco:** `categories` (track com níveis, cores, graus, critérios, `assessments` no Judô), `audit_logs`.

## Etapa 3: equipe e usuários

**Objetivo:** 6 professores com cargos; 4 deles com acesso ao sistema em perfis diferentes.

| Professor | Cargo | Acesso | Observação |
| --- | --- | --- | --- |
| Carlos Mendes | Professor | Profissional | titular de Jiu-Jitsu adulto |
| Ana Souza | Professora | Profissional | titular de Jiu-Jitsu Kids |
| Rafael Lima | Instrutor | sem acesso | Muay Thai |
| Juliana Prado | Professora | Gerente | Judô; gerencia o espaço |
| Marcos Teixeira | Auxiliar | Atendente | recepção, chamada |
| Bruno Costa | Instrutor | sem acesso | substituto |

1. Equipe → Novo: nome, cargo (crie "Auxiliar" se não existir), telefone, e-mail. Em dois professores, defina a escala de horários; nos outros deixe vazio (vale em todo dia aberto).
2. Usuários → Convidar: Carlos, Ana, Juliana e Marcos com os perfis da tabela. Aceite dois convites agora pelo link (terminal) em janela anônima, defina a senha; deixe dois pendentes para reenviar e cancelar depois.
3. Tente inativar a si mesmo e rebaixar o último dono: deve recusar.
4. Lista de usuários: filtro "Ativos" por padrão, troca lista/cartões.

**Você deve ver:** convite com validade; usuário "Pendente" até aceitar; o professor com acesso vinculado ao cadastro da equipe (ficha do professor com "Acesso").

**No banco:** `professionals`, `roles`, `users` (profile por usuário, `professional_id`), `organization_invitations` (aceito, pendente), `audit_logs` (convites, eventos de usuário marcados como sensíveis).

## Etapa 4: planos e pacotes

**Objetivo:** planos de mensalidade com períodos diferentes e pacotes de aulas.

| Plano | Período | Valor | Modalidades |
| --- | --- | --- | --- |
| Mensal Jiu-Jitsu | mensal | R$ 180,00 | Jiu-Jitsu |
| Mensal Kids | mensal | R$ 150,00 | Jiu-Jitsu Kids, Judô |
| Mensal Livre | mensal | R$ 250,00 | todas |
| Quinzenal Muay Thai | quinzenal | R$ 100,00 | Muay Thai |

| Pacote | Aulas | Valor | Validade | Falta gasta? |
| --- | --- | --- | --- | --- |
| 10 aulas | 10 | R$ 350,00 | 60 dias | sim |
| Aula experimental paga 4x | 4 | R$ 120,00 | 30 dias (atalho) | não |

1. Planos → "+ Novo plano" e aba Pacotes → "+ Novo pacote" (o tour das abas aparece uma vez). Validade pelos atalhos e por valor digitado.
2. Edite um valor de plano e inative um plano sem aluno; tente inativar um com aluno (depois da etapa 6).

**No banco:** `plans` (período, valor em centavos, modalidades), `lesson_packages` (quantidade, validade em dias, regra de falta, turmas), `audit_logs`.

## Etapa 5: turmas

**Objetivo:** 5 turmas com formas de cobrança diferentes e uma lotada de propósito.

| Turma | Modalidade | Instrutor | Encontros | Vagas | Cobrança |
| --- | --- | --- | --- | --- | --- |
| Jiu-Jitsu Manhã | Jiu-Jitsu | Carlos | seg/qua/sex 07:00-08:00 | 12 | Mensalidade; aceita avulso R$ 40,00 |
| Jiu-Jitsu Noite | Jiu-Jitsu | Carlos | ter/qui 19:30-21:00 | 4 | Mensalidade (para lotar) |
| Kids Tarde | Jiu-Jitsu Kids | Ana | seg/qua 17:00-18:00 | 10 | Mensalidade |
| Muay Thai Pacote | Muay Thai | Rafael | ter/qui/sáb 18:00-19:00 | 15 | Pacote de aulas |
| Judô Curso de Férias | Judô | Juliana | seg a sex 09:00-10:00, começa segunda que vem, termina em 30 dias | 8 | Curso R$ 400,00 em até 4x |

1. Turmas → "+ Nova turma". Nas lutas o formulário sugere "Mensalidade"; mude nas duas últimas.
2. Tente marcar Carlos em outra turma no mesmo horário da Manhã: "já tem aula ... em".
3. Edite uma turma (capacidade, horário) e veja o reflexo no Calendário; inative e reative uma.

**Você deve ver:** cabeçalho de uma linha no detalhe ("Seg 07:00 · Carlos · Mensalidade · 0 de 12 vagas"), selos "Curso" e "Pacote" na lista, calendário com as aulas da semana.

**No banco:** `class_groups` (billing_mode, meetings, capacidade, plan_id ausente), sessões derivadas (não há tabela: as aulas nascem da grade; `class_session_overrides` só quando mexer numa aula).

## Etapa 6: alunos adultos (10)

**Objetivo:** cada forma de pagar, desconto, bolsa, pacote e aluno antigo; 14 adultos (10 com regra própria e 4 simples). Telefone 4219 só no primeiro (recebe WhatsApp).

| # | Aluno | Nasc. | Paga como | Detalhe |
| --- | --- | --- | --- | --- |
| 1 | Pedro Henrique Alves | 1995 | Mensal Jiu-Jitsu | seu WhatsApp 4219; início hoje |
| 2 | Mariana Castro | 1990 | Mensal Livre | desconto 10% com "Válido até" daqui a 2 meses |
| 3 | Lucas Ferreira | 1988 | Mensal Jiu-Jitsu | bolsa 50% (motivo "atleta") |
| 4 | Fernanda Rocha | 1992 | Bolsista integral | plano de referência Mensal Jiu-Jitsu |
| 5 | Thiago Martins | 1985 | Mensal Jiu-Jitsu | **início há 4 meses**: escolha "Cobrar desde o início" |
| 6 | Camila Nunes | 1998 | Pacote 10 aulas | venda à vista, 1º vencimento hoje |
| 7 | Diego Barbosa | 1993 | Pacote 4x | 2 parcelas |
| 8 | Larissa Moreira | 2000 | Não paga mensalidade | vai entrar só no curso de Judô |
| 9 | Gustavo Pires | 1979 | Quinzenal Muay Thai | entrada no meio do período, "Proporcional" |
| 10 | Beatriz Lopes | 1996 | Mensal Jiu-Jitsu | "Momento do pagamento": pós-pago |
| 19 | Rodrigo Azevedo | 1991 | Mensal Jiu-Jitsu | simples |
| 20 | Patrícia Lemos | 1987 | Mensal Livre | simples |
| 21 | André Vasconcelos | 1994 | Mensal Jiu-Jitsu | simples |
| 22 | Juliana Freitas | 1999 | Quinzenal Muay Thai | simples |

Os quatro últimos existem para a lista passar de 20 alunos (padrão da página) e as mensalidades do mês passarem de 20 cobranças.

1. Alunos → "+ Novo aluno". Preencha telefone, nascimento, e-mail em alguns, endereço em um, observações em um ("alergia a látex"). Anexe um arquivo em um cadastro.
2. No Pedro, ao salvar, as boas-vindas: no oficial saem sozinhas; no assistido, o botão "Enviar boas-vindas" no aviso.
3. Tente cadastrar o Pedro de novo com o mesmo telefone: aviso de duplicado.
4. Edite a Mariana e troque o plano: regra de troca (período em aberto é substituído).
5. **Paginação de Alunos:** com 22 alunos (depois da etapa 7), "por página: 10" dá 3 páginas; navegue, troque para 20 e 50, busque "Jiu" e veja a lista voltar à página 1; o filtro "Ativos" é o padrão.

**Você deve ver:** 1ª cobrança criada com o valor certo (proporcional, desconto, bolsa, "Isento"), Thiago com 4 mensalidades vencidas e a do mês; aviso de "Termo pendente" não aparece (adultos).

**No banco:** `clients` (plano, desconto, bolsa, status), `charges` (1ª cobrança de cada um: valor, competência, `scholarship_percent`, `status` paid/pending/waived), `student_packages` (Camila e Diego), `attachments`, `message_logs` (boas-vindas do Pedro), `audit_logs`.

## Etapa 7: alunos menores e responsáveis (8)

**Objetivo:** menores com responsável, responsável financeiro, termo de consentimento (LGPD) e cobrança no CPF do responsável.

| # | Aluno | Idade | Turma alvo | Responsável |
| --- | --- | --- | --- | --- |
| 11 | Enzo Gabriel Silva | 8 | Kids Tarde | mãe Patrícia (financeira, com CPF) |
| 12 | Valentina Souza | 10 | Kids Tarde | pai Roberto |
| 13 | Miguel Santos | 12 | Kids Tarde e Judô | avó Dona Helena (financeira) |
| 14 | Sophia Oliveira | 7 | Kids Tarde | mãe, sem e-mail |
| 15 | Arthur Costa | 14 | Jiu-Jitsu Manhã (adulto, por idade?) | pai |
| 16 | Helena Ribeiro | 9 | Kids Tarde | bolsa integral |
| 17 | Davi Lucca | 11 | Judô | mãe |
| 18 | Isabela Martins | 16 | Jiu-Jitsu Noite | pai (financeiro) |

1. Cadastre com a data de nascimento: o formulário sugere "Responsáveis", marque um como **financeiro** e informe o CPF dele.
2. Na lista, o selo **"Termo pendente"**. Abra a ficha → Cadastro: envie o termo (link público `/consent/...` abre no celular ou em janela anônima: dados só mascarados, "Ana S."), aceite como responsável; em outro, registre "termo impresso arquivado".
3. Em Arthur (14 anos), matricule depois numa turma de adulto e veja o aviso de idade (etapa 8).

**Você deve ver:** cobrança do menor com o nome do responsável financeiro no Cobrar online (CPF dele); selo some depois do aceite.

**No banco:** `clients.guardians` (responsáveis, `financial`), `legal_consents` (aceite do termo, por quem, quando, IP), `charges` dos menores.

## Etapa 8: matrículas, lista de espera e curso

**Objetivo:** matrícula em lote, turma lotada, conflito de horário, curso com parcelas, pacote na turma de pacote.

1. **Jiu-Jitsu Manhã:** "Matricular alunos" → Pedro, Mariana, Lucas, Fernanda, Thiago, Beatriz, Arthur (menor: aviso de idade), Rodrigo, Patrícia, André (11 na turma: a lista da turma ganha busca a partir de 9 alunos).
2. **Jiu-Jitsu Noite (4 vagas):** Pedro, Mariana, Lucas, Isabela. Depois tente Beatriz: "Turma lotada (0 vagas)" → **"Pôr na lista de espera"**. Depois Thiago: **"Matricular mesmo assim (5)"**. Cancele a matrícula do Lucas na Noite e promova a Beatriz da espera.
3. **Conflito:** tente matricular o Pedro numa turma no mesmo dia e horário de outra dele: "já possui aula ...".
4. **Kids Tarde:** Enzo, Valentina, Miguel, Sophia, Helena.
5. **Muay Thai Pacote:** Camila, Diego, Gustavo (sem pacote: a chamada vai avisar "Sem pacote").
6. **Judô Curso de Férias:** Larissa (à vista), Miguel (3x), Davi (4x, 1º vencimento daqui a 7 dias). Veja as parcelas em Cobranças. Cancele a matrícula do Davi: parcelas futuras canceladas, vencidas ficam.
7. Detalhe da turma: "Selecionar alunos" em lote; alertas só quando pedem atenção.

**No banco:** `enrollments` (ativas, canceladas, `class_group_id`), `waitlist` (waiting → promoted), `charges` kind `course` (`installment_group_id`, `cycle_index/total`, canceladas pelo sistema com motivo), `audit_logs` (matrícula, promoção).

## Etapa 9: calendário, chamada e aulas

**Objetivo:** uma semana de aulas dadas, com presença, falta, justificada, avulso, experimental, pacote, substituto, aula cancelada e registros.

1. Calendário: visão grade e lista; filtros por modalidade e instrutor; clique numa aula de hoje (crie turmas com aula hoje; se não houver, ajuste os encontros).
2. **Chamada da Manhã (hoje):** toque em quem veio (4), "Concluir chamada" → faltas nos demais; marque uma **justificada** pelo ⋮; desmarque uma presença e marque de novo. Tente a chamada numa aula futura: "A chamada abre em ...".
3. **Adicionar aluno nesta aula** (drawer): Gustavo como **avulso** (gera cobrança de R$ 40,00) e um aluno novo como **experimental** (cortesia). Remova um deles pelo ⋮.
4. **Muay Thai (próxima aula):** chamada com Camila (gasta 1 de 10), Diego (gasta 1 de 4), Gustavo (**"Sem pacote"**, âmbar). Falta sem justificativa da Camila na aula seguinte: gasta (regra do pacote); justificada do Diego: não gasta.
5. **Trocar instrutor** (drawer): Bruno substitui Carlos numa aula, motivo "viagem"; restaure o titular em outra.
6. **Cancelar uma aula** e **mudar o horário** de outra: aparece "Avisar os alunos?" (mensagem para a turma).
7. **Registrar a aula** (turma inteira) com uma anotação e um destaque; no Pedro, abra "Registros de aula", crie meta "Raspagem 0/30", avance +5, pontos fortes, "Para a próxima aula". Repita o registro da turma em 6 aulas da Manhã e faça 5 registros individuais do Pedro: a linha do tempo dele passa de 10 e mostra "Carregar mais".
8. Volte 5 dias no calendário e faça a chamada de aulas passadas para ter histórico (presença baixa em alguém: alerta "Presença baixa").

**No banco:** `attendances` (present/absent/justified por aula), `class_reservations` (avulso, experimental, pacote), `class_session_overrides` (substituto, cancelada, horário), `student_packages.usages`, `charges` kind `dropin` (Gustavo), registros e metas em `clients` (progressions/records), `message_logs` (aviso à turma), `audit_logs`.

## Etapa 10: cobranças

**Objetivo:** todo o ciclo da cobrança sem o parceiro: pagar, desfazer, cancelar, reabrir, avulsa, atraso, lembretes, troca e pausa de plano, inativação.

1. Cobranças (mês atual): resumo do mês, filtros por tipo (Mensalidades, Aulas avulsas, Cobranças avulsas, Cursos, Pacotes) e situação. Confira Thiago com 4 em atraso e Fernanda "Isento".
2. **Marcar pago** (drawer): Pedro em Pix com comprovante anexado; Mariana em dinheiro; Lucas em cartão com "Pago em" ontem. **Desfazer** o do Lucas. **Cancelar** uma mensalidade com motivo "Cobrança duplicada" e **reabrir** (recusa se outra cobre o período).
3. **"+ Nova cobrança" avulsa:** Pedro, "Kimono", R$ 300,00 em 3 parcelas (resto na 1ª); Enzo, "Exame de faixa", R$ 80,00 à vista.
4. **Lembretes:** no Painel, card de lembretes com os atrasados (Thiago); "Lembrar no WhatsApp" (assistido abre o WhatsApp; oficial envia). No Histórico de Comunicação, a linha.
5. **Troca de plano:** Beatriz para Mensal Livre com o período atual em aberto (substituída) e Pedro com o período pago (início sugerido no próximo).
6. **Pausar assinatura** do Gustavo (cadastro → situação); gere o próximo mês (abra Cobranças no mês seguinte): sem mensalidade dele.
7. **Inativar** o Thiago com mensalidades em aberto: "Manter para receber"; inative a Mariana: "Cancelar a cobrança". Reative o Thiago.
8. Mês seguinte em Cobranças: mensalidades geradas sozinhas, com o desconto da Mariana ainda válido e a bolsa.
9. **Paginação de Cobranças:** o mês atual tem mais de 20 linhas (mensalidades de 22 alunos, 4 atrasadas do Thiago, avulsas, parcelas do curso, aula avulsa). "Por página: 10", navegue até a última, troque de página e mude o filtro de tipo: volta à página 1; os cartões do mês não mudam com a página.

**No banco:** `charges` (status, `paid_at`, `method`, `paid_via`, `cancel_reason`, `replaced`, parcelas da avulsa), `attachments` (comprovante), `clients` (`membership_status` paused, status inactive), `message_logs` (lembretes), `audit_logs`.

## Etapa 11: recebimentos online (Asaas sandbox)

**Objetivo:** ativar a conta do espaço novo, Pix, link, repasse, fatura pública, cancelamento, extrato, saque.

1. Recebimentos online: tela antes de ativar (simulação "Quanto você recebe"), **Ativar** com CPF/CNPJ fictício válido e e-mail novo (o Asaas recusa e-mail já usado: a mensagem deve ser neutra e focar o campo). Aprove no sandbox pelo botão da tela. Tour da tela aparece uma vez.
2. Conexão: tarifas sincronizadas (Pix promocional), webhook registrado (túnel), chave Pix criada (primeiro Pix já sai).
3. Cobranças → Pedro → **Cobrar online** → Pix: QR, copia e cola, "Enviar pelo WhatsApp"; **Simular liquidação**. Em Recebimentos, a linha com taxas; no Financeiro, "Entrou" cheio e "Saiu" com as taxas (popover). Outra cobrança por **link** (cartão) com **repasse da taxa** ao aluno: o aluno paga a mais, líquido igual ao valor.
4. **Fatura pública** `/p/c/<código>`: abra em janela anônima (dados mascarados), escolha a forma; menor sem responsável financeiro pede cadastro.
5. Gere um novo código para a mesma cobrança: o anterior é cancelado no Asaas. Pague uma cobrança à mão com Pix em aberto: o código é cancelado.
6. Extrato em PDF do mês; "Sacar via Pix" (janela, sem transferir); Configurações da aba (validade do Pix, formas aceitas, repasse).
7. **Paginação de Recebimentos:** gere Pix para 11 alunos (Cobrar online em cada mensalidade) e simule a liquidação de 5: o histórico passa de 10 linhas; teste as setas, o "por página" e o filtro "Pagas e aguardando" versus "Aguardando".

**No banco:** `organizations` (gateway_status, `gateway_fees`, `gateway_webhook_url`), `online_payments` (status, `split_amount_cents`, `gateway_fee_cents`, `net_amount_cents`, `fee_passed_to_customer`, `public_code`, cancelados com motivo), `webhook_events` (asaas, processed), `charges` (`paid_via` online), `financial` (linha de taxas), `audit_logs` (inclusive o ator de sistema do webhook).

## Etapa 12: evolução do aluno

**Objetivo:** faixas, graus, graduação, certificado de graduação, notas e medidas.

1. Pedro: "Definir faixa" → Branca com "Ponto de partida" há 14 meses (veio de outra academia). Dê 2 graus. A trilha mostra o progresso pelo critério (presenças e tempo) e "Apto" quando bater; **Graduar** para Azul (examinador: Carlos). Veja o selo na lista e na chamada.
2. Enzo (kids): nível por idade; ao fazer 16 anos (ajuste a data de nascimento de um aluno para testar) a chamada avisa a troca de nível pela idade.
3. **Certificado de graduação:** no diálogo de Graduação, "Certificado" na linha da promoção; prévia, PDF, "Voltar" sem loop; Configurações → Certificado: aba Graduação, galeria de modelos, editor com variáveis `{aluno}` `{etapa}`, assinatura por arrastar.
4. **Notas (Judô):** detalhe da turma → aba Avaliações → nova avaliação "Prova de quedas" peso 2; lance notas (uma ausente); boletim "Notas" do Miguel com média e aprovação; tente lançar com o professor de outra turma (etapa 15).
5. **Medidas:** registre peso e altura de dois alunos (medidas da modalidade) e veja a evolução.

**No banco:** `clients.progressions` (nível, graus, `promotion_history` com examinador), `issued_certificates` (kind graduation, `verification_code`), `assessments` (grades), `student_measurements`, `audit_logs`.

## Etapa 13: comunicação

**Objetivo:** modelos, envio assistido e oficial, lembretes, mensagem para vários, horário de envio, histórico.

1. Mensagens: edite o modelo de boas-vindas (variáveis), desligue "Pacote acabando" e religue; sugestões por área.
2. Conexão: no espaço novo, **assistido** por padrão. Teste "Lembrar no WhatsApp" em dois alunos (abre o WhatsApp com o texto; registra "Aberto no WhatsApp"). Conecte o oficial (atalho) e repita com o Pedro (texto livre dentro da janela; fora, a Meta descarta; por modelo depende da forma de pagamento na Meta). Horário de envio 08:00 a 20:00.
3. "+ Nova mensagem" para vários alunos (a turma Jiu-Jitsu Manhã inteira, 11 alunos) e avulsa para um: o Histórico passa de 10 linhas.
4. Painel: card de lembretes (atrasados, pacote acabando, três faltas, aniversário, boas-vindas pendentes, avanço de nível); adiar um; o sino com os avisos do espaço.
5. Histórico: filtros por tipo e status; ao clicar, o aluno; aba no cadastro do aluno com as mensagens dele. **Paginação:** "por página: 10", navegue e confira que mudar o filtro de status volta à página 1.

**No banco:** `message_templates` (enabled, content), `whatsapp_connections` (status, franquia), `message_logs` (opened/queued/sent, trigger, client_id), `audit_logs`.

## Etapa 14: financeiro, professores e relatórios

**Objetivo:** lançamentos, recorrência, categorias, pagamento dos professores, DRE e os 8 relatórios.

1. Financeiro → Lançamentos: despesa "Aluguel" R$ 2.000,00 recorrente (todo mês, dia 5), "Material" avulsa paga hoje com anexo, receita "Venda de kimono" R$ 350,00, e mais 6 lançamentos simples (luz, água, internet, marketing, evento, outras receitas). Marcar pago, desfazer, cancelar; encerrar a recorrência. Categorias: criar "Água" e inativar. **Paginação de Lançamentos:** com as linhas agregadas das cobranças, os pagamentos dos professores (etapa 14.3) e os 9 lançamentos, a lista passa de 10: "por página: 10", setas e filtro por categoria voltando à página 1.
2. Resumo: Entrou, Saiu (popover das taxas online), Saldo, Em atraso, Contas a pagar; visão Avançada com o gráfico; Bolsas concedidas.
3. **Professores:** regras: Carlos fixo R$ 1.500 + R$ 20 por aula; Ana R$ 30 por aula; Rafael 60% do que os alunos pagaram (pacote); Juliana por aluno R$ 15; Bruno por aula (substituição conta para ele). Prévia do mês, ajustes, **fechar** e **pagar**; o pagamento vira saída no Resumo e no Lançamentos.
4. Relatórios: os 8 do catálogo (lista por categoria, mês dentro do relatório), PDF e CSV de cada; DRE com "Deduções" das taxas online.

**No banco:** `financial_entries`, `financial_recurrences`, `financial_categories`, `teacher_pay_rules`, `teacher_payouts` (closed → paid), `attachments`, `audit_logs`.

## Etapa 15: perfis, permissões e segurança

**Objetivo:** cada perfil vê e faz só o que pode; auditoria; 2FA.

1. Entre como **Carlos (profissional)** em janela anônima: só as próprias turmas no Calendário e em Turmas; chamada da própria aula; "Registrar aula" e graduação (se tiver `progression:manage`); não vê Cobranças nem Financeiro; tenta abrir `/finance` pela URL (recusa). Substituição: a aula em que Bruno substituiu Carlos aparece para Bruno (crie acesso para ele) e não para Carlos.
2. **Marcos (atendente):** alunos, matrícula, chamada, cobranças (ver, não gerenciar?), sem Financeiro, sem Usuários.
3. **Juliana (gerente):** tudo menos usuários dono/gerente; Auditoria só com os eventos permitidos.
4. **Auditoria** (dono): filtros O quê, Ação, Quem, Período; grupos por dia; drawer com "Abrir aluno/turma"; eventos sensíveis; ator de sistema (webhook, rotinas). "Carregar mais eventos" até o fim (a esta altura há centenas), e o contador "N de total".
5. **Segurança:** troque a senha; ligue o 2FA por aplicativo (TOTP), códigos de recuperação, dispositivo lembrado; "Esqueci minha senha" por e-mail; os 4 momentos do aviso de 2FA.

**No banco:** `users` (profile, `professional_id`), `audit_logs` (`security`, `source`), `two_factor_*`, `trusted_devices`, `password_reset_tokens`.

## Etapa 16: encerramentos, certificados de curso, LGPD e celular

**Objetivo:** fim do curso, certificado de conclusão, inativações e exclusões, plano GestaraHub, passada no celular.

1. Judô Curso de Férias: ajuste "Termina em" para ontem → "Encerrado"/"Concluído"; emitir certificado de conclusão (um e em lote), verificação pública pelo código em janela anônima.
2. Plano GestaraHub: Configurações → Plano: ver Grátis, "Ativar Profissional" (sandbox: Simular pagamento), troca mensal↔anual, downgrade no fim do período, fatura do plano, franquia de WhatsApp.
3. LGPD: inativar aluno, pedido de exclusão do aluno (o que fica retido), inativar professor com pagamentos; zona de perigo do espaço (só olhar as travas).
4. **Celular** (Chrome iOS ou Android, ou o modo responsivo): Painel, Calendário, chamada por toque, cadastro de aluno (sem zoom nos campos), Cobranças, menu lateral com o tour, dark mode.
5. Preferências: tema, cor, som; "Me mostre na tela" na Ajuda para dois guias.

**No banco:** `class_groups` (fim), `issued_certificates` (course, lote), `clients` (status, exclusão), `subscription_events`, `user_preferences`, `audit_logs`.

## Achados

| # | Etapa | Gravidade | O que aconteceu | Correção |
| --- | --- | --- | --- | --- |
| 1 | 1 | baixa | Política de Privacidade (§4 e §9) e Termos (§7) citam nichos específicos ("turmas infantis de artes marciais, dança, natação ou música", "sua academia", "espaço educacional/academia") em vez de linguagem genérica voltada a turmas e espaços | `12c7643` |
| 2 | 3 | alta | Conta trial do MailerSend recusava e-mails para terceiros (422) e revogava o convite no banco sem imprimir o link no terminal, impedindo testar convites de equipe, redefinição de senha e 2FA | `600f2b0` |
| 3 | 9 | média | Som ao marcar presença (bipe) estava configurado nas preferências, mas não era disparado na tela de chamada ao marcar presença | `e54f0da` |
| 4 | 3 | média | Edição de usuário permitia alterar o e-mail mesmo após a conta ser ativada, sem validação no backend | `eeb6f67` |
| 5 | 3 | baixa | Ao vincular um instrutor da equipe no formulário de usuário, o e-mail cadastrado do instrutor não era carregado automaticamente | `0795944` |
| 6 | 3 | baixa | Seletor de contexto ("Dia a dia" vs "Gestão") aparecia na barra lateral para perfis sem permissões de gestão (como instrutor/professor), exibindo uma aba de gestão vazia | `8f62682` |
| 7 | 3 | média | Campo select com `disabled` abria o menu de opções ao clicar e botões/campos desativados não exibiam o cursor de bloqueado (`not-allowed`) por padrão | `581c6e2` |
| 8 | 3 | baixa | Lista de usuários exibia o nome do profissional vinculado abaixo do e-mail mesmo quando idêntico ao nome do próprio usuário, gerando redundância visual | `9f6786e` |
