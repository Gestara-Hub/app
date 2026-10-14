# 19 — Levantamento: pagamentos

> **Status:** 13/10/2026. **Levantamento**, não decisão. Reúne o que precisa ser decidido sobre dinheiro antes e durante o backend, com recomendações e o que falta validar. As decisões tomadas a partir daqui viram ADR (skill `adr`) neste documento ou no 13.
> Base: modelo de negócio em [13-modelo-de-negocio.md](13-modelo-de-negocio.md); pagamento online simulado em [../technical/05-modulo-financeiro.md](../technical/05-modulo-financeiro.md), seção 6; WhatsApp em [../technical/07-integracao-whatsapp.md](../technical/07-integracao-whatsapp.md).

## 1. Os três fluxos de dinheiro

| # | Quem paga | Quem recebe | O quê | Hoje no mock |
|---|---|---|---|---|
| 1 | Espaço | GestaraHub | Assinatura do plano (Pro, Scale) | Troca de plano livre em Configurações, sem cobrança |
| 2 | GestaraHub | Meta (ou parceiro) | Mensagens do WhatsApp oficial | Franquia contada (`monthlyQuota`), sem custo real |
| 3 | Aluno | Espaço (com taxa do GestaraHub) | Mensalidade online: Pix, link, Pix Automático | Simulado (`mockPaymentGateway`) |

## 2. Fluxo 1: assinatura do GestaraHub

### A decidir
- **Preço** do Pro e do Scale (mensal e anual?). O doc 13 define os recursos, não os valores.
- **Formas de pagamento:** cartão recorrente, **Pix Automático** e boleto. Pix Automático é o caminho natural no Brasil para assinatura: o pagador autoriza uma vez no app do banco e pode revogar ali; não ocupa limite de cartão.
- **Período de teste** do Pro (ex.: 14 dias) e o que acontece no fim.
- **Troca de plano:** subir na hora, com valor proporcional? Descer no fim do período?
- **Falta de pagamento:** prazo de carência e depois volta ao Grátis **sem perder dados** (os recursos Pro só ficam bloqueados).
- **Nota fiscal de serviço** (NFS-e) de cada fatura e impostos: pelo provedor de pagamento ou por um emissor à parte.
- **Requisito:** o GestaraHub precisa de CNPJ e conta para receber. Ver o requisito de tempo de CNPJ do Pix Automático na seção 4.

### Impacto no contrato
`Subscription` hoje só tem `tier`. Vai precisar de: situação (ativa, em atraso, cancelada, em teste), fim do período atual, forma de pagamento, histórico de faturas e o identificador da assinatura no provedor.

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

| Provedor | O que a pesquisa confirmou | A validar |
|---|---|---|
| Asaas | Assinaturas (boleto, Pix, cartão) e Pix Automático na API, com geração automática das cobranças pela autorização | Split e subcontas **combinados com Pix Automático** |
| Iugu | Pix Automático em dois modelos: ela cuida do ciclo da assinatura, ou só o trilho (autorização e liquidação) e o ciclo fica conosco | Split, subcontas e preço |
| Efí | SDK oficial cita Pix Automático para assinatura e split de pagamentos | Se funcionam juntos |
| Vindi, PagBrasil | Anunciam Pix Automático para recorrência | Subcontas e split |
| Pagar.me, Stripe | Não encontramos confirmação de Pix Automático nesta pesquisa | Tudo |

**Próximo passo:** pedir a dois ou três provedores (Asaas, Iugu, Efí) um exemplo de **split com Pix Automático em subconta**, testar em ambiente de testes e comparar tarifas. Esse é o ponto que mais pode mudar a escolha.

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
