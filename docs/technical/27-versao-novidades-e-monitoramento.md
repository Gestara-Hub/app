# Versão, novidades e monitoramento (10/11/2026)

> Como o GestaraHub marca cada versão que vai para produção, conta as novidades para quem usa e avisa quando algo quebra. O registro de erros em si está em [21-registro-de-erros.md](21-registro-de-erros.md); comunicados e saúde do sistema no painel em [26-painel-admin-gestarahub.md](26-painel-admin-gestarahub.md).

## 1. Decisões

| Tema | Decisão | Por quê |
| --- | --- | --- |
| Versão | Por data no fuso de Brasília: `2026.11.10`; a segunda do mesmo dia, `2026.11.10-2`. Tag `v<versão>` no git. | Sistema só na web, sempre na última versão: "1.4.2" não diz nada a quem usa, a data diz. |
| Changelog técnico | `CHANGELOG.md` na raiz, gerado dos commits desde a última tag, agrupado por tipo (`feat`, `fix`...). | É para quem desenvolve; nasce de graça das mensagens de commit. |
| Novidades para quem usa | Escritas à mão, em `apps/web/src/features/releases/release-notes.ts`: 3 a 6 itens curtos por versão, sem termo técnico. O agente redige a partir do que mudou e o dono aprova. | Os commits (principalmente os do Antigravity) descrevem menos do que mudou e falam a língua do código. |
| Onde aparecem | Item **Novidades** no menu do avatar, abre a gaveta à direita. Ponto na cor do tema no avatar e no item enquanto houver versão não vista. **Sem modal.** | Modal só para urgência que afeta o espaço (doc product/25, níveis de aviso). Para uma novidade grande, um Comunicado "Aviso" no painel admin aponta para o item. |
| Quem é novo | Na primeira entrada, a versão atual conta como vista; o ponto aparece só na versão seguinte. | Ninguém começa com o histórico inteiro marcado como novo. |
| Erros | Sem Sentry: o registro próprio (`error_logs`) ganhou a versão em cada ocorrência e o alerta na hora para erro nunca visto. | Já temos agrupamento, máscara, código para o usuário e a tela Saúde do sistema; outro serviço duplicaria e seria mais um fornecedor com dados. |
| Disponibilidade | Monitor externo gratuito (UptimeRobot ou Better Stack) chamando `GET /api/health` a cada 5 minutos. | O registro de erros não avisa quando o site inteiro cai: é o próprio site que grava. |
| Velocidade | Web Vitals do PostHog (`capture_performance.web_vitals`), só com o consentimento de cookies que já existe. | Sem fornecedor novo nem mudança na Política. |

## 2. Como funciona

- **Versão no app:** `apps/web/package.json` guarda a versão; `next.config.ts` lê no build e expõe `NEXT_PUBLIC_APP_VERSION` e `NEXT_PUBLIC_APP_COMMIT` (commit curto da Vercel ou do git local). Uso por `@/config/release` (`APP_VERSION`, `APP_COMMIT`, `APP_VERSION_LABEL`). A versão aparece no pé da sidebar (texto pequeno e cinza, só a versão, some com a barra recolhida; clicar abre as Novidades, por `openReleaseNotes`) e no rodapé da gaveta de Novidades, com o commit.
- **Preparar a versão:** `pnpm release:prepare` (`apps/web/scripts/release-prepare.mjs`; `--dry` só mostra). Atualiza a versão em `apps/web` e `apps/admin`, escreve a seção no `CHANGELOG.md`, avisa se faltam as Novidades da versão e imprime os comandos de commit na `develop`, de passar a `develop` para a `main` (fast-forward), tag e push. **Não faz commit, tag nem push** (regra do repo: só a pedido).
- **Novidades vistas:** preferência `lastSeenRelease` do usuário (`UserPreferences`), comparada com a versão mais nova de `RELEASE_NOTES` (`useUnseenRelease`). Abrir a gaveta marca como vista.
- **Versão nos erros:** `recordErrorToDb` grava `release` no contexto de cada ocorrência (`error_occurrences.context`), sem mudar a tabela.
- **Alerta na hora:** `record_error` devolve `true` quando a impressão digital nunca apareceu em nenhum espaço (migração 95, índice `error_logs_fingerprint_idx`). Nesse caso, com nível `error`, o servidor manda e-mail para `ERROR_DIGEST_EMAIL` com o assunto "erro novo agora", a versão e o código. No máximo 10 alertas por hora por servidor; o resto fica para o resumo diário, que continua igual (o erro alertado também aparece nele). Sem `ERROR_DIGEST_EMAIL` ou nos testes (`E2E_NOW`), não envia.
- **`GET /api/health`:** pública, sem dado pessoal. Responde `{ ok, database, version, commit, ms }`: 200 com o banco atendendo em até 5 s, 503 se não. Sem cache.

## 3. Rotina de cada deploy

Fluxo padrão de versão (toda publicação passa por `CHANGELOG.md` + tag `v<versão>` na `main`):

1. **Na `develop`:** garantir commits semânticos pequenos (`feat(...)`, `fix(...)`, etc.) e conferências passando (`typecheck`, `lint`, `docs:check`, `pnpm test`).
2. **Novidades para quem usa (`apps/web/src/features/releases/release-notes.ts`):** ler `git log <última-tag>..HEAD --oneline`, redigir 3 a 6 itens curtos sem termo técnico para a versão nova (`YYYY.M.D` ou `YYYY.M.D-2` se for a segunda do dia) e revisar.
3. **`pnpm release:prepare` (na `develop`):** atualiza a versão em `apps/web/package.json` e `apps/admin/package.json`, gera a entrada no `CHANGELOG.md` desde a última tag `v*` e confere `release-notes.ts`.
4. **Commit e push na `develop`:** `git add -A && git commit -m "chore(release): <versão>" && git push origin develop`.
5. **Migrações novas (`apps/supabase/migrations/`):** se entraram migrações desde a última tag, rodar `supabase db push --workdir apps` no Supabase de produção **antes** (ou junto) do deploy do app (`guides/28`).
6. **PR e merge na `main`:** abrir ou atualizar o PR `develop` → `main` e mergear **sem squash** (usar `--merge` ou `--ff-only`, preservando os hashes dos commits para a tag e o próximo changelog). O push/merge na `main` dispara o deploy na Vercel.
7. **Tag na `main` e volta para a `develop`:**
   - `git fetch origin && git checkout main && git pull --ff-only origin main`
   - `git tag v<versão> && git push origin v<versão>`
   - `git checkout develop && git merge --ff-only origin/main && git push origin develop` *(mantém a tag `v<versão>` na ancestralidade da `develop` para o próximo `pnpm release:prepare`)*.
8. **Depois do deploy:** conferir `https://<domínio>/api/health` com a versão nova.

## 4. Falta configurar fora do código

- Monitor externo apontando para `/api/health` com aviso por e-mail (conta gratuita; não recebe dado pessoal).
- No PostHog: ligar "Web vitals autocapture" nas configurações do projeto (o app já envia quando liberado).
- `ERROR_DIGEST_EMAIL` também na Vercel, para o alerta na hora valer em produção.
