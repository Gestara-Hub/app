# GestaraHub — apps/web

Frontend do GestaraHub (Next.js 16, App Router, React 19, shadcn/ui, Tailwind CSS v4, TanStack Query). Roda inteiro sobre uma camada de services mockada que imita a futura API; nao ha backend.

## Rodando

Requer pnpm (versao fixada em `packageManager` no `package.json` da raiz). Na raiz do monorepo:

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

- **Login:** a tela `/login` lista usuarios de demonstracao; escolha um para entrar. Cada usuario pertence a uma organizacao (Corte Nobre, barbearia, ou Academia X, academia) e entrar com ele ativa aquela organizacao. Para trocar depois, use o menu do usuario na topbar.
- **Dados:** ficam no `localStorage` do navegador (chave `gestarahub:db`) e sobrevivem ao reload. O seed cria so as organizacoes e os proprietarios; o resto nasce pelo uso. Para recomecar, use "Zerar mocks" em Configurações.

## Scripts

Da raiz (ou com `pnpm --filter @gestarahub/web <script>`):

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento na porta 3000. |
| `pnpm typecheck` | `tsc --noEmit` (deve dar 0 erros). |
| `pnpm lint` | ESLint, incluindo as regras de fronteira (deve dar 0 erros e 0 warnings). |
| `pnpm test` | Motor de cobranca (`node --test` em `packages/core`) + services (Vitest). |
| `pnpm e2e` | Fluxos no navegador (Playwright com o Chrome do sistema; reaproveita o `pnpm dev` se ja estiver no ar). |

## Documentacao

- [`docs/README.md`](../../docs/README.md) — indice geral.
- [`docs/frontend/01-arquitetura.md`](../../docs/frontend/01-arquitetura.md) — estrutura de pastas, camadas e fronteiras.
- [`docs/frontend/02-camada-de-dados-mock.md`](../../docs/frontend/02-camada-de-dados-mock.md) — services, store e queryKeys.
- [`docs/technical/04-estrategia-de-testes.md`](../../docs/technical/04-estrategia-de-testes.md) — testes.
- [`AGENTS.md`](../../AGENTS.md) / [`CLAUDE.md`](../../CLAUDE.md) — regras para quem (ou o que) escreve codigo aqui.
