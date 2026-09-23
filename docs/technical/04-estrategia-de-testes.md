# Estratégia de testes (regressão)

> Substitui a linha "Vitest + Testing Library; Playwright em fase posterior" de [`00-decisoes-tecnicas.md`](00-decisoes-tecnicas.md). Implementado em 2026-09-22.

## Decisao

Três suítes, do mais barato ao mais caro, todas no repositório:

| Suíte | Onde | Ferramenta | Comando | Tempo |
| --- | --- | --- | --- | --- |
| Motor de cobrança (lógica pura) | `packages/core/test` | `node --test` nativo (Node 24 roda TypeScript) | `pnpm test` | < 1 s |
| Regras de negócio (services sobre o store mock) | `apps/web/src/services/__tests__` | Vitest 4.1.11, ambiente Node | `pnpm test` | < 1 s |
| Fluxos no navegador | `apps/web/e2e` | Playwright 1.63, Chrome do sistema (`channel: "chrome"`), projetos desktop e mobile | `pnpm e2e` | ~25 s |

Convenções:

- **Data fixa em 22/09/2026** nas três suítes (Vitest: `vi.useFakeTimers({ toFake: ["Date"] })` em `src/test/setup.ts`; Playwright: `page.clock.setFixedTime` em `e2e/fixtures.ts`).
- **Services:** latência 0 e persistência desligada; `src/test/academy.ts` monta o cenário (`resetAcademy`, `createPlan`, `enrollStudent` calculando a 1ª cobrança pelo motor, `chargesOf`).
- **E2E:** login pela tela de login (`loginAs`), dados montados no `localStorage` (`seedAcademy`, `editWorld`, `student`), contexto novo por teste, **erro de console reprova o teste**, seletores por papel e rótulo. Reaproveita o `pnpm dev` na porta 3000.
- **Todo bug corrigido ganha o teste que o reproduz na mesma mudança** (regra no `CLAUDE.md`).

## Contexto

O teste manual guiado de 22/09 levou horas, dependeu de clicar por coordenadas e não era repetível. As suítes transformam os cenários daquela rodada em regressão automática; a prova de que funcionam foi reintroduzir de propósito o bug do "atraso invisível" e ver dois testes falharem.

## Escopo

- Config: `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, scripts `test`/`e2e` em `package.json` (raiz e `apps/web`).
- Relatórios ignorados no Git: `apps/web/test-results`, `playwright-report`.

## Alternativas

- **Testing Library para componentes:** não adotado por ora; o valor está nas regras (services) e nos fluxos (e2e).
- **Baixar navegadores do Playwright:** desnecessário; o Chrome instalado basta.
- **Vitest/Vite mais recentes:** fixados em Vitest 4.1.11 e Vite 7.3.6 porque o Vite 8 dependia de um `lightningcss` ainda não publicado. `esbuild: false` em `pnpm-workspace.yaml` (sem build nativo, como o resto do projeto).
