# Estratégia de testes (regressão)

Data: 2026-09-22. Status: Feito.

> Substitui a linha "Vitest + Testing Library; Playwright em fase posterior" de [`00-decisoes-tecnicas.md`](00-decisoes-tecnicas.md). Implementado em 2026-09-22.

## Decisao

> Atualizado em 21/10/2026 (doc 15, fatia 5): o modelo de turmas roda no servidor sobre o banco; as suítes acompanham.

Cinco suítes, do mais barato ao mais caro, todas no repositório:

| Suíte | Onde | Ferramenta | Comando | O que prova |
| --- | --- | --- | --- | --- |
| Regras puras | `packages/core/test` | `node --test` | `pnpm test` | motor de cobrança, pacotes, notas, finanças |
| Regras de negócio | `apps/web/src/services/__tests__` | Vitest, Node, espaço em memória | `pnpm test` | as regras dos serviços (o mesmo código que o servidor roda sobre o banco) |
| Ida e volta pelo banco | os mesmos testes de regra | Vitest + `src/test/roundtrip-setup.ts` | `pnpm --filter @gestarahub/web test:roundtrip` | todo registro criado pelas regras cabe nas colunas do banco sem perder campo |
| Banco | `apps/web/src/**/*.db.test.ts` | Vitest contra o Supabase local (`src/test/db.ts`) | `pnpm --filter @gestarahub/web test:db` | gravação, transação, concorrência, permissões, RLS e fluxos inteiros pelo servidor |
| Fluxos no navegador | `apps/web/e2e` | Playwright, Chrome do sistema, desktop e mobile | `pnpm e2e` | telas de ponta a ponta contra o banco |

Convenções:

- **Data fixa em 22/09/2026** nas regras e no navegador (Vitest: `vi.useFakeTimers({ toFake: ["Date"] })` em `src/test/setup.ts`; Playwright: `page.clock.setFixedTime`). O servidor do e2e concorda: sobe com `E2E_NOW` e `src/instrumentation.ts` fixa a data do processo (`src/lib/e2e-clock.ts`).
  - **O banco não entra nessa data:** `now()` do Postgres segue o relógio real. Um prazo gravado pelo app e conferido pelo banco nasce vencido no e2e. Exemplo achado em 31/10/2026: a prova da verificação em duas etapas (`two_factor_sessions.expires_at`, 7 dias) é conferida pela `second_factor_ok()` da migração 70. Depois de ligar o código por e-mail, o cliente do usuário não lê mais nada (a auditoria do "ligou" registra "Sua sessão expirou"), mas a tela segue porque lê pelo servidor. Fora do e2e os dois relógios andam juntos. Regra nova no banco que compare com um prazo do app não é exercitada pelo e2e: teste no banco (`*.db.test.ts`).
- **Regras:** espaço em memória, latência 0 e persistência desligada; `src/test/academy.ts` monta a academia (`resetAcademy`, `createPlan`, `enrollStudent`, `chargesOf`).
- **Banco:** cada teste cria o seu espaço, com unidade e usuários por perfil, e chama as actions como numa requisição (o cliente da sessão é o usuário logado no teste). Precisa do `pnpm setup:local`.
- **E2E:** cada teste ganha uma academia nova no Supabase local (`e2e/db.ts`), entra com um usuário de verdade (sessão do Supabase e cookie do app) e monta os dados com `editWorld`/`seedAcademy`, que gravam no banco pelo mesmo motor do servidor (`runInWorld`). Os cenários seguem escrevendo `org-academia-x` e `unit-academia-x`, trocados pelos ids reais. A barbearia (modelo de agenda) segue no mock do navegador. Servidor próprio na porta 3100 (`.next-e2e`), um teste por vez (ids fixos dos cenários no mesmo banco). **Erro de console reprova o teste.**
- **Todo bug corrigido ganha o teste que o reproduz na mesma mudança** (regra no `CLAUDE.md`).

## Contexto

O teste manual guiado de 22/09 levou horas, dependeu de clicar por coordenadas e não era repetível. As suítes transformam os cenários daquela rodada em regressão automática; a prova de que funcionam foi reintroduzir de propósito o bug do "atraso invisível" e ver dois testes falharem.

## Escopo

- Config: `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, scripts `test`/`e2e` em `package.json` (raiz e `apps/web`).
- Relatórios ignorados no Git: `apps/web/test-results`, `playwright-report`.

## Alternativas

- **Testing Library para componentes:** não adotado por ora; o valor está nas regras (services) e nos fluxos (e2e).
- **Baixar navegadores do Playwright:** desnecessário; o Chrome instalado basta.
- **Porta separada (14/10/2026; padrão desde 21/10/2026):** o Playwright sobe o próprio `next dev -p 3100` com pasta de build `.next-e2e` (`NEXT_DIST_DIR`) e a data fixa (`E2E_NOW`); a 3000 fica livre para uso manual. Reaproveitar o `pnpm dev` deixou de servir porque o servidor precisa da mesma data do navegador.
- **Testes de regra contra o Supabase local (doc 15, fatia 5):** não adotado para os 926 testes de regra. Eles rodam o mesmo código que o servidor roda; o que o banco acrescenta (gravação, concorrência, permissão) está nos `*.db.test.ts`, e a ida e volta confere o mapeamento de tudo o que as regras criam. Rodar cada um dos 926 contra o banco custaria minutos por rodada sem cobrir nada novo.
- **Escopo:** só o modelo de turmas (Modelo 3). Agenda e delivery não têm testes de navegador nesta fase.
- **Vitest/Vite mais recentes:** fixados em Vitest 4.1.11 e Vite 7.3.6 porque o Vite 8 dependia de um `lightningcss` ainda não publicado. `esbuild: false` em `pnpm-workspace.yaml` (sem build nativo, como o resto do projeto).
