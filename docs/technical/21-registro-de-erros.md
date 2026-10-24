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

## 6. Como investigar

- **Usuário mandou um código:**
  ```sql
  select * from error_logs where last_reference = 'K7Q2M9XD';
  ```
  O mesmo código está na linha JSON do log da Vercel (campo `reference`), com a pilha.
- **Erros de um espaço:** `select event, message, count, last_seen from error_logs where organization_id = '<id>' order by last_seen desc;`
- **O que mais acontece:** `select event, message, sum(count) from error_logs where last_seen > now() - interval '7 days' group by 1, 2 order by 3 desc;`
- **Vercel:** aba Logs do projeto (retenção curta, conforme o plano); em produção cada erro é uma linha JSON (`level`, `event`, `message`, `reference`, `organizationId`, `context`, `stack`).
- **Supabase:** Logs do painel (API, Postgres, Auth), rotinas agendadas em `cron.job_run_details`, consultas lentas em *Query Performance*.

## 7. Testes

- `lib/log/__tests__/log.test.ts`: máscara, impressão digital, a porta única e o destino que falha.
- `services/server/__tests__/errorLogs.db.test.ts`: ação com erro (código na mensagem, espaço e usuário da sessão, o mesmo erro soma), erro de regra fora do registro, navegador sem sessão (não grava) e com sessão (espaço da sessão, mascarado), resumo diário.

**Ligação com a Auditoria (23/10/2026, doc 23):** quando uma tarefa em segundo plano falha num espaço, a Auditoria ganha uma linha "falhou" com o mesmo código (`audit_logs.error_reference`), e as execuções e os avisos do Asaas guardam os códigos (`job_runs.error_references`, `webhook_events.error_reference`).
