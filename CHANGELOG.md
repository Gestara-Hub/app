# Changelog técnico

Gerado por `pnpm release:prepare` a partir dos commits (doc technical/27). As novidades para quem usa ficam em `apps/web/src/features/releases/release-notes.ts`.

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
