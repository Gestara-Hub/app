# 21 — Painel admin: rodar e testar no ambiente local

Data: 2026-10-24. Status: Feito (fase 0).
Código: `apps/admin`, `apps/supabase/migrations/20261024000050_platform_schema.sql`.
Testes: `apps/admin/src/**/*.test.ts` (rápidos) e `*.db.test.ts` (Supabase local).

> O desenho está em [technical/26](../technical/26-painel-admin-gestarahub.md). Este guia é o passo a passo para subir e conferir.

## 1. Subir

```bash
pnpm setup:local        # Supabase local no ar e migrações (inclui o schema `platform`)
pnpm admin:setup        # papel do painel no banco e apps/admin/.env.local (sem imprimir segredos)
pnpm admin:create-admin -- --email voce@exemplo.com --name "Seu Nome"   # pede a senha (12+), sem mostrar
pnpm dev:admin          # http://localhost:3001
```

- O painel usa a porta **3001** (o app dos clientes segue na 3000) e cookies com nome próprio (`gestara-admin`), então os dois podem ficar abertos juntos.
- Outros papéis: `--role platform_support | platform_finance | platform_viewer`.
- Para recomeçar do zero: `pnpm setup:local:reset` e repita os passos acima.

## 2. Roteiro de teste manual (fase 0)

1. **Sem login:** abra `http://localhost:3001/audit`. Deve ir para `/login` (guardando o destino).
2. **Senha errada:** mensagem "E-mail ou senha incorretos." Na sexta tentativa no mesmo minuto: "Muitas tentativas...".
3. **Entrar:** e-mail e senha certos levam ao segundo fator.
4. **Primeira vez:** aparece o QR. Escaneie com um aplicativo autenticador (Google Authenticator, 1Password...), digite o código e confirme. Entra no painel (se veio de `/audit`, volta para lá).
5. **Início:** mostra seu papel, "Verificação em duas etapas feita", até que horas vale (8 horas) e "N espaços cadastrados" (prova a conexão com os dados).
6. **Auditoria:** deve ter "Configurou o aplicativo autenticador" e "Entrou no painel", com data, nome e origem (IP). Tente a senha errada de novo e veja "Tentativa de entrada com senha errada".
7. **Equipe:** você aparece com o papel e o último acesso.
8. **Sair** (menu do usuário) e entrar de novo: agora pede só o código do aplicativo.
9. **Isolamento (o ponto principal):**
   - Entre em `http://localhost:3001/login` com o e-mail e a senha de um usuário de espaço (por exemplo, o da demonstração). Deve dar "E-mail ou senha incorretos." e nada fica aberto. A tentativa aparece em Auditoria como "Entrada recusada (conta sem acesso)".
   - Em `http://localhost:3000/login` (app dos clientes), entre com o seu e-mail de administrador. Também deve dar "E-mail ou senha incorretos.".
10. **Papéis:** crie uma pessoa com `--role platform_support` e entre com ela: o menu mostra só Início (sem Equipe nem Auditoria); `/audit` direto volta ao início com o aviso "Seu papel não tem acesso a essa tela."
11. **Tema e mobile:** troque entre claro, escuro e do aparelho; abra a janela estreita e veja o menu lateral virar painel.

## 3. Testes automáticos

```bash
pnpm --filter @gestarahub/admin test       # rápidos (~1 s): tempo de sessão, papéis, destino do login, configuração
pnpm --filter @gestarahub/admin test:db    # contra o Supabase local (~6 s): isolamento do banco e as actions de entrada de verdade
pnpm --filter @gestarahub/admin lint && pnpm --filter @gestarahub/admin typecheck
pnpm --filter @gestarahub/web test         # inclui a recusa do administrador no app dos clientes
```

Os testes de banco criam e apagam as próprias contas e espaços; a auditoria de teste é removida por uma função de teste (o gatilho que protege a auditoria volta a ligar na mesma transação).

## 4. Problemas comuns

- **"Configuração do painel incompleta"**: falta `apps/admin/.env.local`; rode `pnpm admin:setup`.
- **Falha de conexão com o banco**: o Supabase local não está no ar (`pnpm setup:local`).
- **O app dos clientes (porta 3000) e o painel dividem o mesmo Supabase local**: é de propósito. As contas de administrador existem só na autenticação com o marcador de plataforma e a linha em `platform.admins`.
