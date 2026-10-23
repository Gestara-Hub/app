# Plano para o agente: 2FA por e-mail e teste geral do sistema

Data: 2026-10-23. Para executar em outra sessão (Claude no VS Code). **Ordem: Parte A inteira, depois a Parte B** (a Parte B é a mais demorada).

## 0. Antes de começar (obrigatório)

1. Leia o `CLAUDE.md` da raiz (regras de código, UI, testes e git) e o `docs/README.md` (índice).
2. Regras que mais pegam aqui:
   - Código 100% em inglês; tudo que o usuário lê em português do Brasil, frases curtas, sem jargão ("verificação em duas etapas", nunca "2FA" ou "TOTP" na tela).
   - Erros: nunca `console.error`/`console.warn`; use `logError`/`reportError` de `@/lib/log` (doc technical/21).
   - **Git:** não faça `push`. Commit só se o usuário pedir. Deixe as mudanças na árvore e diga o que mudou.
   - **Testes locais:** typecheck + lint + Vitest a cada mudança; testes de banco (`test:db`) só da área mexida (aqui, sim: a Parte A mexe no banco e no login). E2E só a área `acesso` no fim da Parte A (`pnpm --filter @gestarahub/web e2e:area acesso`), nunca a suíte completa.
   - Nunca escreva em código, log ou doc: senha, token, chave, CPF.
3. Ambiente, **nesta ordem**, cada comando no seu terminal e os dois últimos rodando o tempo todo:
   ```bash
   pnpm setup:local
   pnpm tunnel
   pnpm dev
   ```
   - **O túnel é obrigatório para o webhook do Asaas** (o pagamento online confirmado no Asaas volta para o app por ele). Sem o túnel, o pagamento no sandbox não chega ao app e parece bug. Detalhes na seção B.3.
   - O `pnpm tunnel` usa o `cloudflared` (já instalado em `/opt/homebrew/bin`), grava a URL pública em `ASAAS_WEBHOOK_URL` no `.env.local` e fica no ar até Ctrl+C. **A URL muda a cada vez que o túnel sobe:** sempre que reiniciar o túnel, reinicie o `pnpm dev` (o Next só lê o `.env.local` ao iniciar).
   - **Use a porta 3000** (padrão do projeto; o túnel já aponta para ela). Só se ela estiver ocupada (o usuário tem outro projeto que às vezes usa a 3000; confira com `lsof -iTCP:3000 -sTCP:LISTEN`), não mate o outro processo: suba o app em outra porta e **aponte o túnel para a mesma porta**:
     ```bash
     PORT=3005 pnpm tunnel
     pnpm --filter @gestarahub/web exec next dev -p 3005
     ```
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

## Parte B: teste geral do sistema, tela por tela (desktop e celular)

### B.1 Objetivo e regra de ouro

Testar **de fato** todos os fluxos do sistema, tela por tela, no desktop e no celular: não só olhar, mas **executar** cada ação (criar, editar, inativar, reativar, pagar, desfazer, cancelar, gerar documento, enviar mensagem) e conferir o resultado nas outras telas que dependem dela. O usuário pediu (23/10/2026): **testar tudo, para não deixar passar nada**.

**Não corrija nada**, nem o que parecer trivial. Registre cada problema (visual, de texto, de regra, de dado, erro no console) no arquivo de achados (seção B.6). O usuário lê a lista no fim e decide o que pedir.

### B.2 Preparação

1. `pnpm demo:local` recria o espaço de demonstração (Academia X, datas relativas a hoje). Depois suba o túnel e o app como na seção 0 (`pnpm tunnel` e, em seguida, `pnpm dev`, na porta 3000).
2. No login, "Entrar na demonstração". No topo, dá para ver como **dono, gerente, recepção e professor**. Faça os fluxos como **dono**; depois repita os principais com **professor**, **recepção** e **gerente** (seção B.5, item Perfis).
3. **Crie também um espaço novo do zero** pelo "Criar conta" do login (o link de confirmação aparece no terminal do `pnpm dev`): a configuração inicial, o espaço vazio, os guias de "primeiros passos" e o primeiro cadastro de tudo só aparecem assim.
4. Navegador: o navegador integrado do Claude ou Playwright. Tamanhos:
   - **Desktop:** 1280 × 900 (e uma conferida em 1440).
   - **Celular:** 375 × 812 e 390 × 844.
   - **Tema claro e escuro** nas telas principais (painel, alunos, ficha, turmas, chamada, cobranças, financeiro).
5. Arquivo de achados: crie `docs/qa/2026-10-xx-teste-geral.md` (data do dia), formato na seção B.6.
6. Abra o console do navegador e o terminal do `pnpm dev` durante todo o teste: anote todo erro ou aviso que aparecer (texto, tela e o que você fez antes). Os erros do servidor também ficam na tabela `error_logs` (doc technical/21): no fim, liste o que entrou nela durante o teste.

### B.3 Subconta de recebimentos (pagamento online de verdade, no sandbox)

O usuário autorizou criar uma subconta para este teste. **Só no sandbox do Asaas:**

1. Confira no `apps/web/.env.local` que `ASAAS_API_URL` aponta para `https://sandbox.asaas.com/api/v3`. **Se apontar para produção, pare e avise o usuário.** Não mostre nem copie a chave (`ASAAS_API_KEY`) em lugar nenhum.
2. **Túnel do webhook ligado** (seção 0): `pnpm tunnel` rodando e o `pnpm dev` iniciado **depois** dele (mesma porta nos dois). Doc technical/16, seção "Webhook do Asaas", e doc product/19, seção 4.
   - No próximo acesso ao espaço depois de reiniciar o `pnpm dev`, o app recadastra o webhook na subconta com a URL nova (`services/onlinePayments/gatewaySetup.ts`). Se o túnel cair ou for reiniciado no meio do teste, reinicie o `pnpm dev` e abra o app de novo antes de pagar.
   - Para confirmar que está funcionando: no terminal do túnel aparecem as chamadas `POST /api/webhooks/asaas`; no do `pnpm dev`, a rota respondendo. Se o pagamento não voltar ao app, confira primeiro o túnel e a URL antes de registrar como bug. Se o túnel estava certo e ainda assim não voltou, aí é achado `alta`.
3. No app: Recebimentos online → **Ativar conta de recebimentos**. Preencha com **dados fictícios de teste**: nome de empresa inventado, um CPF ou CNPJ **gerado para teste** (válido no formato, de ninguém real; o sandbox aceita), data de nascimento, um e-mail de teste e um celular de teste. Nunca use documento de pessoa real. Anote no arquivo de achados qual tipo (CPF ou CNPJ) e o nome usado, **sem** o número do documento.
4. Depois de ativar (e da janela de segurança que aparece nesse momento: teste "Agora não" e, em outra vez, "Ativar agora"), teste o ciclo completo:
   - cadastrar o CPF de teste num aluno maior de idade e de um responsável financeiro de um aluno menor;
   - **cobrar online** uma mensalidade, uma avulsa e uma parcela de curso: gerar Pix e link de pagamento; abrir o link público `/p/[code]` no celular;
   - **pagar no sandbox:** confirmar o pagamento pelo painel do sandbox do Asaas ou pela API de sandbox (consulte a documentação do Asaas pelo MCP de docs do projeto, `.mcp.json`; **só leitura**, nunca a ferramenta que executa chamadas);
   - conferir que a cobrança vira **Paga** no app (cobranças, ficha, financeiro, relatórios, extrato online), com recibo e o lembrete "pagamento para agradecer";
   - cobrança online vencida (expiração) e cancelamento;
   - extrato e saldo em Recebimentos online; documento "Extrato" em PDF.
5. Ao terminar, **deixe a subconta** (o usuário decide depois se apaga). Registre no arquivo de achados que ela foi criada.

### B.4 O que conferir em toda tela (critérios do projeto)

Base: `docs/frontend/07-padroes-telas-e-ux.md` e `docs/frontend/08-decisoes-landing-page-e-onboarding.md`.

- **Funciona:** a ação faz o que promete; o resultado aparece nas outras telas (painel, ficha, cobranças, financeiro, relatórios, auditoria, lembretes); desfazer volta como estava; mensagem de sucesso e de erro corretas.
- **Regra:** valores, datas, vencimentos, proporcional, bolsa, parcelas, contagem de vagas, presença, pacote (aulas restantes), atraso; o que pode e o que não pode por perfil.
- **Layout:** botão principal de criar no canto superior direito do cabeçalho; no máximo 4 cards de resumo; lista com busca + filtros + barra de resumo; toda linha com menu ⋮ e menu de clique direito.
- **Texto:** nada cortado com reticências (`...`) em nome ou valor; frases curtas (6 a 8 palavras); sem jargão ou inglês na tela ("setup", "2FA", "dashboard"); nada de "Ex.: ..." em placeholder; rótulos `Nome*` colados; sem lista de seleção repetida na mesma tela.
- **Botões:** altura única (36 px); botões só de ícone com tamanho de ícone; rodapé "Adicionar" (criar) / "Salvar" (editar) / "Cancelar".
- **Formulários e janelas:** cabeçalho e rodapé fixos, campos rolando no meio; drawer à direita; erros em português, perto do campo; fechar com alteração pergunta se descarta.
- **Celular:** sem rolagem lateral; campos com letra de 16 px (sem zoom do iPhone); sem foco automático ao abrir; botões ao alcance; listas legíveis.
- **Estados:** carregando (esqueleto), vazio (guia com ação), erro (mensagem + tentar de novo; erro inesperado mostra "Código do erro").
- **Tema escuro:** contraste, textos ilegíveis, fundos brancos sobrando.

### B.5 Fluxos, tela por tela

Para cada item: execute no desktop, repita o essencial no celular, anote. Marque no arquivo de achados cada item como feito.

**Entrada e conta**
1. Criar conta (e-mail; link no terminal), entrar, sair, "Esqueci minha senha" (`/forgot-password` → link no terminal → `/reset-password` → entrar de novo: aparece o aviso de segurança), login com senha errada, conta inativa.
2. Verificação em duas etapas (depois da Parte A): ligar por app e por e-mail, entrar com código, "lembrar este dispositivo", esquecer dispositivo, desligar.
3. Convite: em Usuários, convidar alguém (primeiro convite mostra o aviso de segurança); abrir `/accept-invite` com o link do terminal; entrar como o convidado.
4. Configuração inicial `/setup` (conta nova): os 3 passos, cada área (Lutas, Pilates e yoga, Música, Idiomas, Outra área...), voltar, erros ao avançar sem o obrigatório, Enter avança.
5. Site: `/` (landing inteira), `/terms`, `/privacy`, `/plans`, `/plans/checkout` (assinatura: só até a tela de pagamento; não conclua compra real).

**Cadastros**
6. Modalidades `/classes/modalities`: criar, editar, trilha de níveis/faixas, avaliações (notas), inativar.
7. Equipe `/team`: criar professor, editar, horários, inativar/reativar.
8. Planos e pacotes `/classes/plans`: criar plano (mensal, quinzenal, semanal), pacote de aulas, editar, inativar.
9. Turmas `/classes`: criar turma (horários, vagas, aula avulsa, curso com fim e parcelas), editar, **mudar o horário** (pergunta "Avisar os alunos?" → envio em sequência), inativar/reativar, lista e cards, filtros.
10. Alunos `/clients`: criar aluno sem plano, com plano (proporcional, ciclo cheio, pré e pós), bolsista (integral e parcial), com pacote, menor com responsáveis (financeiro), endereço, anexos; editar, trocar de plano, pausar, inativar e reativar; busca e filtros; paginação.

**Dia a dia**
11. Matricular aluno na turma, lista de espera (turma lotada), promover da espera, remover; matrícula em curso com parcelas.
12. Calendário `/classes/calendar`: dia, semana, mês; lista no celular; trocar professor de uma aula (substituto) e voltar.
13. Aula e chamada `/classes/sessions/[id]`: marcar presente, falta, justificada, "Todos vieram", desmarcar; aula avulsa (reserva e cobrança), aluno de pacote (gasta aula), três faltas seguidas (vira lembrete).
14. Ficha do aluno `/clients/[id]`: alertas, cada seção do acordeão, cobranças, presenças, evolução (graduar, registros, metas), notas e boletim em PDF, mensagens (enviar pela ficha), documentos (termo do responsável, declaração anual, recibo).
15. Notas: lançar notas (0 a 10, 0 a 100, conceito), "Faltou/Sem nota", boletim.
16. Certificado: curso terminado → certificado na turma e o PDF.
17. **Lembretes (novo):** no painel e no **sino no topo**: cada grupo (atraso, vence hoje, vence logo, pacote acabando, faltas, aniversário, avanço de nível, boas-vindas, pagamento para agradecer), "Ver", WhatsApp (abre com o texto certo), ⋮ "Lembrar amanhã" e "Não lembrar deste", "Enviar em sequência" (pular, concluir). Conferir que pagar, graduar e mandar mensagem mudam a lista na hora.

**Dinheiro**
18. Cobranças `/classes/billing`: gerar mensalidades, filtros (mês, status, tipo, atraso), registrar pagamento (método, data, anexo), desfazer pagamento, cancelar e reabrir, cobrança avulsa (com parcelas), recibo, lembrete de WhatsApp, cobrar online (seção B.3).
19. Financeiro `/finance`: resumo, lançamento de entrada e saída, pagar e desfazer, recorrência (gerar o mês, encerrar), categorias, anexos; pagamento de professores (regras, prévia, fechar, pagar, reabrir, demonstrativo em PDF).
20. Recebimentos online `/online-payments`: seção B.3.
21. Relatórios `/reports`: cada relatório do catálogo, filtros (mês, turma, aula), prévia, PDF e CSV; os do plano Profissional aparecem bloqueados no Grátis.

**Comunicação**
22. `/communication`: mensagens (avulsa para um aluno e para vários), **Histórico** (troca de página, filtros de status e tipo, busca por nome, telefone e texto, abrir mensagem), modelos (editar, variáveis, prévia), conexão do WhatsApp (assistido; o oficial é Pro).

**Administração**
23. Usuários `/users`: criar cada perfil, convite, editar perfil, inativar/reativar, reenviar convite.
24. Auditoria `/audit`: eventos das ações feitas no teste aparecem; "Carregar mais eventos"; filtros por tipo, autor, período e busca; detalhe do evento.
25. Configurações `/settings`: todas as abas (espaço, unidade e horários, cobrança, pagamento online, certificados, plano/assinatura, preferências); salvar, descartar ao sair com alteração.
26. Menu do usuário: Preferências (tema, densidade, cores), Segurança, trocar perfil (demonstração), sair.

**Perfis** (com o espaço de demonstração, trocando no topo)
27. **Professor:** só as turmas dele, chamada só nas aulas dele (e nas que substitui), ficha sem cobranças, lembretes só dos alunos dele e sem cobrança, menu reduzido; tentar abrir pela URL uma tela proibida (ex.: `/finance`) deve barrar.
28. **Recepção** e **gerente:** o que cada um vê no menu, cobranças, usuários, auditoria (gerente não vê eventos só do dono).

**Fora do foco (só uma olhada, sem detalhar):** modelo de agendamento/barbearia (`/schedule`, `/appointments`, `/services`): segue no modo demonstração.

### B.6 Formato do arquivo de achados

No topo: quantos achados por gravidade, as 5 coisas mais importantes, a lista dos itens da seção B.5 feitos (e os não feitos, com o motivo) e as linhas novas da tabela `error_logs`. Depois, uma tabela por área:

| # | Tela | Fluxo/passo | Tamanho/tema | O que aconteceu | O que devia acontecer | Como repetir | Gravidade |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ficha do aluno | aba Cobranças | celular 375, claro | o valor quebra em duas linhas e empurra o botão para fora | valor numa linha, botão visível | abrir a ficha de um aluno com 3 cobranças | média |

- **Gravidade:** `alta` (impede usar, dado ou valor errado, erro no console ou no servidor, quebra no celular, falha de permissão), `média` (confuso ou feio, mas usa), `baixa` (acabamento).
- Capturas quando ajudarem: `docs/qa/capturas/2026-10-xx/` com nome curto (`ficha-cobrancas-375.png`), citadas na linha.
- **Não corrija nada.** Bug de verdade: `alta`, com os passos para repetir.

### B.7 Pronto quando

- [ ] Todos os itens da seção B.5 executados no desktop e o essencial no celular; as telas principais no tema escuro.
- [ ] Subconta criada no sandbox e o ciclo do pagamento online testado (seção B.3).
- [ ] Perfis professor, recepção e gerente conferidos.
- [ ] Arquivo `docs/qa/2026-10-xx-teste-geral.md` com os achados no formato da seção B.6.
- [ ] Nenhuma correção feita; nada commitado sem o usuário pedir; nada de push.
