# 19 — Levantamento: pagamentos

> **Status:** Atualizado em 19/10/2026. **Decisão tomada:** Provedor escolhido = **Asaas**. Preços do Pro (R$ 79,90/mês e R$ 699/ano) e Scale (R$ 199/mês e R$ 1.790/ano) aprovados. Pagamento online liberado para todos (inclusive no Grátis) com taxas transacionais via split nativo.
> Base: modelo de negócio em [13-modelo-de-negocio.md](13-modelo-de-negocio.md); pagamento online simulado em [../technical/05-modulo-financeiro.md](../technical/05-modulo-financeiro.md), seção 6; WhatsApp em [../technical/07-integracao-whatsapp.md](../technical/07-integracao-whatsapp.md).

## 1. Os três fluxos de dinheiro

| # | Quem paga | Quem recebe | O quê | Definição (19/10/2026) |
|---|---|---|---|---|
| 1 | Espaço | GestaraHub | Assinatura do plano (Pro: R$ 79,90/mês ou R$ 699/ano; Scale: R$ 199/mês ou R$ 1.790/ano) | Asaas (Assinatura por Pix Automático, Pix ou Cartão) |
| 2 | GestaraHub | Meta (ou parceiro) | Mensagens do WhatsApp oficial | Pro com franquia de 300 msgs/mês; excedente pré-pago |
| 3 | Aluno | Espaço (com taxa do GestaraHub) | Mensalidade online: Pix, link, Pix Automático | Asaas (Subconta da academia com split automático na liquidação) |

## 2. Fluxo 1: assinatura do GestaraHub

### Decisões (19/10/2026)
- **Preço:**
  - **Pro:** **R$ 79,90 / mês** ou **R$ 699,00 / ano** (desconto de ~2 meses, R$ 58,25/mês).
  - **Scale:** **R$ 199,00 / mês** ou **R$ 1.790,00 / ano**.
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

### A decidir
- **Taxa** do GestaraHub (percentual, fixa ou as duas) no Grátis e no Pro.
- **Quem paga a tarifa do provedor:** o espaço (embutida) ou o GestaraHub (descontada da taxa).
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
