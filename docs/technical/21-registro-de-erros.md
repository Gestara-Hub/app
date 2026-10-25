# 21. Registro de erros

Data: 2026-10-23. Status: feito (migração 47).

## 1. Decisão

Os erros ficam no nosso banco (`error_logs`), sem serviço externo: nada a contratar, os dados não saem da nossa infraestrutura (LGPD) e a busca é por SQL, por espaço, usuário ou código. Toda linha também sai no log da Vercel: o banco é a cópia pesquisável, não a única (quando o erro é o próprio banco fora do ar, a gravação lá falha).

Fica para depois, só se precisar: um serviço de rastreio (Sentry) para ler erros do navegador com o código-fonte original (aqui chegam com o código minificado), e um *log drain* da Vercel para guardar todos os logs, não só os erros.

## 2. Como usar no código

Uma porta só, no servidor e no navegador (`@/lib/log`). **Não usar `console.error`/`console.warn` para erro.**

```ts
import { logError, logWarn, reportError } from "@/lib/log";

logError("[billing] Cobrança não gravada:", err);            // mesma forma do console.error
logWarn("[asaas] Resposta inesperada:", status, body);       // nível aviso
const code = await reportError("cron.daily.mensalidades", err, { source: "cron", organizationId });
```

- `"[evento] texto"`: o que vem entre colchetes vira o evento (onde aconteceu).
- `reportError` devolve o **código do erro** (8 letras e números, como `K7Q2M9XD`) e aceita espaço, origem e contexto. Use quando quem chama sabe o espaço (rotinas) ou precisa mostrar o código.
- Registrar nunca lança nem derruba a operação.
- Continuam no console, de propósito: o conflito de gravação (a ação tenta de novo; é o funcionamento normal), o log de tempo das ações lentas (doc 19) e o link de cadastro/nova senha sem chave do MailerSend (desenvolvimento).

## 3. O que acontece com um erro

| Onde | O que é registrado |
| --- | --- |
| Ação do servidor (`runAction`) | Erro inesperado (não é regra de negócio) com o método (`turmas.markAttendance`), espaço e usuário da sessão. A mensagem ao usuário leva **"Código do erro: K7Q2M9XD."** |
| Rota, página ou ação que estourou (`onRequestError`) | Erro com a rota e o método HTTP |
| Rotinas (diária, de hora em hora, parabéns) | Origem `cron`, com o espaço que falhou |
| Webhook do Asaas | Origem `webhook` |
| Navegador | Telas de erro (mostram o código), erro sem tratamento e promessa rejeitada. Só de quem está logado; espaço e usuário saem da sessão, nunca do que o navegador manda. Limite de 30 por usuário a cada 10 minutos, e o mesmo erro sai no máximo uma vez por minuto de cada navegador |
| Os ~150 `logError`/`logWarn` do código | Com o espaço e o usuário da requisição, quando houver sessão |

**Conferido no navegador (23/10/2026):** ação com falha forçada mostrou "Código do erro: …" no aviso e gravou a linha com o mesmo código, o método, o espaço e o usuário da sessão; erro forçado na tela mostrou o código na tela de erro e gravou como `browser.render`, com a tela e o espaço da sessão (as duas tentativas de renderização do React somaram na mesma linha). A conferência achou que o destino ligado no `instrumentation.ts` não chegava às ações (o Next compila o `instrumentation.ts` num pacote separado, com outra cópia do módulo): destino e escopo ficam no objeto global do processo.

**Avisos do navegador ignorados:** "ResizeObserver loop…" (o navegador adiando uma medida, benigno) e "Script error." (erro sem detalhes de script de outro domínio) chegam como erro da página e não são defeito; o ouvinte de erros sem tratamento não os registra (os e2e pegaram: eles falham com qualquer erro no console).

**Escopo da requisição:** `runAction` abre um escopo e `requireTenant` anota nele o espaço e o usuário. Qualquer `logError` dentro da ação grava com o espaço certo, sem passar contexto de mão em mão (`lib/log/server-sink.ts`, `AsyncLocalStorage`). Ligado no `instrumentation.ts`.

## 4. A tabela `error_logs`

- **Agrupada por impressão digital:** evento + mensagem sem ids e números + o local no código. O mesmo erro vira uma linha por espaço, com `count`, `first_seen`, `last_seen`, o último `last_reference` (código) e o último usuário. Um erro em laço não gera milhares de linhas.
- **Mascarada antes de gravar** (`lib/log/mask.ts`): CPF, CNPJ, telefone, e-mail, token, JWT, chave do Asaas e do MailerSend, senha; em objetos, chaves como `password`, `token`, `cpf`, `authorization` viram `[oculto]`. Mascarar demais é aceitável; de menos, não.
- **Acesso:** só o servidor (chave de serviço). RLS ligado e sem políticas para a sessão.
- **Retenção:** 120 dias sem acontecer de novo (`error-logs-prune-daily`, pg_cron, 03:40 de Brasília).

## 5. Resumo diário por e-mail

Na rotina diária: os erros **novos ou que voltaram** nas últimas 24 horas (no máximo 30 no corpo, mais o total), com contagem, origem, evento, espaço e código. Vai para `ERROR_DIGEST_EMAIL` (vazio = não envia). Cada erro sai uma vez; se acontecer de novo depois do aviso, entra no próximo resumo.

## 5.1. O que cada erro guarda (25/10/2026)

- **Pilha:** até 8.000 caracteres, mascarada (antes era cortada em 2.000, e os quadros do app costumam vir depois dos do framework).
- **Contexto automático** em todo erro de ação de servidor: `route` (tela de onde saiu, pelo `Referer`, anotada em `requireTenant`), `profile` e `plan` da sessão, `ms` (tempo da requisição até o erro) e, em todo erro de servidor, `release` (7 primeiros caracteres do commit, `VERCEL_GIT_COMMIT_SHA`). O que quem chamou passa em `context` vale mais.
- **Detalhe do banco:** `dbError("onde", error)` de `@/lib/log` no lugar de `new Error(\`onde: ${error.message}\`)`: a causa leva `code`, `details` e `hint` do Postgres/Supabase. O código fica **dentro da causa**, nunca como `code` do `Error`, porque `isApiError` só olha `code` e `message` e passaria o erro por regra de negócio (sem registro). Resposta de API de fora: passe o status e o corpo ao `logError` (o do aviso de chamado do suporte agora faz isso).
- **Histórico:** `public.error_occurrences` (migração `…064`) guarda as 20 ocorrências mais recentes de cada erro, cada uma com o seu código, mensagem e contexto da hora. `error_logs` segue uma linha por erro (a última sobrescreve); a busca por código (painel) olha as ocorrências, então o código que o cliente viu continua achando o erro depois que ele se repete. As ocorrências somem junto com o erro (120 dias).
- **Painel:** a tela do erro mostra os quadros do app primeiro (framework e Node recolhidos), o contexto com rótulos (Tela, Perfil, Plano, Versão do app, Tempo, Código do banco, Detalhe, Dica) e a lista das últimas ocorrências.

- **Rastreio por pessoa e relato (25/10/2026, doc 26):** `error_occurrences.user_id` alimenta a linha do tempo da pessoa no painel (`/health/users/[userId]`); a ocorrência cujo código está numa conversa de suporte não é apagada pelo limite de 20; o andamento do bug (`support_threads.bug_status`, `fixed_in`, `fixed_at`) compara com as ocorrências para avisar quando o erro volta.

Decidido em 25/10: **source maps de produção ficam de fora por ora.** O build mostrou que o servidor gera os mapas, mas eles não entram no pacote do deploy (0 `.map` no rastreio de arquivos) e a nossa pilha gravada não é traduzida sozinha; além disso, a máscara de "token" apaga nomes de arquivo de 40 ou mais caracteres na pilha (`chunks/[token]._.js`), o que já atrapalha hoje. Se voltar: ajustar a máscara nos quadros, traduzir pelo `.map` ao lado do arquivo (`module.SourceMap`, validado) e incluir os `.map` no `outputFileTracingIncludes` (conferir num preview na Vercel).

- **Rastro de passos (25/10/2026):** o navegador guarda na memória da aba os últimos 30 passos (`lib/breadcrumbs.ts`): telas abertas (caminho com ids trocados por `:id`, anotadas pelo `CrumbTracker`) e o **nome fixo** de cada ação do servidor, com erro ou sem (o `runAction` devolve `event` no resultado e o `unwrap` anota). **Nunca** texto digitado, valor de campo nem rótulo de botão. Os passos (até 20, tempo em segundos antes do envio) vão em três casos: (1) erro de ação com código: o `unwrap` manda `attachBreadcrumbsAction` e a função `error_attach_breadcrumbs` completa a ocorrência (mesma pessoa e espaço, uma vez só); (2) erro do navegador: vão no contexto; (3) relato de problema: `support_threads.breadcrumbs`. O servidor mascara e limita tudo (`sanitizeCrumbs`). No painel: card "Passos antes do erro" na tela do erro e "Passos antes do relato" na conversa (migração `…068`).
- **Máscara da pilha:** `maskStack` não aplica a regra de token longo às linhas de quadro (antes o nome do arquivo do pacote virava `[token]`); chave de formato conhecido ainda sai.

Falta: nada do levantamento de 25/10, além dos source maps (decididos fora acima). Cliques e navegação fora das telas e ações do servidor não entram no rastro.

## 6. Como investigar

- **Usuário mandou um código:**
  ```sql
  select e.* from error_logs e join error_occurrences o on o.error_id = e.id where o.reference = 'K7Q2M9XD';
  ```
  (`last_reference` só guarda o último código; as ocorrências guardam os 20 mais recentes.)
  O mesmo código está na linha JSON do log da Vercel (campo `reference`), com a pilha.
- **Erros de um espaço:** `select event, message, count, last_seen from error_logs where organization_id = '<id>' order by last_seen desc;`
- **O que mais acontece:** `select event, message, sum(count) from error_logs where last_seen > now() - interval '7 days' group by 1, 2 order by 3 desc;`
- **Vercel:** aba Logs do projeto (retenção curta, conforme o plano); em produção cada erro é uma linha JSON (`level`, `event`, `message`, `reference`, `organizationId`, `context`, `stack`).
- **Supabase:** Logs do painel (API, Postgres, Auth), rotinas agendadas em `cron.job_run_details`, consultas lentas em *Query Performance*.

## 7. Testes

- `lib/log/__tests__/log.test.ts`: máscara, impressão digital, a porta única e o destino que falha; pilha longa, `dbError` (causa com código, sem `code` próprio) e versão do app.
- `services/server/__tests__/errorLogs.db.test.ts`: ação com erro (código na mensagem, espaço e usuário da sessão, o mesmo erro soma), erro de regra fora do registro, navegador sem sessão (não grava) e com sessão (espaço da sessão, mascarado), resumo diário; uma ocorrência por código com o contexto da hora (perfil, plano, tempo, causa do banco) e o teto de 20.

**Ligação com a Auditoria (23/10/2026, doc 23):** quando uma tarefa em segundo plano falha num espaço, a Auditoria ganha uma linha "falhou" com o mesmo código (`audit_logs.error_reference`), e as execuções e os avisos do Asaas guardam os códigos (`job_runs.error_references`, `webhook_events.error_reference`).
