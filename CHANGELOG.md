# Changelog técnico

Gerado por `pnpm release:prepare` a partir dos commits (doc technical/27). As novidades para quem usa ficam em `apps/web/src/features/releases/release-notes.ts`.

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
