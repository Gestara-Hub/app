# 20. Tempo dos testes: plano para esperar o mínimo

Data: 2026-10-23. Status: etapa 1 feita (seção 6); etapas 2 a 4 propostas.

## 1. Onde estamos

| Suíte | Testes | Tempo hoje | Como roda |
| --- | --- | --- | --- |
| Vitest (regras e serviços) | 955 | 20 s | Isola cada arquivo: 5 s rodando testes e o resto recarregando módulos |
| Vitest de banco (`*.db.test.ts`) | 57 | ~1 min | Um arquivo por vez (espaços no mesmo banco local) |
| e2e Playwright (desktop + celular) | 341 | 30 a 45 min | **Um teste por vez** (`workers: 1`), sobre o `next dev` |

Por que o e2e demora:
1. **Um por vez.** Os cenários usam ids fixos (`c-a`, `cg-1`, `m-jj`) e a chave primária das tabelas é global: dois testes ao mesmo tempo gravam o mesmo id e colidem. Por isso `fullyParallel: false` e `workers: 1`.
2. **Cada teste custa ~5 s:** criar o espaço, entrar com usuário de verdade, semear dados, navegar e esperar as ações do servidor.
3. **Servidor de desenvolvimento:** medido no `turmas-geral` (13 testes), o build de produção levou 53 s contra ~66 s no `next dev`: ganho de ~20% e menos falha instável de compilação, mas não é o gargalo.
4. **Falhas instáveis de navegação** (URL que não troca a tempo) obrigam a rodar de novo.

Medido no Vitest: sem isolar arquivos (`--isolate=false`), **6 s em vez de 20 s**; só 7 testes (arquivos com `vi.mock`) dependem do isolamento.

## 2. Meta

- **Dia a dia (cada mudança):** menos de 1 minuto de espera local.
- **Antes de publicar:** e2e completo em **10 a 15 minutos**, rodando fora do Mac.

## 3. Plano

### Etapa 1: rápido de fazer (meio dia), ganho imediato no dia a dia

1. **Vitest em dois grupos:** os arquivos sem `vi.mock` rodam sem isolar (`isolate: false`); os 6 com `vi.mock` seguem isolados. 20 s → ~7 s.
2. **e2e "smoke" (`pnpm e2e:smoke`):** cerca de 40 testes críticos marcados com `@smoke` (entrar, configuração inicial, criar turma, matricular, chamada, cobrar e dar baixa, cobrança online, relatório em PDF, ficha do aluno, permissões). ~3 a 4 min. Roda a cada mudança de tela.
3. **e2e por área (`pnpm e2e:area turmas`):** atalhos para rodar só os specs da área mexida (como tenho feito à mão).
4. **Modo produção opcional (`E2E_SERVER=prod`):** `next build` + `next start` na 3100 para rodadas grandes (menos instabilidade, ~20% mais rápido).

### Etapa 2: e2e completo fora do Mac (1 a 2 dias) — **adiada para a ida a produção**

> Decisão de 23/10/2026: fica para quando formos publicar (antes do primeiro deploy, ver o checklist de produção). Até lá, localmente rodam só as checagens rápidas (seção 7).

**Como vai funcionar.** Um arquivo em `.github/workflows/` faz o GitHub rodar, em máquinas dele, a cada push e PR:
- **Checagens rápidas (~2 a 3 min):** typecheck, lint, Vitest e os testes do `packages/core`.
- **e2e completo em 4 máquinas ao mesmo tempo (~10 a 15 min):** cada uma instala as dependências, sobe o próprio Supabase local (`supabase start` + migrações), gera o build de produção e roda 1/4 dos testes (`--shard=1/4` ... `4/4`). Banco próprio por máquina: os ids fixos dos cenários não colidem. Os relatórios das 4 se juntam num só, com vídeo, captura e trace de cada falha anexados ao PR.

**Custo e requisitos.**
- Repositório público (`Gestara-Hub/app` em 23/10/2026): minutos do GitHub Actions gratuitos nas máquinas padrão. Se virar privado, cada rodada completa gasta ~60 minutos de máquina (4 × 15) da franquia do plano; nesse caso, e2e completo só nos PRs para a `main` e o smoke (`@smoke`) a cada push.
- Nenhum segredo de verdade: Supabase local da própria máquina, Asaas e e-mail desligados (como no e2e local).
- Depois de ligar: proteger a `main` exigindo os testes passando (configuração do repositório, com quem cuida do GitHub).

**Itens:**

5. **GitHub Actions** (o repositório ainda não tem): a cada push/PR, Vitest + typecheck + lint (~2 min) e o e2e completo **dividido em 4 máquinas** (`--shard=1/4` ... `4/4`), cada uma com o seu Supabase local (`supabase start` no runner). Como cada máquina tem banco próprio, os ids fixos não colidem. Estimativa: **10 a 15 min** no total, sem ocupar o seu computador; o relatório e os traces das falhas ficam anexados ao PR.
6. **Nova tentativa só no CI** (`retries: 1`, já configurado) e lista das instáveis no relatório, para corrigir as que mais repetem.

### Etapa 3: atacar o custo por teste (contínuo)

7. **Corrigir as esperas instáveis** (navegação e filtros na URL, troca de mês e de semana): menos reexecução e menos falso alarme.
   - Vistas instáveis em 12/11/2026 (rodada de 168 no computador, todas passaram sozinhas em seguida): `dinheiro-pacotes` "presença, falta e justificada…" (`page.goto` abortado), `eventos` "por dia, o valor acompanha…" (segundo "Inscrever" sem aparecer em 30 s), `formularios` "novo lançamento: miniatura…" (Adicionar sem "Lançamento criado.") e `mensalidades` "depois do uso + proporcional…" (vencimento sugerido ainda o de antes). Na rodada seguinte: `dinheiro-pacotes` "vender com valor editado e 3x…" (selo "Encerrado" ainda não na lista depois de cancelar o pacote).
8. **Semear direto no banco** onde hoje o teste passa pelo motor (`editTenant` monta o espaço inteiro por gravação): inserção em lote, mais rápida.
9. **Login reaproveitado** por arquivo (`storageState`) quando o teste não depende de entrar.

### Etapa 4 (só se ainda precisar): paralelo no próprio Mac

10. **Ids únicos por teste:** os cenários passam a usar `id("c-a")`, que vira um id próprio do espaço do teste, e as URLs esperadas idem. Libera 4 ou mais workers locais (~4x). É uma mudança grande em 38 specs; só vale se o CI da etapa 2 não bastar.

## 4. Como fica a rotina

| Momento | O que roda | Espera |
| --- | --- | --- |
| A cada mudança | typecheck + lint + Vitest | ~30 s |
| Mudança de tela | + e2e da área ou smoke | 3 a 5 min |
| Antes de publicar / PR | e2e completo no GitHub Actions | 10 a 15 min, fora do Mac |

## 5. Ordem sugerida

Etapa 1 (itens 1 a 4) agora; etapa 2 quando o repositório for para o GitHub Actions; etapas 3 e 4 conforme as falhas instáveis e o tempo do CI.

## 6. Etapa 1 feita (23/10/2026)

| Comando | O que roda | Tempo medido |
| --- | --- | --- |
| `pnpm --filter @gestarahub/web test` | Vitest em dois grupos (`rapido` sem isolar; `isolado` para arquivos com `vi.mock`, detectados sozinhos) | **4 s** (era 20 s); estável com ordem embaralhada |
| `pnpm --filter @gestarahub/web e2e:smoke` | 42 testes marcados `@smoke` em 20 arquivos | **4 min** |
| `pnpm --filter @gestarahub/web e2e:area turmas` | Só os specs da área (sem área: lista as áreas) | 1 a 8 min, conforme a área |
| `pnpm --filter @gestarahub/web e2e:prod` | Qualquer seleção sobre build de produção (`E2E_SERVER=prod`) | smoke em 3,4 min contando o build |

Achados no caminho (corrigidos):
- **Sobras entre testes:** os cenários usam ids fixos e `apply_world_changes` procurava a linha só pelo id; um id que existia em outro espaço de teste era trazido para o espaço novo, a exclusão no fim do teste falhava calada e o lixo crescia (127 espaços). Migração 41: a gravação recusa linha de outro espaço. `e2e/global-setup.ts` apaga as sobras antes de cada rodada (só usuários `e2e-…@gestarahub.test`) e a limpeza de cada teste avisa quando falha.
- **Troca de usuário no meio do teste:** a página anterior seguia buscando sem sessão ("sessão expirou" no console, só visível no modo produção); o helper sai da página antes de trocar os cookies.
- **E-mail sem chave no modo produção dos e2e:** o servidor de teste (com `E2E_NOW`) registra o link como no desenvolvimento.

## 7. Regra para o desenvolvimento local (23/10/2026)

Para dar velocidade ao desenvolvimento, localmente rodam **só as checagens necessárias**:
- **Sempre, depois de cada mudança:** typecheck, lint e Vitest (segundos). Teste novo de regra no Vitest quando a regra muda.
- **Testes de banco** (`test:db`): só quando a mudança mexe no motor, em migração ou em leitura/gravação no banco, e só os arquivos da área.
- **e2e (Playwright):** **não roda por padrão.** Só quando pedido, e então o da área (`e2e:area`) ou o smoke; o completo fica para o CI (etapa 2). Fluxos de tela novos ou mudados vão para a lista de testes pendentes.
