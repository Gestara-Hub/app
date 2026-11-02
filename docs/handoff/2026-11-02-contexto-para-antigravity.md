# Contexto para continuar (02/11/2026, manhã)

Passagem da sessão do Claude Code para o Antigravity. Tudo está em `main`, commitado e **não enviado** (413 commits à frente de `origin/main`; o dono é quem dá o push). Árvore limpa. Regras da sessão: só typecheck e lint a cada mudança (Vitest quando muda regra de serviço, testes de banco só em mudança do motor ou de migração); e2e fica para a rodada final, anotado em `docs/pendencias.md`, "Testes deixados para o fim"; commit pequeno por assunto, sem push; português direto, sem travessão; nunca credencial, CPF ou nome de cliente em código, log ou doc.

## 1. O que está para acontecer agora

O dono vai **começar o teste manual geral** pelo roteiro [`../qa/2026-11-02-roteiro-academia-artes-marciais.md`](../qa/2026-11-02-roteiro-academia-artes-marciais.md) (versão em slides no `.html` ao lado, gerada por `pnpm --filter @gestarahub/web qa:roteiro`). São 16 etapas; ele faz uma por vez no navegador e avisa "Etapa N feita" com as anotações. O agente confere no banco local o que a etapa deveria ter gravado (cada etapa lista as tabelas) e responde item a item. Achados vão para a tabela "Achados" no fim do roteiro, com gravidade e commit da correção; não corrigir no meio da etapa.

Como consultar o banco local:

```bash
docker exec -i supabase_db_gestarahub psql -U postgres -d postgres -Atc "select ... "
```

Ambiente para o teste: `pnpm reset:all` (zera o banco e grava os segredos do cron; `--demo` recria a demonstração), depois `pnpm tunnel` num terminal e `pnpm dev` em outro, nessa ordem (o Next lê o `.env.local` ao subir; o túnel grava a URL do webhook do Asaas lá). Guia: `docs/guides/16-ambiente-local.md`. O dono ainda **não decidiu** se zera o banco (apaga o espaço Jessy, que tem Asaas e WhatsApp ativos) ou se cria o espaço novo mantendo o Jessy.

## 2. O que foi feito em 01 e 02/11 (commits em `main`)

**Recebimentos online (Asaas sandbox), 01/11.** Tela antes de ativar vende o Pix (hero com o fluxo, 3 passos, "Quanto você recebe", taxas compactas, `online-payments-onboarding.tsx`); tabela de taxas por forma com a taxa do plano; ativação com asteriscos, erro do parceiro no campo com foco e **mensagem neutra** (o texto cru "e-mail já em uso" era vazamento; `safeActivationError` em `subaccountActions.ts`); **chave Pix criada na ativação** e, no primeiro Pix, criada e tentada de novo (`ensureSubaccountPixKey`, `asaasAdapter.ts`; antes o primeiro Pix falhava e só o segundo saía); baixa pela rotina auditada como a do webhook; tour da tela uma vez por navegador depois de ativar (`ProductTour`, chave `gestarahub_tour_online_payments`). "Simular liquidação (Sandbox)" usa recebimento em dinheiro no Asaas: sem tarifa e sem saldo, **mantido assim** (doc technical/25 §4).

**Financeiro, 01/11.** Decisão do dono: **taxas do pagamento online como saída**. Categoria de sistema `online_fees` ("Taxas de pagamento online", migração `20261101000082`, aplicada no banco local); a cobrança entra cheia e a taxa que ficou com o espaço sai no dia do pagamento (`onlineFeeCents` em `services/finance/cashFlowSources.ts`); linha única por mês em Lançamentos, "Deduções" do DRE, e o card "Saiu" abre um popover (taxas, demais saídas, total) quando há taxa. Doc technical/05 §4.3.

**WhatsApp, 01/11.** Boas-vindas saem sozinhas no cadastro quando o oficial está conectado e o modelo ligado (`client-form.tsx`, `useWhatsAppSend` com `reviewed: true`; no assistido continua o botão). Envio oficial **em segundo plano**: registro "Na fila" (`queued`), Meta chamada depois da resposta (`afterWorldCommit` + `after()` do Next em `runWorld.ts`, `messageDelivery.ts` atualiza a linha: id vira o da Meta, "Enviada" ou "Falhou"). Motivo: as chamadas de uma aba ao servidor rodam uma por vez e a Meta levava 3,6 s, travando a lista de alunos. Botão de teste usa modelo aprovado da conta (`welcome_student`), não `hello_world`.

**Diagnóstico da Meta (01/11, não é bug do app):** o `.env.local` aponta para a conta real "GestaraHub" (+55 92 98622-4953, número do dono, verificada, LIVE), não para o sandbox. `health_status` da conta: `can_send_message: BLOCKED`, erro **141006 "problema na forma de pagamento"**: conversas iniciadas pela empresa (modelos) são aceitas e nunca entregues até corrigir o cartão no WhatsApp Manager. Texto livre dentro da janela de 24 h chega. Nenhum app está inscrito nos webhooks da conta (`subscribed_apps` vazio): falhas nunca chegam, o Histórico fica "Enviada". O número de testes da Meta (+1 555-672-0807, outra conta que o mesmo token acessa) funciona com `hello_world`. Os ids de sandbox estão comentados no `.env.local`; o cadastro guiado (`NEXT_PUBLIC_META_*`) está comentado, então "Conectar WhatsApp oficial" conecta direto. Doc technical/07.

**Docs e decisões, 02/11.** Roteiro de teste (16 etapas, paginação coberta com mais de 10 itens por lista). **Nota fiscal** (technical/24 §7): assinatura com NFS-e automática a cada pagamento (`invoiceSettings` do Asaas), taxa por transação numa nota avulsa mensal por espaço; tarifa do Asaas e mensalidade do aluno não são nota nossa; depende da parte fiscal da conta principal com o contador. **Revisão jurídica** (product/27): identificação da MHMJ obrigatória, lacunas dos textos, exigências da Meta (opt-in, opt-out "SAIR", URL de exclusão de dados) e do Asaas (conta-pai PJ, homologação após o período de avaliação, confirmação anual).

**Jurídico aplicado, 02/11.** Dados da empresa em `config/site.ts` (`COMPANY_NAME`, `COMPANY_CNPJ`, `COMPANY_ADDRESS`, `LEGAL_FORUM` = Comarca de São Paulo). Termos e Privacidade **v1.1** (`CURRENT_PLATFORM_TERMS_VERSION = "v1.1-2026-11"`: todo usuário aceita de novo ao entrar): partes, arrependimento de 7 dias, cancelamento mensal e anual, instruções à operadora, autorização de WhatsApp, incidentes em até 72 h, entrada com Google, suboperadores nomeados, seção `/privacy#exclusao`, encarregado = MHMJ com `contato@`. Contrato de ativação com a MHMJ; rodapé da landing em dois andares; `PublicLegalFooter` na fatura pública, verificação de certificado e termo do menor; rodapé dos e-mails.

**Outros, 01 e 02/11.** Auditoria (cores só na ação, grupos por dia, filtros, drawer), Usuários (lista/cartões, "Ativos" padrão), Relatórios (lista por categoria, mês dentro do relatório), sidebar recolhida sem roubar clique; **tema**: o provedor de preferências não veta mais o botão da landing (reaplicava "Sistema" a cada mudança, inclusive de outra aba); o botão grava a escolha nas preferências e, com sessão, na conta (`saveThemePreference`). `pnpm reset:all`.

## 3. Pendente e em aberto

- **Decisões do dono em aberto:** envio oficial por modelo aprovado quando o gatilho tem modelo (boas-vindas, aniversário, cobrança), hoje só texto livre; zerar o banco ou manter o Jessy.
- **Na Meta, fora do código:** corrigir a forma de pagamento da conta (141006); inscrever o app nos webhooks e apontar a URL (`<túnel>/api/webhooks/whatsapp`, token em `WHATSAPP_WEBHOOK_VERIFY_TOKEN`); cadastrar Termos, Privacidade e `/privacy#exclusao` no app da Meta.
- **Produto:** consentimento e opt-out de WhatsApp no cadastro do aluno; zona de perigo da LGPD (doc 24); NFS-e (technical/24 §7); confirmar região do Supabase e do PostHog no texto de transferência internacional.
- **Antes de produção:** conta-pai PJ no Asaas, homologação, confirmação anual; `docs/pendencias.md`, "Antes de ir para produção".
- **e2e deixado para o fim:** lista completa em `docs/pendencias.md`, "Testes deixados para o fim" (auditoria, tabela de taxas, landing de recebimentos, tour, taxas como saída, boas-vindas automáticas, fila de envio, termos v1.1, tema com conta logada, entre outros).

## 4. Onde está cada coisa

| Assunto | Doc |
| --- | --- |
| Pagamento online e Asaas | `technical/25-pagamento-online.md` |
| WhatsApp e Meta | `technical/07-integracao-whatsapp.md` |
| Financeiro (taxas como saída) | `technical/05-modulo-financeiro.md` §4.3 |
| Plano GestaraHub e nota fiscal | `technical/24-plano-gestarahub.md` §7 |
| Jurídico | `product/27-juridico-termos-e-identificacao.md` |
| Padrões de tela (drawers, tour, auditoria) | `frontend/07-padroes-telas-e-ux.md`, `frontend/06-decisoes-de-interface.md` |
| Roteiro de teste | `qa/2026-11-02-roteiro-academia-artes-marciais.md` e `.html` |
| Pendências | `pendencias.md` |
