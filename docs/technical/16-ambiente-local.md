# 16 — Ambiente local

> **Status:** 21/10/2026. Como subir o GestaraHub com o Supabase local num comando.

## Pré-requisitos

- Docker Desktop aberto.
- Supabase CLI (`brew install supabase/tap/supabase`).
- `pnpm install` na raiz.
- Para testar pagamentos com webhook: `brew install cloudflared`.

## Subir tudo

```bash
pnpm setup:local
```

O comando faz, em ordem:

1. confere o Docker e sobe o Supabase local, se estiver parado;
2. aplica as migrações pendentes (`supabase migration up`);
3. preenche no `apps/web/.env.local` as variáveis do Supabase local que faltarem (URL, chave anônima e service role), sem mexer nas que já existem;
4. prepara o cron diário: cria o `CRON_SECRET` no `.env.local` e grava `app_url` e `cron_secret` no Vault do banco local (detalhes no [doc 15](15-retirada-do-mock-turmas.md), fatia 1).

Nunca imprime chaves nem segredos. Depois:

```bash
pnpm dev
```

Se o app já estava rodando e o comando criou alguma variável, reinicie o `pnpm dev`.

## Começar do zero

```bash
pnpm setup:local:reset
```

Igual ao anterior, mas zera o banco local (`supabase db reset`): **apaga todos os dados locais**, aplica todas as migrações e roda o seed. O Vault também é zerado e recriado pelo passo 4. Depois do reset, saia e entre de novo no app, porque a sessão antiga aponta para dados que não existem mais.

## Webhook do Asaas (pagamentos)

```bash
pnpm tunnel
```

Sobe um túnel público para `localhost:3000` e grava a URL em `ASAAS_WEBHOOK_URL`. O endereço muda a cada execução: rode o túnel antes do `pnpm dev`, ou reinicie o `pnpm dev` depois. Detalhes no [doc 19](../product/19-levantamento-pagamentos.md), seção 4.

## Comandos avulsos

| Comando | Para quê |
|---|---|
| `pnpm cron:local` | Só o passo 4 (CRON_SECRET e Vault). |
| `pnpm supabase:status` | Estado do Supabase local (mostra chaves: não cole em lugar público). |
| `pnpm supabase:stop` | Para o Supabase local. |
| `pnpm supabase:reset` | Só o reset do banco, sem os outros passos. |

## Testar o cron na hora

No banco local (Studio > SQL ou `psql`):

```sql
select public.run_membership_charges_cron();
select status_code, content from net._http_response order by id desc limit 1;
```

A resposta esperada é 200, com o número de espaços, mensalidades e lançamentos criados.
