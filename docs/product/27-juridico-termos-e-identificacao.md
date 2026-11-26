# Jurídico: identificação da empresa, termos, privacidade e parceiros (revisão de 02/11/2026)

> Revisão feita pelo agente a pedido do dono, antes do teste geral. Não substitui advogado nem contador: é a lista do que o sistema mostra hoje, do que a lei e os parceiros pedem, e do que falta. Decisões e exclusão de dados: [24-diretrizes-exclusao-e-lgpd.md](24-diretrizes-exclusao-e-lgpd.md). Nota fiscal: [../technical/24-plano-gestarahub.md](../technical/24-plano-gestarahub.md) §7. WhatsApp: [../technical/07-integracao-whatsapp.md](../technical/07-integracao-whatsapp.md).

## 1. O que existe hoje

| Peça | Onde | Situação |
| --- | --- | --- |
| Termos de Uso (11 seções) e Política de Privacidade (11 seções) | `/terms`, `/privacy` (`features/landing/components/legal-documents.tsx`), versão `LEGAL_UPDATED_AT` em `config/site.ts` | Bons no conteúdo: papéis LGPD (espaço controlador, GestaraHub operador), menores (art. 14), Asaas, Meta, Amazon SES (`us-east-2`), PostHog com banner de cookies, direitos do titular, retenção, Marco Civil. |
| Aceite dos termos | Caixa no cadastro da landing; diálogo obrigatório no app (`legal-consent-dialog.tsx`, versão `v1.0-2026-10`); `legal_consents` guarda quem, quando, versão | Feito. |
| Contrato de ativação dos recebimentos (10 cláusulas) | Diálogo "Ativar" em Recebimentos online | Feito: mandato, tarifas (desde 26/11/2026: 1,5% de R$ 0,99 a R$ 9,90 no grátis, 1% de R$ 0,69 a R$ 6,90 nos pagos; antes R$ 1,99 e R$ 1,29 fixos), chargeback, PLD, LGPD, NFS-e (espaço emite para o aluno; GestaraHub só sobre a taxa), saques. |
| Termo de consentimento do menor (art. 14) | `/consent/minor/<id>` com dados mascarados, nome de quem assina, IP e hora | Feito. |
| Rodapé da landing | "© {ano} GestaraHub. Todos os direitos reservados." + Termos, Privacidade, Contato | Sem empresa, CNPJ nem endereço. |
| E-mails | Moldura única (`lib/email/ses.ts`) com motivo do envio | Rodapé com MHMJ, CNPJ e endereço. |
| Páginas públicas (`/p/c/<código>`, `/p/certificado`, `/consent`) | Logo do GestaraHub; a fatura cita "parceiro de pagamentos regulado" | Sem identificação da empresa nem link para a privacidade. |

## 2. Identificação da empresa (MHMJ): obrigatória, não opcional

**Por quê.** O Decreto 7.962/2013 (comércio eletrônico, dentro do CDC) exige, em lugar de destaque no site que oferece o serviço, o **nome empresarial, o CNPJ, o endereço físico e eletrônico** e um canal de atendimento. A LGPD (arts. 9 e 41) exige que o controlador se identifique e divulgue a identidade e o contato do **encarregado (DPO)**. O Marco Civil pede os termos claros. Um contrato que diz "a GestaraHub" sem dizer quem é a GestaraHub tem a parte contratante indefinida.

**Onde entra, com o mesmo bloco de dados** (razão social, CNPJ, endereço completo, cidade e UF, e-mail; o nome fantasia GestaraHub é a marca):

1. **Termos de Uso §1:** "a plataforma GestaraHub, de titularidade de MHMJ ..., inscrita no CNPJ ..., com sede em ... ('GestaraHub')". E §11: foro da **Comarca de Manaus/AM** (hoje diz "domicílio da sede da plataforma", indefinido). §7: "pertencem à MHMJ ..." no lugar de "desenvolvedores e mantenedores".
2. **Política de Privacidade §2** (controlador dos dados da conta = MHMJ) e **§11** (encarregado com nome da pessoa ou da empresa e e-mail próprio, por exemplo `privacidade@gestarahub.com.br`; hoje é só o `contato@`).
3. **Contrato de ativação** dos recebimentos: cláusula 1 nomeando a MHMJ como a procuradora tecnológica.
4. **Rodapé da landing e das páginas públicas:** "GestaraHub é um produto da MHMJ ... · CNPJ ... · Manaus/AM · contato@...", com os links de Termos e Privacidade.
5. **Rodapé dos e-mails:** razão social, CNPJ e endereço (boa prática antispam e exigência de identificação do remetente).
6. **Conta principal do Asaas e NFS-e:** a conta-pai das subcontas tem de ser PJ (CNPJ), exigência das Resoluções 16 e 17 do Bacen; a nota sai pela MHMJ.
7. **Google e Meta:** os cadastros do app pedem nome do app, site, e-mail do desenvolvedor, Termos e Privacidade; o nome da empresa aparece na tela de consentimento do Google.

**Marca:** registrar "GestaraHub" no INPI não é obrigatório, mas protege o nome e evita ter de trocar depois. Vale pedir ao contador ou a um escritório de marcas.

## 3. Lacunas nos Termos e na Privacidade

| # | Lacuna | O que fazer |
| --- | --- | --- |
| T1 | Partes indefinidas e foro vago | §2 acima. |
| T2 | **Direito de arrependimento (CDC art. 49):** contratação do plano pago pela internet dá 7 dias para desistir com devolução integral | Cláusula nova em §3 dos Termos; o fluxo já tem "reverter em 15 dias" e período de carência (doc 13 §6): alinhar texto e código (devolução do plano anual nos 7 dias). |
| T3 | **Reembolso e cancelamento do plano pago:** mensal sem fidelidade está; falta dizer o que acontece com o anual (fica até o fim do período pago, sem devolução proporcional depois dos 7 dias) | Cláusula em §3 ou §9, conforme a regra de doc 13 §6. |
| T4 | **Incidente de segurança (LGPD art. 48):** a Política não diz que o GestaraHub comunica o espaço (controlador) em caso de vazamento, nem o prazo | Parágrafo em §8 da Privacidade: comunicação ao espaço em até X horas úteis com o que foi afetado. |
| T5 | **Anexo de tratamento de dados (operador):** a LGPD pede instruções do controlador ao operador; §5 dos Termos cobre em uma frase | Anexo curto: finalidades, suboperadores (lista), sigilo, exclusão ao fim do contrato, auditoria, prazo de devolução. |
| T6 | **Suboperadores sem nome:** "servidores em nuvem ISO 27001 e SOC 2" | Nomear Supabase (banco e armazenamento, região **a confirmar**: se fora do Brasil, é transferência internacional, art. 33) e Vercel (aplicação); PostHog (região do projeto, a confirmar); MailerSend. |
| T7 | **Entrar com Google** não aparece na Privacidade | Item em §3: nome, e-mail e foto recebidos do Google só para criar e autenticar a conta; a Google exige essa divulgação na verificação do app. |
| T8 | **Exclusão da conta só por e-mail** | A doc 24 já prevê a zona de perigo; até lá, deixar o prazo de resposta (ex.: 15 dias) na Política. Quando for para tela e painel, seguir o roteiro de atualização de Termos, Privacidade e contrato da subconta em [`24-diretrizes-exclusao-e-lgpd.md`](24-diretrizes-exclusao-e-lgpd.md) §7.3. |
| T9 | **Versão e histórico:** há a data (`LEGAL_UPDATED_AT`) e o aceite guarda a versão; falta um "o que mudou" | Lista curta de mudanças por versão no fim de cada página. |
| T10 | **Encarregado só com e-mail genérico** | §2 acima. |
| T11 | **Páginas públicas sem rodapé legal** (`/p/c`, `/p/certificado`, `/consent`) | Rodapé com identificação e link da Privacidade; na fatura, citar o Asaas pelo nome como processador. |
| T12 | Termos §3 fala de "Profissional ou Expansão" sem preço | Quando o preço for publicado (doc 13), citar a página de planos como referência. |

## 4. O que a Meta exige (WhatsApp e cadastro guiado)

| # | Exigência | Situação | O que fazer |
| --- | --- | --- | --- |
| M1 | **Opt-in do destinatário** antes de mensagem iniciada pela empresa (Política de Mensagens do WhatsApp Business): o espaço precisa ter a autorização do aluno ou responsável, com registro | Não existe campo de consentimento de WhatsApp no cadastro do aluno (doc 07 §3.6 em aberto). A Privacidade fala em "autorizados pelo usuário", mas o sistema não guarda | Campo "Aceita receber mensagens pelo WhatsApp" (com data e quem registrou) no cadastro; sem ele, o envio oficial automático não sai; o assistido continua (quem envia é a pessoa). Texto curto no termo do menor e no cadastro. |
| M2 | **Opt-out:** o destinatário pode pedir para parar ("SAIR", "PARAR") | Sem tratamento: o webhook recebe mensagens, mas nada marca o aluno | Ao receber "sair/parar/cancelar", marcar o consentimento como revogado e parar o automático; aviso no Histórico. |
| M3 | **URLs públicas no app da Meta:** Política de Privacidade, Termos de Serviço e **instruções de exclusão de dados** ("Data Deletion Instructions URL") para apps com Login do Facebook e cadastro guiado | Termos e Privacidade existem; a página de exclusão não | Página `/privacy#exclusao` ou `/data-deletion` dizendo como pedir a exclusão (e-mail do encarregado e, depois, a zona de perigo). |
| M4 | **Nome de exibição** do número aprovado pela Meta e coerente com o negócio | O número real está "em análise" | Em produção cada espaço conecta o próprio número pelo cadastro guiado; o nome é o do espaço. |
| M5 | **Modelos aprovados** para mensagem fora da janela de 24 h; texto livre só dentro dela | Os modelos existem na conta; o app ainda manda texto livre | Envio por modelo (decisão em aberto, 01/11/2026). |
| M6 | Verificação da empresa no Meta Business | Verificada ("business_verification_status: verified") | Nada. |

## 5. O que o Asaas exige da plataforma

| # | Exigência | Situação | O que fazer |
| --- | --- | --- | --- |
| A1 | **Conta-pai PJ (CNPJ)** para criar subcontas (Resoluções Bacen 16 e 17) | A conta principal de produção precisa ser da MHMJ | Confirmar antes do primeiro deploy. |
| A2 | **Termos do próprio Asaas com o espaço:** no modelo não-BaaS (o nosso), o Asaas manda o e-mail de ativação ao titular, que define senha, aceita os termos do Asaas e envia os documentos na interface dele | O contrato de ativação já diz que o espaço fornece dados verídicos e que o parceiro valida | Nada a embutir; dizer no diálogo de ativação que o espaço receberá um e-mail do Asaas para concluir a conta (documentos). |
| A3 | **Período de avaliação regulatória** na produção: 10 subcontas, R$ 2.000 por subconta, 60 dias; depois disso bloqueia até a homologação | Não registrado | Pedir a homologação ao Asaas logo após o primeiro espaço real; item em "Antes de ir para produção". |
| A4 | **Confirmação anual dos dados comerciais** das subcontas | Não existe | Rotina ou aviso anual (doc do Asaas "Confirmação Anual de Dados Comerciais"); pendência. |
| A5 | **Taxa de criação de subconta** pode existir no contrato com o Asaas | Não conferido | Conferir em Configurações de Conta → Taxas na conta principal. |
| A6 | Dados do pagador enviados ao Asaas (nome, CPF, e-mail, telefone, endereço) | Já declarado nos Termos §4 e na Privacidade §5 | Nada. |
| A7 | O GestaraHub não é instituição financeira: os textos devem dizer "conta de recebimento", "parceiro de pagamentos" | Já assim | Nada. |

## 6. Outros cadastros que pedem os mesmos dados

- **Google (OAuth, "Entrar com Google"):** tela de consentimento com nome do app, logo, site, Termos, Privacidade e e-mail de suporte; verificação da marca quando passar de 100 usuários. Dados em `docs/guides/16-ambiente-local.md`.
- **Amazon SES:** domínio verificado (Easy DKIM, Custom MAIL FROM `envio.gestarahub.com.br` e DMARC) em `us-east-2`; saída do Sandbox solicitada.
- **Registro.br / DNS:** o domínio no CNPJ da MHMJ.

## 7. Ordem sugerida e andamento

**Feito em 02/11/2026** (passos 1 a 3, menos as decisões em aberto): dados da empresa em `config/site.ts` (`COMPANY_NAME`, `COMPANY_CNPJ`, `COMPANY_ADDRESS`, `LEGAL_FORUM`); Termos v1.1 (partes, canal de atendimento, arrependimento de 7 dias, cancelamento do mensal e do anual, instruções do controlador à operadora, autorização de WhatsApp, propriedade da MHMJ, prazo de resposta do encerramento, foro de São Paulo com ressalva do consumidor, histórico de versões); Privacidade v1.1 (controladora, entrada com Google, suboperadores nomeados com aviso de transferência internacional, incidentes em até 72 h, seção "Como pedir a exclusão dos seus dados" em `/privacy#exclusao` para o cadastro da Meta, encarregado); contrato de ativação cláusula 1 com a MHMJ; rodapés da landing, dos e-mails e das páginas públicas (`components/shared/public-legal-footer.tsx`: fatura, certificado e termo do menor); `CURRENT_PLATFORM_TERMS_VERSION` = `v1.1-2026-11` (todo usuário aceita de novo ao entrar). **Encarregado:** a própria MHMJ com o e-mail de contato (decisão do dono; nomear uma pessoa é opcional). **Fica para confirmar:** região dos projetos Supabase e PostHog (hoje o texto diz que pode haver processamento fora do Brasil).



1. Dono passa o bloco de dados (razão social, CNPJ, endereço, cidade do foro, e-mail do encarregado e nome do encarregado).
2. Agente aplica o bloco em Termos, Privacidade, contrato de ativação, rodapés (landing, públicas, e-mails), com a data da nova versão e o aceite de novo no app (T1, T10, T11, §2).
3. Cláusulas novas: arrependimento, anual, incidente, Google, suboperadores com região confirmada, página de exclusão de dados (T2 a T9, M3).
4. Consentimento de WhatsApp no cadastro e opt-out (M1, M2), junto com o envio por modelo (M5).
5. Antes da produção: conta-pai PJ, homologação do Asaas, confirmação anual (A1, A3, A4), cadastros da Meta e do Google com as URLs.

## 8. Revisão de 10/11/2026 (v1.2)

Conferência do texto contra o que o sistema faz depois de 02/11. Versão `v1.2-2026-11` (todo usuário aceita de novo ao entrar), data em `LEGAL_UPDATED_AT`.

| # | Lacuna | O que entrou |
| --- | --- | --- |
| R1 | Dados de saúde (atestado, questionário de saúde, exame, laudo) nos documentos da ficha (doc 28) e medidas como peso (doc 21 §2.4) não apareciam; são dados sensíveis (LGPD art. 11) | Privacidade §3 "Dados de Saúde e Documentos dos Alunos"; Termos §5: o espaço declara a base legal, coleta só o necessário e limita o acesso por permissão. **Vale leitura de advogado antes da produção.** |
| R2 | A Privacidade prometia parar o WhatsApp ao responder "SAIR", mas o webhook não trata isso (M2) | Texto trocado para "peça ao espaço para parar o envio". Quando o opt-out for feito (M2), voltar o "SAIR" ao texto. |
| R3 | Assistente de ajuda (Anthropic, `services/server/supportBot.ts`) fora da lista de fornecedores | Privacidade §5: recebe só a conversa, com CPF, CNPJ, e-mail, telefone e números longos ocultados (`maskSensitive`); nomes não são ocultados, por isso o aviso "evite escrever dados de alunos". |
| R4 | SDK da Meta do cadastro guiado do WhatsApp grava cookies e não era citado | Privacidade §5 (fornecedor) e §7 (cookies da Meta só ao conectar o WhatsApp; sem pixel de anúncios). |
| R5 | Verificação pública do certificado e inscrições em eventos | Privacidade §3: o que a página `/p/certificado` mostra (nome abreviado e dados do certificado). |
| R6 | Dados de cobrança da assinatura do GestaraHub | Privacidade §3: cobrança pela Asaas e nota fiscal. |
| R7 | Prazos de guarda dos registros | Privacidade §11: auditoria e aceites (com IP) enquanto servirem de prova; registro de erros por 120 dias (doc technical/21). |

**Continua em aberto:** região dos projetos Supabase e PostHog (o padrão do PostHog no projeto é `us.i.posthog.com`); devolução do plano anual dentro dos 7 dias conferida no código; itens de produção do §7 passo 5.


## 9. Autorização e "SAIR" do WhatsApp (12/11/2026, M1 e M2)

**Como ficou:**
- **Autorização no cadastro do aluno:** chave "Aceita mensagens pelo WhatsApp" logo abaixo do telefone. A situação fica em `Client.whatsappConsentStatus` (`unknown`, `granted`, `revoked`; migração 96). O navegador manda só a situação; a data e quem registrou ("Ana (no cadastro)") são do servidor (`whatsappConsentFieldsFor` em `services/clients/clientConsentRules.ts`). Desmarcar quem tinha autorizado vira "pediu para parar". A linha de apoio da chave mostra quando e quem registrou.
- **Sem autorização, o envio oficial não sai:** parabéns e lembretes de cobrança automáticos pulam o aluno; o envio pela API a partir da tela recusa com a explicação ("ainda não autorizou" ou "pediu para não receber"). O envio assistido, pelo WhatsApp de quem atende, continua (quem envia é a pessoa).
- **"SAIR" pelo WhatsApp:** o webhook (`services/communication/whatsappOptOut.ts`) reconhece "SAIR", "PARAR", "PARE", "CANCELAR", "STOP" e "DESCADASTRAR" (só a palavra, sem diferença de maiúscula, acento ou pontuação). Marca "pediu para parar" nos alunos daquele número, como aluno ou responsável (com ou sem o 9 do celular), só nos espaços que falam com ele: o dono do número do WhatsApp conectado ou, no número da plataforma, quem mandou mensagem a esse número nos últimos 90 dias. A Auditoria registra com o autor "Sistema".
- **Alunos que já existiam** começam sem registro: o automático para até o espaço marcar a autorização. Antes do lançamento não há espaço real, então nada para de surpresa.
- **Testes:** `whatsapp-consent.test.ts` (carimbo e palavras), `communication.test.ts` (parabéns e envio pela tela), `whatsappOptOut.db.test.ts` (o "SAIR" no banco, responsável, outro espaço, número conectado).

**Falta:** voltar o "responda SAIR" à Privacidade (R2), na próxima versão dos textos, junto com as outras mudanças (regra de 10/11/2026: textos jurídicos mudam em lote). Na lista de lembretes e no envio em sequência, o aluno sem autorização ainda aparece e só recusa ao enviar; vale um selo antes, se incomodar no uso.

## 10. Versão 1.3 (24/11/2026): revisão do app na Meta

A revisão do app na Meta (permissões `whatsapp_business_management` e `whatsapp_business_messaging`, enviada em 18/11/2026) pediu os links dos Termos e da Privacidade. Versão `v1.3-2026-11` (todo usuário aceita de novo ao entrar), data em `LEGAL_UPDATED_AT`. Entraram também os dois itens jurídicos que esperavam a próxima versão.

| Onde | O que entrou |
| --- | --- |
| Privacidade §6 (nova) "Dados Recebidos da Meta (WhatsApp)" | O que o app recebe ao conectar pelo cadastro guiado: identificadores da conta e do número, número e nome exibido, token guardado criptografado (Vault), situação das mensagens, dos modelos e da conta. Respostas lidas só para o "SAIR", sem guardar o conteúdo (`whatsappWebhook.ts`). Uso só para as mensagens do espaço, sem venda, publicidade ou perfil. Desconectar apaga o token e cancela os avisos (`whatsappCredentials.disconnect`). As seções seguintes passaram a 7 a 13. |
| Privacidade §11 (exclusão, âncora `#exclusao`) | Item "WhatsApp conectado pela Meta": desconectar em Comunicação → Conexão, remover o app nas integrações da Meta, ou e-mail com o assunto "Exclusão de dados da Meta". |
| Privacidade, "Summary in English" | Resumo em inglês dos dados da Meta e da exclusão, para o revisor. |
| Termos §5 | WhatsApp oficial: conta do próprio espaço, aceite dos termos do WhatsApp Business, Política de Mensagens do WhatsApp Business, suspensão se descumprir. Custo: a Meta cobra na conta do espaço; o GestaraHub não cobra nem revende mensagens; sem pagamento na Meta o automático não sai (`technical/07` §1.5). |
| Termos §3 | Estorno integral até 7 dias do pagamento, sem estorno depois; estorno ou contestação volta o espaço ao Gratuito na hora (`product/13` §6, decisão de 21/11/2026). |

**Falta (você, depois do deploy):** no painel do app da Meta, em Configurações → Básico, conferir as URLs `https://gestarahub.com.br/privacy` e `/terms` e preencher "Exclusão de dados do usuário" com a URL de instruções `https://gestarahub.com.br/privacy#exclusao`. Se a Meta pediu os links por mensagem na revisão, responder com os mesmos endereços.
