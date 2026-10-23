# Plano para o agente: 2FA por e-mail e revisão visual geral

Data: 2026-10-23. Para executar em outra sessão (Claude no VS Code). **Ordem: Parte A inteira, depois a Parte B.**

## 0. Antes de começar (obrigatório)

1. Leia o `CLAUDE.md` da raiz (regras de código, UI, testes e git) e o `docs/README.md` (índice).
2. Regras que mais pegam aqui:
   - Código 100% em inglês; tudo que o usuário lê em português do Brasil, frases curtas, sem jargão ("verificação em duas etapas", nunca "2FA" ou "TOTP" na tela).
   - Erros: nunca `console.error`/`console.warn`; use `logError`/`reportError` de `@/lib/log` (doc technical/21).
   - **Git:** não faça `push`. Commit só se o usuário pedir. Deixe as mudanças na árvore e diga o que mudou.
   - **Testes locais:** typecheck + lint + Vitest a cada mudança; testes de banco (`test:db`) só da área mexida (aqui, sim: a Parte A mexe no banco e no login). E2E só a área `acesso` no fim da Parte A (`pnpm --filter @gestarahub/web e2e:area acesso`), nunca a suíte completa.
   - Nunca escreva em código, log ou doc: senha, token, chave, CPF.
3. Ambiente:
   ```bash
   pnpm setup:local
   pnpm dev
   ```
   - A porta 3000 pode estar ocupada por outro projeto do usuário. Não mate o processo: suba em outra porta, por exemplo `pnpm --filter @gestarahub/web exec next dev -p 3005`.
   - Sem `MAILERSEND_API_KEY` no `.env.local`, os e-mails não saem: o link (e, depois da Parte A, o código) aparece no terminal do `pnpm dev`, só em desenvolvimento.

---

## Parte A: verificação em duas etapas, entrega 2 (código por e-mail e "lembrar este dispositivo")

### A.1 Contexto

- Leia `docs/technical/17-verificacao-em-duas-etapas.md` inteiro. A entrega 1 (aplicativo autenticador, MFA do Supabase) está pronta.
- Em 23/10/2026 entrou o **aviso de segurança** (doc `docs/product/25-lembretes-e-seguranca.md`, seção 5): uma janela em quatro momentos convida dono e gerente a ligar a verificação. Hoje o "Ativar agora" só oferece o aplicativo. Para o público não técnico, o app é uma barreira: muita gente vai recusar. **A entrega 2 dá uma opção sem app (código por e-mail)** e evita pedir código toda hora ("lembrar este dispositivo por 30 dias").
- Arquivos atuais que você vai mexer ou imitar:

| Arquivo | O que é |
| --- | --- |
| `apps/web/src/lib/supabase/tenant-client.ts` | `getClientForTenant`: a **barreira**. Recusa a sessão do Supabase em AAL1 de quem tem o app ligado. |
| `apps/web/src/app/(auth)/sign-in-session.ts` | `needsSecondFactor` e `finishSignIn` (cria o cookie `gestarahub_session`). |
| `apps/web/src/app/(auth)/signup-actions.ts` | `signInWithPasswordAction` (~linha 560): senha certa + segundo fator devolve `twoFactorRequired`. |
| `apps/web/src/app/auth/callback/route.ts` | Login com Google: também manda para `/two-factor` quando precisa. |
| `apps/web/src/app/(auth)/two-factor/` | Tela do código no login (`page.tsx`, `two-factor-form.tsx`). |
| `apps/web/src/app/(auth)/two-factor-actions.ts` | Ações: conferir o código do login, status, cadastrar e desligar o app. `allowCodeAttempt` limita tentativas. |
| `apps/web/src/features/auth/components/two-factor-dialog.tsx` | Janela "Segurança" (menu do usuário). Tem `startOnOpen` (aviso de segurança abre já no QR code). |
| `apps/web/src/features/auth/components/security-prompt-host.tsx` | O aviso de segurança dos quatro momentos. |
| `apps/supabase/migrations/20261022000036_password_reset_tokens.sql` | **Padrão a copiar** para o código por e-mail: só o hash no banco, RLS ligado sem políticas, acesso só pela chave de serviço. |
| `apps/web/src/services/server/passwordReset.ts` e `apps/web/src/lib/email/mailersend.ts` | Geração do token, envio pelo MailerSend e o texto no terminal quando não há chave. |
| `apps/web/src/lib/security/rate-limit.ts` | `checkRateLimit` (limite por chave no banco). |
| `apps/web/src/app/(auth)/__tests__/twoFactor.db.test.ts` | Testes de banco da entrega 1: siga o mesmo estilo. |

### A.2 O ponto delicado: a barreira

O Supabase só conhece o aplicativo (AAL2). **O código por e-mail é nosso**: depois dele, a sessão do Supabase continua AAL1. Se nada mudar, quem ligou o e-mail entraria só com a senha, porque `getClientForTenant` deixaria passar AAL1. O cookie `gestarahub_session` **não é assinado** (base64 de JSON): não pode ser a prova de que o código foi digitado.

**Desenho recomendado (aprovado neste plano):**
- **Quem precisa do segundo fator:** tem o app verificado (`aal.nextLevel === "aal2"`) **ou** ligou o e-mail. Guarde "ligou o e-mail" em `app_metadata` do usuário no Supabase (`two_factor_email: true`, gravado pelo servidor com a chave de serviço: o usuário não consegue mudar `app_metadata`). Assim a barreira sabe sem consultar tabela, porque o `getUser()` já traz o `app_metadata`.
- **Prova de que o segundo fator foi feito nesta sessão:** a sessão está em AAL2 (app) **ou** existe uma linha em `two_factor_sessions` para o `session_id` da sessão atual do Supabase (claim `session_id` do JWT; pegue com `supabase.auth.getClaims()` ou decodificando o access token no servidor), dentro da validade.
- `getClientForTenant` e `needsSecondFactor` passam a usar essa regra única. Faça uma função só (ex.: `secondFactorState(supabase)` → `"not_required" | "satisfied" | "missing"`) e use nos dois lugares.

### A.3 Banco (uma migração nova, próximo número livre em `apps/supabase/migrations/`)

Tudo com RLS ligado e **sem políticas** (só a chave de serviço), como a migração 36. Depois da migração: `pnpm supabase:status` para conferir e, se mexer em tabela do espaço (não deve), `pnpm --filter @gestarahub/web world:schema`.

1. **`two_factor_email_codes`**: `id uuid pk`, `auth_user_id uuid` (FK `auth.users`, cascade), `purpose text` (`login` | `enable` | `disable`), `code_hash text`, `status` (`pending` | `consumed` | `revoked`), `attempts int default 0`, `expires_at timestamptz`, `consumed_at`, `created_at`, `updated_at` + gatilho `set_updated_at`. Índice `(auth_user_id, purpose, status)`.
2. **`two_factor_sessions`**: `session_id uuid pk` (o da sessão do Supabase), `auth_user_id uuid` (FK, cascade), `method text` (`email` | `device`), `verified_at`, `expires_at` (igual à validade da sessão do app, `SESSION_MAX_AGE` em `lib/session.ts`). Índice em `auth_user_id`.
3. **`trusted_devices`**: `id uuid pk`, `auth_user_id uuid` (FK, cascade), `token_hash text unique`, `label text` (navegador e sistema, curto, a partir do user agent; sem IP), `created_at`, `last_used_at`, `expires_at` (30 dias), `revoked_at`. Índice `(auth_user_id)`.
4. **Limpeza diária** (pg_cron, como `world-buckets-prune-daily` na migração 43): apagar códigos vencidos há mais de 1 dia, `two_factor_sessions` vencidas e `trusted_devices` vencidos ou revogados há mais de 30 dias.

### A.4 Regras (valores padrão; deixe em constantes nomeadas)

| Regra | Valor |
| --- | --- |
| Código | 6 números, aleatório criptográfico (`node:crypto`), só o hash SHA-256 no banco |
| Validade do código | 10 minutos |
| Tentativas por código | 5; depois, o código é revogado e precisa pedir outro |
| Reenviar | no mínimo 60 s entre envios; no máximo 5 envios a cada 15 min por usuário (`checkRateLimit`) |
| Código novo | revoga os anteriores do mesmo usuário e propósito |
| Lembrar dispositivo | 30 dias; token aleatório de 32 bytes no cookie `httpOnly`, `secure` em produção, `sameSite=lax`; só o hash no banco |
| Desligar a verificação | pede um código (do app ou do e-mail) e **revoga todos os dispositivos lembrados** |
| Conta só do Google | fica de fora, como hoje (o Google já protege) |

### A.5 Fluxos

**1. Ligar pelo e-mail** (janela "Segurança"):
- Com tudo desligado, a janela mostra duas opções: "Aplicativo autenticador" (mais seguro; o fluxo que já existe) e "Código por e-mail" (mais simples). Texto curto, sem jargão.
- E-mail: "Enviar código" manda para o e-mail da conta (mostrar o e-mail mascarado na tela, ex. `ma***@gmail.com`) → campo do código → confirmar → grava `app_metadata.two_factor_email = true` → registra na **auditoria** ("ligou a verificação em duas etapas por e-mail"; a doc 17 lista a auditoria como pendente: faça também para o app).
- Quem já tem o app pode ligar o e-mail como **segunda opção** (útil se perder o celular). Quem tem só o e-mail pode trocar para o app depois.
- **Aviso de segurança:** "Ativar agora" deve abrir a janela na escolha dos dois métodos (hoje `startOnOpen` vai direto ao QR code do app). Ajuste `security-prompt-host.tsx` e `two-factor-dialog.tsx`.

**2. Login com o e-mail ligado:**
- Senha certa → se o dispositivo for lembrado e válido para esse usuário: grava `two_factor_sessions(method=device)`, atualiza `last_used_at` e entra direto.
- Senão → `/two-factor`: com o e-mail ligado, envia o código sozinho ao abrir a tela (uma vez) e mostra "Enviamos um código para ma***@gmail.com" + "Reenviar código" (com o tempo de espera) + campo do código.
- Com app **e** e-mail ligados: começa pelo app e mostra "Receber por e-mail" como alternativa.
- Caixa **"Lembrar este dispositivo por 30 dias"** na tela do código (para os dois métodos). Marcada → cria `trusted_devices` e o cookie.
- Código certo → grava `two_factor_sessions(method=email)` com o `session_id` atual → `finishSignIn`.
- Login com Google de conta que tem senha e e-mail ligado: mesmo caminho (`app/auth/callback/route.ts`).

**3. Dispositivos lembrados** (janela "Segurança"):
- Lista: nome do navegador e sistema, "último uso há 2 dias". Botões "Esquecer" (um) e "Esquecer todos". Esquecer revoga no banco.

**4. Desligar:**
- Pede um código (app ou e-mail, o que estiver ligado). Remove o fator do app, se houver, limpa `app_metadata.two_factor_email`, revoga todos os dispositivos e apaga as `two_factor_sessions` do usuário. Auditoria.

**5. Sair** (`signOut`): apagar a `two_factor_sessions` da sessão. O dispositivo lembrado continua (é o propósito).

### A.6 E-mail

- Novo envio em `lib/email/mailersend.ts`, no padrão de `sendPasswordResetEmail`: assunto "Seu código de acesso ao GestaraHub", corpo curto com o código em destaque e "Vale por 10 minutos. Se não foi você, troque sua senha."
- Sem `MAILERSEND_API_KEY` (desenvolvimento): o código sai no terminal com `console.warn` (como o link de nova senha; não é erro, não vai ao registro de erros). Em produção sem chave: `logError` e mensagem de falha.
- Lembrete: a conta do MailerSend ainda não foi aprovada e só entrega para o endereço do dono da conta (memória do projeto). Para testar com outro e-mail, use o terminal.

### A.7 Testes

- **Vitest** (rápido): regras puras (validade, tentativas, máscara do e-mail, tempo de reenvio).
- **Testes de banco** em `apps/web/src/app/(auth)/__tests__/` (siga `twoFactor.db.test.ts`; os códigos são hash, então o teste gera o código pelo mesmo caminho do servidor ou grava um hash conhecido):
  1. Senha sem verificação ligada entra direto.
  2. E-mail ligado: a senha sozinha **não** lê dados (`getClientForTenant` recusa) até o código; depois do código, lê.
  3. Código errado 5 vezes revoga; código vencido não vale; código usado não vale de novo; código novo revoga o anterior.
  4. Limite de reenvio.
  5. Dispositivo lembrado: entra sem código; vencido, revogado ou de outro usuário não vale.
  6. App + dispositivo lembrado: entra sem código do app.
  7. Desligar revoga os dispositivos.
  8. Conta só do Google não oferece nada (como hoje).
- **E2E** (no fim da Parte A): ampliar `apps/web/e2e/seguranca-aviso.spec.ts` ou criar `e2e/verificacao-email.spec.ts` (e incluir na área `acesso` em `apps/web/scripts/e2e-area.mjs`): ligar pelo e-mail na janela Segurança, sair, entrar (código), marcar "lembrar", sair e entrar de novo sem código. Para o código no e2e, crie um ajudante em `e2e/db.ts` que grava um código conhecido (hash) para o usuário, em vez de ler o terminal.
- Comandos:
  ```bash
  pnpm --filter @gestarahub/web typecheck
  pnpm --filter @gestarahub/web lint
  pnpm --filter @gestarahub/web test
  pnpm --filter @gestarahub/web exec vitest run -c vitest.db.config.ts src/app/\(auth\)
  pnpm --filter @gestarahub/web e2e:area acesso
  ```

### A.8 Documentação

- Atualizar `docs/technical/17-verificacao-em-duas-etapas.md`: status (entrega 2 feita), o desenho da barreira (seção A.2), as tabelas, as regras e os testes. Tirar dos pendentes o que foi feito (auditoria; recuperação por e-mail).
- Se mudar comportamento de tela, conferir `docs/frontend/07-padroes-telas-e-ux.md`.

### A.9 Pronto quando

- [ ] Ligar e desligar por e-mail e por app, com auditoria.
- [ ] Login com e-mail ligado pede código; a barreira recusa dados antes do código (teste de banco).
- [ ] "Lembrar este dispositivo" funciona por 30 dias e pode ser esquecido; desligar revoga tudo.
- [ ] Aviso de segurança oferece os dois métodos.
- [ ] Typecheck, lint, Vitest, testes de banco da área e e2e da área `acesso` passando.
- [ ] Doc 17 atualizada. Nada commitado sem o usuário pedir; nada de push.

---

## Parte B: revisão visual geral (desktop e celular)

### B.1 Objetivo e regra de ouro

Passar por **todas as telas** do app, no desktop e no celular, e **só registrar** o que precisa de ajuste. **Não corrija nada**, nem o que parecer trivial: o usuário vai ler a lista no fim e decidir o que pedir. A entrega é um arquivo de achados.

### B.2 Preparação

1. `pnpm demo:local` recria o espaço de demonstração (Academia X, datas relativas a hoje). Depois `pnpm dev` (ou a porta 3005, ver seção 0).
2. No login, "Entrar na demonstração". No topo, dá para ver como **dono, gerente, recepção e professor**. Revise como **dono** primeiro; depois passe rápido pelas telas principais com **professor** e **recepção** (o que cada um vê e não vê).
3. Navegador: use o navegador integrado do Claude (ferramentas de navegador) ou Playwright. Tamanhos:
   - **Desktop:** 1280 × 900 (e uma conferida em 1440).
   - **Celular:** 375 × 812 (iPhone pequeno) e 390 × 844.
   - **Tema claro e escuro** nas telas principais (painel, alunos, ficha, turmas, chamada, cobranças, financeiro).
4. Arquivo de achados: crie `docs/qa/2026-10-xx-revisao-visual.md` (data do dia) com o formato da seção B.5.

### B.3 O que conferir em toda tela (critérios do projeto)

Base: `docs/frontend/07-padroes-telas-e-ux.md` e `docs/frontend/08-decisoes-landing-page-e-onboarding.md`.

- **Layout:** botão principal de criar no canto superior direito do cabeçalho; no máximo 4 cards de resumo no topo; lista com busca + filtros + barra de resumo (`ListSummaryBar`) acima; toda linha com menu ⋮ e menu de clique direito.
- **Texto:** nada cortado com reticências (`...`) em nome ou valor; frases curtas (6 a 8 palavras); sem jargão ou inglês na tela ("setup", "2FA", "dashboard" escrito para o usuário); nada de "Ex.: ..." em placeholder; rótulos `Nome*` colados; sem lista de seleção repetida na mesma tela.
- **Botões:** altura única (36 px); botões só de ícone com tamanho de ícone; rodapé de formulário "Adicionar" (criar) / "Salvar" (editar) / "Cancelar".
- **Formulários e janelas:** cabeçalho e rodapé fixos, campos rolando no meio; drawer à direita como os outros; mensagens de erro em português, perto do campo.
- **Celular:** nada de rolagem lateral; campos com letra de 16 px (sem zoom do iPhone); sem foco automático em campo ao abrir; botões ao alcance; tabelas viram lista ou cards legíveis.
- **Estados:** carregando (esqueleto), vazio (guia com ação), erro (mensagem + tentar de novo).
- **Tema escuro:** contraste, textos ilegíveis, fundos brancos sobrando.
- **Console do navegador:** anote erros e avisos que aparecerem (texto e tela).

### B.4 Roteiro de telas

Para cada tela: abrir, olhar no desktop e no celular, abrir os diálogos principais (criar, editar, ações do ⋮), testar busca e filtros, anotar.

**Entrada e configuração**
1. `/login` (entrar, criar conta, "Esqueci minha senha"), `/forgot-password`, `/reset-password` (com link do terminal), `/two-factor` (depois da Parte A).
2. `/setup` (configuração inicial, 3 passos: Espaço, Área, Aulas). Para ver do zero, crie uma conta nova pelo "Criar conta" (link no terminal).
3. Site: `/` (landing page inteira, rolagem, cards de áreas, abas "Veja o sistema por dentro"), `/terms`, `/privacy`, `/plans` e `/plans/checkout`.

**Dia a dia**
4. `/dashboard`: bloco **Lembretes** (novo: grupos, "Ver", WhatsApp, ⋮ "Lembrar amanhã"/"Não lembrar", "Enviar em sequência"), **sino no topo** (número, painel lateral), cards, aniversariantes, próximas aulas.
5. `/classes/calendar` (dia, semana, mês; lista no celular).
6. `/classes` (lista e cards), `/classes/[id]` (detalhe: alunos, aulas, cobranças, ações; **editar o horário** e ver a pergunta "Avisar os alunos?" e o envio em sequência), `/classes/sessions/[sessionId]` (aula e **chamada**: marcar presença, "Todos vieram", menu do aluno, barra de baixo no celular), certificado `/classes/[id]/certificate/[enrollmentId]` (curso terminado).
7. `/clients` (lista, filtros, novo aluno com plano, bolsista, pacote, responsáveis), `/clients/[id]` (**ficha**: alertas, seções em acordeão, cobranças, presenças, evolução/graduação, notas, mensagens, documentos em PDF).
8. `/communication`: abas de mensagens, **Histórico** (agora paginado no banco: troca de página, filtros de status e tipo, busca), modelos (editar), conexão do WhatsApp.

**Dinheiro**
9. `/classes/billing` (cobranças: mês, filtros, atraso, registrar pagamento, cobrança avulsa, parcelas, recibo, cobrar online).
10. `/finance` (resumo, lançamentos, novo lançamento, recorrência, categorias, pagamento de professores).
11. `/online-payments` (recebimentos online: ativação da conta de recebimentos, extrato).
12. `/reports` (catálogo, cada relatório, prévia e PDF).
13. `/classes/plans` (planos e pacotes).

**Estrutura e administração**
14. `/classes/modalities` (modalidades, trilha de níveis/faixas), `/team` (equipe), `/users` (usuários, convite, perfis), `/audit` (**auditoria**: agora carrega 50 por vez com "Carregar mais eventos"; filtros por tipo, autor, período, busca), `/settings` (todas as abas).
15. Menu do usuário no topo: Preferências, **Segurança** (janela da verificação em duas etapas), trocar perfil (demonstração), sair.

**Perfis**
16. Como **professor**: o que aparece no menu, painel, turmas (só as dele), chamada, ficha (sem cobranças), sino/lembretes (só alunos das turmas dele, sem cobrança).
17. Como **recepção** e **gerente**: menu, cobranças, auditoria (gerente não vê eventos de dono).

**Fora do foco (só uma olhada, sem detalhar):** modelo de agendamento/barbearia (`/schedule`, `/appointments`, `/services`): está no modo demonstração e fora do foco atual.

### B.5 Formato do arquivo de achados

Uma tabela por área, mais um resumo no topo. Cada achado em uma linha:

| # | Tela | Onde | Tamanho/tema | O que está errado | Por que importa | Sugestão (curta) | Gravidade |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ficha do aluno | aba Cobranças | celular 375, claro | valor quebra em duas linhas e empurra o botão | botão fica fora da tela | valor numa linha, botão embaixo | média |

- **Gravidade:** `alta` (impede usar, dado errado, erro no console, quebra no celular), `média` (feio ou confuso, mas usa), `baixa` (detalhe de acabamento).
- Anexe capturas de tela quando ajudarem: salve em `docs/qa/capturas/2026-10-xx/` com nome curto (`ficha-cobrancas-375.png`) e cite na linha.
- No topo do arquivo: quantos achados por gravidade e as 5 coisas mais importantes.
- **Não corrija nada.** Se achar um bug de verdade (não visual), registre como `alta` e descreva os passos para repetir.

### B.6 Pronto quando

- [ ] Todas as telas da seção B.4 vistas no desktop e no celular, e as principais no tema escuro.
- [ ] Perfis professor, recepção e gerente conferidos nas telas principais.
- [ ] Arquivo `docs/qa/2026-10-xx-revisao-visual.md` com os achados no formato da seção B.5.
- [ ] Nenhuma correção feita; nada commitado sem o usuário pedir; nada de push.
