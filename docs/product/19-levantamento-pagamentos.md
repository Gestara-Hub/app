# 19 — Levantamento: pagamentos

> **Status:** Atualizado em 19/10/2026. **Decisão tomada:** Provedor escolhido = **Asaas**. Preços do Pro (R$ 79,90/mês e R$ 799/ano) e Scale (R$ 199/mês e R$ 1.990/ano) aprovados. Pagamento online liberado para todos (inclusive no Grátis) com taxas transacionais via split nativo.
> Base: modelo de negócio em [13-modelo-de-negocio.md](13-modelo-de-negocio.md); pagamento online simulado em [../technical/05-modulo-financeiro.md](../technical/05-modulo-financeiro.md), seção 6; WhatsApp em [../technical/07-integracao-whatsapp.md](../technical/07-integracao-whatsapp.md).

## 1. Os três fluxos de dinheiro

| # | Quem paga | Quem recebe | O quê | Definição (19/10/2026) |
|---|---|---|---|---|
| 1 | Espaço | GestaraHub | Assinatura do plano (Pro: R$ 79,90/mês ou R$ 799/ano; Scale: R$ 199/mês ou R$ 1.990/ano) | Asaas (Assinatura por Pix Automático, Pix ou Cartão) |
| 2 | GestaraHub | Meta (ou parceiro) | Mensagens do WhatsApp oficial | Pro com franquia de 300 msgs/mês; excedente pré-pago |
| 3 | Aluno | Espaço (com taxa do GestaraHub) | Mensalidade online: Pix, link, Pix Automático | Asaas (Subconta da academia com split automático na liquidação) |

## 2. Fluxo 1: assinatura do GestaraHub

### Decisões (19/10/2026)
- **Preço:**
  - **Pro:** **R$ 79,90 / mês** ou **R$ 799,00 / ano** (desconto de ~2 meses, R$ 66,58/mês).
  - **Scale:** **R$ 199,00 / mês** ou **R$ 1.990,00 / ano**.
- **Formas de pagamento:** Cartão recorrente, Pix e Pix Automático.
- **Falta de pagamento:** Prazo de carência (ex: 5 dias) e depois reverte ao Grátis **sem perder nenhum dado de alunos, histórico ou turmas** (apenas os recursos Pro — como envio automático de WhatsApp e taxas reduzidas — ficam bloqueados).
- **Conta Master:** Aberta no Asaas com CNPJ ME do fundador (categoria: Software / Licenciamento).

## 3. Fluxo 2: mensagens do WhatsApp oficial

### Como a Meta cobra (a confirmar na tabela oficial)
- Por **mensagem enviada pela empresa**, com preço por **categoria**: utilidade (lembrete de cobrança, mais barata), marketing (parabéns, "Sentimos sua falta", mais cara), autenticação.
- Responder o aluno em até 24 horas depois que ele escreve é gratuito.
- A Meta anunciou cobrança **em reais** para contas do Brasil em 2026. Fontes de terceiros falam em algo como R$ 0,04 a R$ 0,08 por mensagem de utilidade e perto de R$ 0,38 por mensagem de marketing, mas divergem entre si. **Usar só a tabela oficial para fechar preço.**
- Por um parceiro (BSP), soma-se a margem dele.

### A decidir: o que acontece quando a franquia acaba
O Pro inclui uma franquia mensal (hoje 1.000 no mock). Opções para o excedente:

| | Como funciona | A favor | Contra |
|---|---|---|---|
| **A. Para de enviar** | Automático pausa; assistido continua | Custo previsível para nós | O espaço perde lembretes no fim do mês |
| **B. Cobra o excedente na fatura seguinte** | Conta por mensagem e cobra junto da assinatura | Nunca para | Fatura variável pode assustar |
| **C. Pacotes adicionais pré-pagos** | O espaço compra mais mensagens quando avisado | Sem surpresa na fatura | Exige compra avulsa |

**Recomendação:** aviso em 80% e 100% da franquia, com **C** (pacote adicional) e, sem pacote, **A** (pausa o automático e mantém o assistido). Evita fatura surpresa e protege nosso custo.

### Outros pontos
- **Peso por categoria:** como marketing custa várias vezes mais que utilidade, a franquia pode contar mensagens de marketing com peso maior, ou separar parabéns e "Sentimos sua falta" numa franquia menor. Decidir junto com o preço do Pro.
- **Acompanhamento de custo por espaço:** registrar a categoria de cada envio para saber o custo real por cliente.
- **Quem é o pagador na Meta:** o GestaraHub (direto ou via parceiro), já que a franquia está inclusa no plano. A alternativa (cada espaço com cartão próprio na Meta) foi descartada na prática: complica o cadastro e tira o controle da franquia.

## 4. Fluxo 3: mensalidade online dos alunos

### Modelo
- O dinheiro cai **na conta do espaço**, não do GestaraHub: cada espaço vira uma **subconta** no provedor de pagamento (cadastro com documentos: conhecer o cliente).
- O GestaraHub ganha uma **taxa por transação** retida automaticamente (**split**). O Pro tem taxa reduzida (doc 13).
- Baixa automática da mensalidade pelo aviso (webhook) do provedor. Isso substitui o "Simular pagamento" e a baixa do Pix Automático simulado.

### Decidido em 21/10/2026: tarifa do Asaas e taxa do GestaraHub
- **Taxa do GestaraHub:** fixa por cobrança online recebida: R$ 1,99 no Grátis e R$ 1,29 no Profissional e no Expansão (split retido na liquidação).
- **Quem paga a tarifa do Asaas:** o **espaço**, pela subconta dele, além da taxa do GestaraHub (opção A; a B, absorver a tarifa dentro do split, foi descartada porque R$ 1,29 não cobre um Pix de R$ 1,99 nem o percentual do cartão).
- **Tarifas por subconta (decidido em 21/10/2026).** Cada conta do Asaas tem a própria tabela (a promoção começa na criação da conta e termina em datas diferentes). A tarifa da **conta principal** (assinatura dos planos) é custo do GestaraHub e nunca aparece para o espaço nem é gravada. A de cada **subconta** vem de `GET /v3/myAccount/fees` com a chave dela e fica em `organizations.gateway_fees` (jsonb, crua: valor cheio, promoção e data de fim) com `gateway_fees_synced_at`.
  - **Taxa efetiva pela data:** a promoção vale até a véspera do fim; no dia do fim volta o valor cheio, sem buscar nada (`effectiveGatewayFees` em `packages/core/src/payment-fees.ts`).
  - **Quando busca:** (1) na ativação da subconta; (2) por idade, ao ler a organização, se a tabela tem mais de 24 horas (em `after`, sem atrasar a tela); (3) quando o webhook traz a tarifa real e ela não bate com a tabela para aquele meio (tolerância de 1 centavo). O Asaas não avisa mudança de tarifa por webhook. Rotina diária (Supabase Cron) para todas as subcontas fica para quando houver muitos espaços.
  - **Reserva:** sem tabela gravada ou com falha na busca, `ASAAS_FEES` com o padrão do Asaas **sem** promoção (Pix R$ 1,99; crédito 2,99% + R$ 0,49; débito 1,89% + R$ 0,35; boleto R$ 1,99): na dúvida, a prévia mostra taxa a mais, nunca a menos.
- **Webhook de baixa automática por subconta.** O webhook é por conta: o da conta principal não recebe eventos das subcontas. Na ativação, o GestaraHub cadastra na subconta o webhook "GestaraHub" (eventos de pagamento recebido, confirmado, vencido e excluído) com `ASAAS_WEBHOOK_URL` e o token `ASAAS_WEBHOOK_SECRET`. Se a URL mudar (túnel local, domínio), a subconta é recadastrada no próximo acesso (`gateway_webhook_url` guarda a última). Sem as variáveis, a subconta funciona sem baixa automática. A rota recusa pedido sem o cabeçalho `asaas-access-token` certo e, em produção, recusa se o token não estiver configurado.
- **Arredondamento igual ao do Asaas (21/10/2026).** O Asaas **trunca** a parte percentual da tarifa (R$ 42,63 a 1,99% = 0,8483 vira R$ 0,84), conferido em 8 valores no sandbox. `gatewayFeeCents` faz o mesmo, e o repasse procura o menor valor que cobre as taxas: o espaço recebe exatamente o valor da cobrança (antes, o arredondamento comum cobrava 1 centavo a mais do aluno e entrava R$ 40,01 numa cobrança de R$ 40,00).
- **Acerto na cobrança paga online:** em Cobranças, o selo "Pago online" abre o detalhe: quanto o aluno pagou (e por qual meio), tarifa do Asaas, taxa GestaraHub e quanto entrou na conta, com o aviso de repasse ou absorção.
- **Cancelar aqui cancela no Asaas (21/10/2026).** Gerar um código novo, dar baixa manual, cancelar a cobrança, trocar plano, inativar ou tirar da aula cancela a cobrança online no GestaraHub **e** no Asaas (`DELETE /v3/payments/{id}` com a chave da subconta); antes, a do Asaas ficava aberta e o aluno ainda podia pagar o link ou o QR antigo. Se o Asaas recusar porque o aluno acabou de pagar, não cancela aqui: o pagamento vale e o webhook dá a baixa. Se o Asaas falhar, cancela aqui, marca `gateway_cancel_pending` e tenta de novo quando o app ler a organização. O histórico da subconta vem do banco do GestaraHub (`online_payments`), não do Asaas.
- **Expiração igual nos dois lados (21/10/2026).** A validade da cobrança online é a de Recebimentos online ("Validade padrão do Pix", 24 h por padrão; vale também para os links). O Asaas só recebe a **data** de vencimento e, vencida, a cobrança lá **continua pagável**. Agora, passada a validade, o app marca como expirada e **exclui no Asaas** (ao ler a organização, o histórico ou a cobrança; e também quando chega o aviso `PAYMENT_OVERDUE`). Já paga no Asaas: não expira, o webhook dá a baixa. Falha no Asaas: expira aqui e tenta de novo depois.
- **Histórico de movimentações (Recebimentos online, 21/10/2026).** Responde "o que passou pela subconta e quanto ficou", não "o aluno pagou?" (isso é Cobranças, que vê todas as formas, inclusive manual). Filtros no banco, com paginação: **período** (botão que abre sugestões: este mês, mês passado, trimestre, semestre, ano, últimos 12 meses, todo o período; e intervalo livre De/Até; pela data do pagamento, ou da criação se não pago; horário de Brasília; abre em "Este mês"), **situação** (abre em "Pagas e aguardando"; Pagas, Aguardando, Canceladas, Todas) e **forma** (Pix, Cartão, Boleto, O aluno escolhe). Sem linha de resumo abaixo dos filtros (removida a pedido); o cartão do topo passa a ser "Recebido líquido no mês", com as taxas do mês. A análise entre meses (lado a lado, exportação) fica para Relatórios. O filtro de período é o componente compartilhado `components/shared/period-range-picker.tsx`. Sem coluna de aluno por decisão: se fizer falta, o nome aparece ao clicar na linha, com link para a cobrança. A leitura usa o cliente do usuário (RLS), não a chave de serviço.
- **Testar o webhook localmente:** `pnpm tunnel` (raiz) sobe um túnel do Cloudflare (`brew install cloudflared`) para `localhost:3000`, grava `ASAAS_WEBHOOK_URL` no `apps/web/.env.local` e cria `ASAAS_WEBHOOK_SECRET` se faltar. O endereço muda a cada execução: depois de subir, reinicie o `pnpm dev` e abra o app (Configurações > Pagamento online) para a subconta ser recadastrada. Pagamento de teste: link > cartão de crédito com número fictício válido, validade futura, CVV 123; recusa com Mastercard 5184019740373151 ou Visa 4916561358240741 (doc do Asaas, "Testando pagamento com cartão de crédito").
- **Formas de cobrança online (decidido em 21/10/2026).** No Asaas cada cobrança tem um `billingType` só; o `UNDEFINED` mostra Pix, boleto e cartão juntos e não deixa escolher um subconjunto. Por isso:
  - **Recebimentos online > Formas de pagamento:** o espaço liga Pix, Cartão e Boleto (padrão: Pix e Cartão sim, Boleto não; ao menos uma ligada).
  - **Cobrar online:** quem cobra escolhe uma forma por cobrança, entre as ligadas: Pix (`PIX`, QR na hora), Link de cartão (`CREDIT_CARD`, a fatura oferece crédito e débito; o débito não passa pela API), Boleto (`BOLETO`) e **O aluno escolhe** (`UNDEFINED`), que só aparece com as três ligadas.
  - **Taxas na prévia:** Pix exato; cartão entre débito e crédito; boleto entre boleto e Pix (a fatura do boleto costuma trazer QR de Pix, a confirmar no sandbox); o aluno escolhe, entre os quatro meios. Com repasse, o acréscimo cobre o meio mais caro.
  - **Repasse padrão por forma** (Pix, cartão, boleto, o aluno escolhe), com o geral como reserva; ajustável em cada cobrança.
  - Não se gera uma cobrança por forma para a mesma dívida: o aluno poderia pagar duas.
  - Boleto e "o aluno escolhe" sem o meio confirmado ficam como forma "Outro" na cobrança do aluno; com o webhook, Pix vira Pix e cartão vira Cartão.
  - Pix Automático real fica para depois (exige CNPJ com 6 meses, sem split na primeira cobrança).
- **Repasse ao aluno:** por meio (Pix e link), configurado em Pagamento online e ajustável a cada cobrança. Pix: acréscimo fixo (tarifa + taxa). Link: gross-up `(valor + taxa + fixo) / (1 - percentual)`, arredondado para cima para o líquido nunca ficar abaixo do valor.
- **Gravado na cobrança online:** `gatewayFeeCents`, `splitAmountCents`, `netAmountCents`, `feePassedToCustomer` e `paidMethod`. Ao gerar o link, a tarifa gravada é a do crédito (a maior). No pagamento, o webhook do Asaas traz `netValue` (já sem a tarifa dele) e `billingType`: a tarifa vira a real (`valor - netValue`), o líquido vira `netValue - split` e `paidMethod` guarda crédito, débito ou Pix (21/10/2026).
- **Na tela (21/10/2026, a pedido: uma taxa só):** tarifa do Asaas e taxa GestaraHub aparecem **somadas** como "Taxas", com o detalhe ("Asaas R$ x + GestaraHub R$ y") ao passar o mouse na modal e num popup ao clicar no valor do histórico (tarifa do Asaas pelo meio usado, taxa GestaraHub fixa, aviso de estimativa no link não pago e de repasse). A modal mostra três linhas: "Aluno paga", "Taxas" e "Você recebe"; no link, taxas e líquido aparecem como faixa ("R$ 120,01 a R$ 120,27", débito a crédito) e o popup das taxas detalha cada meio. O histórico da subconta tem uma coluna "Taxas"; link ainda não pago mostra "até" nas taxas e "a partir de" no líquido; pago mostra "Link · Crédito" ou "Link · Débito" com os valores reais. Cobranças anteriores à coluna de tarifa somam só a taxa GestaraHub.

### Decidido em 22/10/2026: validade, cron e página do aluno

- **O Asaas aceita pagamento até 12 meses depois do vencimento** (o QR dinâmico vale esse tempo). A validade do GestaraHub (24h por padrão) só vale porque o app **cancela a cobrança no Asaas** quando ela vence: um cron de hora em hora (`online-payments-expiry`, migração 34) faz isso para todos os espaços numa consulta só, pelo índice parcial dos pagamentos em aberto. As telas "Cobrar online" e o histórico de recebimentos também expiram ao abrir.
- **Página do aluno** (`/p/<código>`, migração 35): cada pagamento online tem um código curto e aleatório, e as mensagens (o "Enviar pelo WhatsApp" do Cobrar online e o lembrete da cobrança) levam esse endereço em vez do Pix solto ou do link do Asaas. A página mostra o nome do espaço, o que é cobrado e o valor, nunca dados do aluno:
  - em aberto, Pix: QR, código copia e cola e "Copiar código Pix", com a validade;
  - em aberto, cartão: segue direto para a fatura do parceiro;
  - vencido, cancelado ou substituído: "Este link venceu. Peça um novo para {espaço}";
  - pago: "Esta cobrança já está paga".
  A primeira abertura fica gravada (`opened_at`), para mostrar depois quem viu a cobrança. A página não substitui o cancelamento no Asaas: o código copiado continua pagável no banco até o cron cancelar.

### A decidir
- **Pendente (21/10/2026): e-mail do webhook.** Definir `ASAAS_WEBHOOK_EMAIL` com um e-mail do domínio `gestarahub.com.br` (por exemplo, `integracoes@gestarahub.com.br`) no `.env.local` e nas variáveis da Vercel. Até lá, o cadastro usa o e-mail da conta principal do Asaas. Depois de trocar, os webhooks já cadastrados não mudam sozinhos: é preciso recadastrar (trocar a URL ou rodar o cadastro de novo).
- **Estorno:** desfazer pagamento online não é permitido na demonstração ([DECIDIR] no doc 05, seção 6.4).
- **Pix Automático exige CNPJ ativo há pelo menos 6 meses** (registrado no doc 05). Espaços com CPF ou CNPJ novo ficam com Pix e link avulsos.
- **Cartão de crédito** para o aluno: entra agora ou depois?

## 5. Provedores de pagamento (a validar)

O ideal é **um provedor para os fluxos 1 e 3**: assinatura, subcontas, split e Pix Automático no mesmo lugar.

### 5.1 Provedor Escolhido: Asaas (19/10/2026)
O **Asaas** foi o provedor escolhido por cobrir com maturidade todos os requisitos técnicos e comerciais:
1. **API de Subcontas e Split nativo:** Criação de subcontas filhas via API para cada academia, com retenção automática da taxa do GestaraHub na liquidação de cada mensalidade (sem que o dinheiro transite pela conta bancária da plataforma).
2. **Pix e Pix Automático:** Suporte a Pix avulso com baixa imediata e documentação para cobrança recorrente.
3. **Compatibilidade com Supabase Serverless (Edge Functions):** Autenticação por API Key (Bearer Token) simples, sem exigir certificado digital de cliente `.p12`/mTLS ou IP fixo.
4. **Assinatura da Plataforma:** Cobrança recorrente dos planos Pro e Scale no mesmo provedor.

### Critérios técnicos (backend serverless no Supabase, ver [../technical/08-backend-supabase.md](../technical/08-backend-supabase.md))

O backend roda em funções serverless (Edge Functions), sem servidor sempre ligado. O provedor precisa caber nisso:

- **Autenticação por chave de API simples.** Provedor que exige **certificado digital de cliente na conexão** (mTLS) precisa de teste antes: pelo que levantamos, a API Pix da Efí pede certificado; Asaas e Iugu usam chave de API. Confirmar se as Edge Functions conseguem usar o certificado; se não, esse provedor sai ou exige um intermediário.
- **Sem exigência de IP fixo.** Funções serverless não têm endereço de saída fixo. Se o provedor só aceitar chamadas de IPs liberados, precisa de um intermediário (custo e manutenção a mais).
- **Avisos (webhooks) com identificador do evento e assinatura**, para tratar repetidos e conferir a origem.
- **Consulta de status por API**, para a conferência diária das cobranças que ficaram sem aviso.

## 6. Ordem sugerida

1. Escolher o provedor (seção 5), já pensando nos fluxos 1 e 3.
2. **Fluxo 1** (assinatura): é o que paga o GestaraHub, e o Pro libera os outros dois.
3. **Fluxo 2** (WhatsApp): junto com a integração real ([07](../technical/07-integracao-whatsapp.md)).
4. **Fluxo 3** (mensalidade online com split): o maior ganho para o espaço e a "taxa transacional" do modelo de negócio.

## 7. Fontes

- [Meta: preços da WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/pricing)
- [Hyperleap: calculadora de preços do WhatsApp no Brasil (2026)](https://hyperleap.ai/whatsapp-pricing-calculator-brazil)
- [Message Central: preços da API do WhatsApp no Brasil](https://www.messagecentral.com/blog/whatsapp-business-api-pricing-brazil)
- [Asaas: Pix Automático](https://docs.asaas.com/docs/pix-automatico) e [Assinaturas](https://docs.asaas.com/docs/assinaturas-recorrência)
- [Asaas: diferença entre Pix Automático e Assinaturas](https://docs.asaas.com/docs/diferença-entre-pix-automático-e-assinaturas)
- [Iugu: guia do Pix Automático](https://marketing.iugu.com/guiapixautomatico)
- [Efí: SDK oficial](https://github.com/efipay/sdk-php-apis-efi)
- [Banco Central: guia do Pix Automático](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/guia_pix_automatico.pdf)
- [Let's Money: Pix Automático completa um ano](https://www.letsmoney.com.br/noticias/pagbrasil-pix-automatico-um-ano-recorrencia/)
