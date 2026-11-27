# Changelog técnico

Gerado por `pnpm release:prepare` a partir dos commits (doc technical/27). As novidades para quem usa ficam em `apps/web/src/features/releases/release-notes.ts`.

## 2026.11.27-3 (2026-11-27)

Desde v2026.11.27-2.

### Novo

- ui: sinal de carregamento ao abrir outra tela e ao reler dados guardados

### Correções

- classes: gaveta de cancelar matrícula com o nome do aluno só no cabeçalho

## 2026.11.27-2 (2026-11-27)

Desde v2026.11.27.

### Novo

- admin: chave da conta de recebimento sem valer em Saúde e no espaço
- online-payments: aviso de recebimento parado e cadastro da chave nova pelo espaço
- online-payments: chave da subconta em uso semanal e avisos ACCESS_TOKEN_* do Asaas

## 2026.11.27 (2026-11-27)

Desde v2026.11.26.

### Novo

- classes: cancelar matrícula pergunta o plano, as cobranças e o estorno; cobrança da turma trava só com aluno ativo
- ui: gravação só termina com a tela atualizada e barra fina enquanto salva

### Testes

- e2e: linha paga com recibo, estorno e desfazer no menu ⋮

### Correções

- two-factor: prazo da prova do segundo fator no relógio do banco
- auth: sair encerra só a sessão deste aparelho

### Documentação

- business-model: taxa em percentual sem aviso a espaços antigos

## 2026.11.26 (2026-11-26)

Desde v2026.11.25-9.

### Documentação

- pendencias: aviso da taxa nova, estorno fase 2 e telas em tempo real

### Novo

- online-payments: histórico com aluno, busca, ações, estornos e versão de celular
- billing: estornar pagamento pelo app, botão Atualizar em Cobranças e selo do código gerado
- plans: taxa do GestaraHub em percentual com mínimo e teto, contrato e telas

### Correções

- preferences: conta nova no mesmo navegador não herda as preferências da anterior
- dev: túnel do webhook também com o dev em https

## 2026.11.25-9 (2026-11-25)

Desde v2026.11.25-8.

### Novo

- pwa: logo pulsando na abertura no lugar da barrinha
- pwa: app instalado reabre na última tela vista da conta

### Correções

- audio: som da chamada e do sino no app instalado do iPhone depois de voltar ao app

## 2026.11.25-8 (2026-11-25)

Desde v2026.11.25-7.

### Correções

- pwa: barrinha da abertura animada e sem a barra fina do topo por cima

## 2026.11.25-7 (2026-11-25)

Desde v2026.11.25-6.

### Documentação

- pendencias: saque sem o código do Asaas para depois

### Novo

- online-payments: saque à espera do código do Asaas avisa, mostra o valor reservado e leva à conta
- pwa: abertura cobre a primeira tela até as leituras terminarem
- releases: novidades agrupadas por dia

### Correções

- auth: proxy renova a sessão do banco e sessão vencida leva ao login com aviso
- ui: botão do rodapé que não cabe desce para uma linha inteira no celular e saque com Transferir

## 2026.11.25-6 (2026-11-25)

Desde v2026.11.25-5.

### Novo

- classes: cobrança travada na 1ª matrícula, inativar bloqueado com alunos ativos e duplicar turma
- online-payments: tela espera a situação do Asaas, tour na conta e Já criei a senha
- preferences: boas-vindas, tours e dicas vistos ficam na conta, valem em qualquer aparelho

### Correções

- online-payments: Cobrar online mostra o código gerado na hora, com o aviso junto
- online-payments: webhook das subcontas sem os avisos de Pix Automático, lista essencial se o Asaas recusar e nova tentativa só depois de 6 horas
- onboarding: Entendi visível na faixa Comece por aqui no tema escuro

## 2026.11.25-5 (2026-11-25)

Desde v2026.11.25-4.

### Correções

- admin: selo Aviso em âmbar na tela de erros
- online-payments: chave Pix só com a conta aprovada no Asaas e aviso claro antes disso
- tour: tour só começa sem janela aberta, depois de Conta criada e do pedido de proteger o acesso
- online-payments: ativar sem o aceite leva o foco e a rolagem até a caixa dos termos

### Documentação

- online-payments: análise da conta no Asaas e avisos marcados para depois

### Novo

- online-payments: situação real da conta no Asaas, cartão Deixe sua conta pronta e avisos das subcontas

## 2026.11.25-4 (2026-11-25)

Desde v2026.11.25-3.

### Documentação

- pwa: abertura, aviso de versão e recursos do app instalado para depois

### Novo

- pwa: aviso de nova versão ao voltar para o app
- pwa: tela de abertura do app instalado com a logo enquanto o painel carrega

## 2026.11.25-3 (2026-11-25)

Desde v2026.11.25-2.

### Novo

- log: erros do navegador também nas telas sem login, com limite por IP

### Correções

- admin: leitura das notas fiscais do plano pelo painel (migração 109), a aba Assinatura do espaço quebrava
- log: toda ação do servidor registra o erro com o espaço e o usuário
- log: alerta de erro novo sai mesmo quando a ação já respondeu
- online-payments: abertura da subconta espera até 2 minutos e conta aberta sem chave avisa a equipe

### Documentação

- online-payments: passos de acesso ao Asaas com o e-mail de boas-vindas e o prazo do link

## 2026.11.25-2 (2026-11-25)

Desde v2026.11.25.

### Documentação

- pendencias: telas para conferir depois dos ajustes de 25/11

### Novo

- communication: mensagens em lista como Relatórios e prazo e horário só com o WhatsApp oficial
- core: celular sem o 9 recusado nos formulários
- layout: termos de uso e privacidade no menu da conta

### Correções

- settings: configurações em largura inteira, nome e área lado a lado e fuso com nomes curtos
- forms: endereço pela largura do bloco, CEP com traço e celular sem aperto ao ativar recebimentos

## 2026.11.25 (2026-11-25)

Desde v2026.11.24.

### Documentação

- subscription: respostas da contabilidade, e-mail da nota e trabalho à mão no Asaas

### Novo

- subscription: cancelamento com devolução pelo suporte e texto claro no Voltar ao Grátis
- subscription: e-mail da nota emitida, uma nota por pagamento e conferência diária
- support: pedido direto para a equipe, sem o assistente

## 2026.11.24 (2026-11-24)

Desde v2026.11.22.

### Novo

- legal: versão 1.3 dos termos e da privacidade para a revisão da Meta

## 2026.11.22 (2026-11-22)

Desde v2026.11.19.

### Correções

- whatsapp: variáveis de texto da biblioteca da Meta com até 30 caracteres

### Novo

- subscription: nota fiscal (NFS-e) do plano pelo Asaas
- db: tabela platform_invoices para as notas fiscais do plano
- subscription: estorno do plano volta ao Grátis e fatura discreta até 5 dias antes

### Outros

- usar o Chrome do runner no e2e e tentar de novo o download

## 2026.11.19 (2026-11-19)

Desde v2026.11.18.

### Correções

- online-payments: recadastrar o webhook das subcontas quando o token muda
- communication: telefone com DDI fora das faixas conhecidas e modelos ao atualizar em segundo plano
- settings: fuso do espaço novo pelo aparelho de quem cria a conta
- online-payments: saque via Pix sem repetir
- subscription: checkout do plano sem assinatura órfã e com e-mails próprios
- communication: status do WhatsApp só avança e leitura marca as anteriores

### Novo

- subscription: Pix Automático na assinatura do plano
- communication: avisos automáticos esperam a aprovação dos modelos na Meta
- online-payments: passos de acesso ao Asaas depois de ativar

### Outros

- reservar as portas do Supabase local fora da faixa de conexões de saída

### Documentação

- lgpd: permissão do Asaas para encerrar subcontas

### Desempenho

- chamadas externas em segundo plano, com tempo limite e novas tentativas

## 2026.11.18 (2026-11-18)

Desde v2026.11.16-2.

### Documentação

- whatsapp: situação na Meta, modelos mestres e reconexão
- email: retorno de bounce e reclamação do SES
- whatsapp: passo a passo da Meta e decisão do cadastro incorporado
- whatsapp: credenciais, envio por modelo e avisos por espaço
- invoice phase 1 spec, subaccount closing and account deletion plan

### Correções

- communication: selecionar todos espera a lista de alunos carregar
- communication: teste de envio no padrão dos formulários, sem número real
- whatsapp: reconectar número já ativo sem registrar o PIN de novo
- whatsapp: texto maior no lembrete de evento para a Meta aceitar
- whatsapp: conexão pela Meta salva o número e envia os modelos em segundo plano
- reminders: painel de Lembretes fecha ao abrir um link
- layout: fundo não rola com o menu aberto no celular
- layout: cartão do plano fecha o menu no celular
- whatsapp: abrir o WhatsApp na mesma janela no app instalado
- e2e: sessão vencida sem 500 na leitura da conta de pagamento e menu da linha à espera do Acompanhamento
- e2e: corrigir condições de corrida no smoke de cobrança online e graduação

### Novo

- whatsapp: modelos mestres, com a cobrança pela biblioteca da Meta
- whatsapp: situação do número na Meta dentro do sistema
- whatsapp: sem franquia de mensagens; o espaço paga a Meta direto, explícito no app
- plans: Expansão fora do checkout e da troca de plano
- layout: arrastar da borda esquerda abre o menu no celular
- plans: Expansão fora da vitrine e frase da taxa mais simples
- subscription: endereço de cobrança obrigatório no checkout do plano
- communication: WhatsApp oficial pelo número de cada espaço
- contracts: conexão do WhatsApp por espaço e campos do modelo da Meta
- db: guardar modelo da Meta nos registros e nos modelos de mensagem
- db: credenciais do WhatsApp de cada espaço no Vault
- releases: adicionar badge de versão nos cabeçalhos de novidades
- admin: exibir versão da aplicação no rodapé da barra lateral

### Manutenção

- supabase: login local também em https
- release: 2026.11.17

### Desempenho

- world: silenciar aviso de tempo de ações lentas por padrão

## 2026.11.16-2 (2026-11-16)

Desde v2026.11.16.

### Documentação

- release: mapear fluxo de PR, changelog e tags

### Correções

- auth: ler claims de access_token sem acessar session.user
- world: usar PT409 em conflitos otimistas para evitar loop no PostgREST
- settings: prevent mobile horizontal overflow in business hours dialog
- help: replace Date.now timers in on-screen guide

### Novo

- ui: barra global de carregamento nas rotas e esqueletos iniciais
- ui: barra e bloqueio visual ao salvar modais e drawers

### Testes

- e2e: align menu, communication, webhook and guide specs

## 2026.11.16 (2026-11-16)

- Primeira versão marcada.
