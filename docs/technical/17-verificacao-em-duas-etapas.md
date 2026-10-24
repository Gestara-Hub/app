# 17. Verificação em duas etapas (2FA)

Status: entrega 1 (aplicativo autenticador) e entrega 2 (código por e-mail e "lembrar este dispositivo") feitas em 23/10/2026. O aviso para ligar (doc product/25, seção 5) oferece os dois métodos.

## Decisao

Quem entra com senha pode ligar a verificação em duas etapas. Depois da senha, o login pede um código de 6 dígitos. A sessão do app só é criada depois do código.

- **Entrega 1: aplicativo autenticador (TOTP).**
  - Usa o MFA do Supabase Auth (Google Authenticator, Microsoft Authenticator, 1Password e outros).
  - O cadastro é por QR code ou por chave digitada.
- **Entrega 2: código por e-mail e "lembrar este dispositivo".**
  - Código por e-mail como alternativa ao app, feito por nós: 6 dígitos, 10 minutos, só o hash no banco, envio pelo MailerSend. É o mesmo padrão do "Esqueci minha senha" (migração 36).
  - "Lembrar este dispositivo por 30 dias" na tela do código, para os dois métodos.
  - Quem tem o app pode ligar o e-mail também (útil se perder o celular). Quem tem só o e-mail pode ligar o app depois.
  - Aviso para ligar: janela em quatro momentos (pagamento online ativado, primeiro convite, senha nova, 7 dias de uso), para dono e gerente, decidido em 23/10/2026 (doc product/25, seção 5). "Ativar agora" abre a escolha entre os dois métodos.
- **Contas só do Google ficam de fora.** O Google já tem a verificação em duas etapas dele. A tela de Segurança explica isso e não oferece nada.
- **Espaço de demonstração fica de fora** (23/10/2026). Todos entram na demonstração com as mesmas contas: ligar a verificação ali trancaria a demonstração para todo mundo. A janela Segurança diz "Na demonstração, a verificação fica desligada." e o aviso não aparece.
- **Opcional por enquanto.** Exigir o 2FA para ações sensíveis, como trocar a conta de recebimento, fica para depois.

## Contexto

O dono do espaço mexe com dinheiro (Pix e links de pagamento pelo Asaas). Uma senha vazada ou repetida em outro site daria acesso às cobranças e aos dados dos alunos.

O público não é técnico, por isso o código por e-mail entra como alternativa ao app. Ele protege menos, porque quem invade o e-mail já troca a senha pelo "Esqueci minha senha". Mesmo assim, segura o caso mais comum: senha vazada.

## Barreira

O Supabase só conhece o app (sessão AAL2). O código por e-mail e o dispositivo lembrado são nossos: depois deles, a sessão do Supabase continua AAL1. O cookie `gestarahub_session` não é assinado (base64 de JSON), então nunca serve de prova.

Uma regra só, em `secondFactorState` (`lib/security/second-factor.ts`), devolve `not_required`, `satisfied` ou `missing`:

- **Quem precisa do segundo fator:** tem o app confirmado (fatores do `getUser()`, que vêm atuais do servidor) **ou** ligou o e-mail (`app_metadata.two_factor_email = true`, gravado pelo servidor com a chave de serviço; o usuário não consegue mudar o `app_metadata`).
- **Prova nesta sessão:** a sessão está em AAL2 (app) **ou** existe uma linha válida em `two_factor_sessions` para o `session_id` da sessão do Supabase (claim do access token, já conferido pelo `getUser`).

Quem usa a regra:
- `requireTenant` (`services/server/tenant.ts`), que serve quase todas as server actions, e `getClientForTenant` (`lib/supabase/tenant-client.ts`): com `missing`, recusam ("Falta o código da verificação em duas etapas. Entre de novo."). Até 23/10/2026 só o `getClientForTenant` conferia, e quase nada passava por ele: o `requireTenant` deixava uma sessão AAL1 ler e gravar.
- `needsSecondFactor` (`app/(auth)/sign-in-session.ts`), no login com senha e na volta do Google: com `missing`, tenta o dispositivo lembrado; sem ele, manda para `/two-factor`.

## Banco (migração 48)

Tudo com RLS ligado e sem políticas: só a chave de serviço, no servidor.

| Tabela | Para que |
| --- | --- |
| `two_factor_email_codes` | Código por e-mail: `purpose` (`login`, `enable`, `disable`), `code_hash`, `status` (`pending`, `consumed`, `revoked`), `attempts`, `expires_at`. |
| `two_factor_sessions` | Prova do segundo fator por sessão do Supabase (`session_id`), `method` (`email` ou `device`), vence junto com o cookie do app (`SESSION_MAX_AGE`, 7 dias). |
| `trusted_devices` | Dispositivo lembrado: `token_hash`, `label` (navegador e sistema, sem IP), `last_used_at`, `expires_at` (30 dias), `revoked_at`. |

Limpeza diária (`two-factor-prune-daily`, pg_cron, 06:50 UTC): códigos vencidos há mais de 1 dia, sessões vencidas e dispositivos vencidos ou esquecidos há mais de 30 dias.

## Regras

Constantes em `lib/security/two-factor-rules.ts`:

| Regra | Valor |
| --- | --- |
| Código | 6 números (`randomInt` de `node:crypto`); no banco, SHA-256 de `usuário:código` |
| Validade | 10 minutos |
| Tentativas por código | 5; na quinta errada o código é revogado e precisa pedir outro |
| Reenviar | no mínimo 60 s entre envios do mesmo propósito; no máximo 5 envios a cada 15 min por usuário (`checkRateLimit`) |
| Código novo | revoga os anteriores do mesmo usuário e propósito |
| Tentativas de código no geral | 6 a cada 5 minutos por usuário (app e e-mail, `allowCodeAttempt`) |
| Lembrar dispositivo | 30 dias; token de 32 bytes no cookie `gestarahub_trusted_device` (`httpOnly`, `secure` em produção, `sameSite=lax`, validade relativa com `maxAge`); só o hash no banco |
| Desligar | pede um código (do app ou do e-mail); remove o app, o e-mail, todos os dispositivos lembrados e as `two_factor_sessions` do usuário |
| Sair | apaga a `two_factor_sessions` da sessão; o dispositivo lembrado continua |

## Fluxos

**Login com senha** (`signInWithPasswordAction`, `app/(auth)/signup-actions.ts`) e **Google** (`app/auth/callback/route.ts`):
- Senha certa com o segundo fator ligado e sem dispositivo lembrado: não grava o cookie `gestarahub_session` e manda para `/two-factor`.
- Dispositivo lembrado e válido para esse usuário: grava `two_factor_sessions(method=device)`, atualiza `last_used_at` e entra direto. Vale também para quem tem o app.

**Tela `/two-factor`** (`app/(auth)/two-factor/`):
- Com o app, começa por ele; com app e e-mail, mostra "Receber por e-mail" como alternativa.
- Só com o e-mail, envia o código ao abrir a tela (uma vez): "Enviamos um código para ma***@gmail.com", "Reenviar código" com o tempo de espera.
- Caixa "Lembrar este dispositivo por 30 dias".
- Código do e-mail certo: grava `two_factor_sessions(method=email)` com o `session_id` atual e chama `finishSignIn`.
- "Usar outra conta" encerra a sessão do Supabase.

**Segurança no menu do usuário** (`features/auth/components/two-factor-dialog.tsx` e `app/(auth)/two-factor-actions.ts`):
- Mostra os dois métodos com o estado de cada um. Desligado: "Usar aplicativo" (QR code, como na entrega 1) e "Usar e-mail" (e-mail mascarado, "Enviar código", código, "Ligar").
- Ao ligar pelo e-mail, a sessão atual já conta como verificada (senão a barreira trancaria quem acabou de ligar).
- Ligada: lista "Dispositivos lembrados" (nome, "Último uso há 2 dias", "Este dispositivo"), com "Esquecer" e "Esquecer todos".
- "Desligar" pede o código do app (com "Receber código por e-mail" se o e-mail estiver ligado) ou do e-mail. O app é removido pela chave de serviço, porque quem entrou por dispositivo lembrado está em AAL1.
- **Auditoria:** ligar (app ou e-mail) e desligar viram evento de segurança no histórico, com o próprio usuário como alvo (o gerente não vê eventos do dono).

**E-mail** (`sendTwoFactorCodeEmail`, `lib/email/mailersend.ts`): assunto "Seu código de acesso ao GestaraHub", o código em destaque e "Vale por 10 minutos. Se não foi você, troque sua senha." Sem `MAILERSEND_API_KEY` em desenvolvimento, o código sai no terminal do `pnpm dev`; em produção sem chave, `logError` e mensagem de falha.

**Supabase:**
- Local: `[auth.mfa.totp]` com `enroll_enabled` e `verify_enabled` em `apps/supabase/config.toml`. Precisa reiniciar o Supabase local.
- Produção: o TOTP já vem ligado nos projetos hospedados. Conferir em Authentication, Multi-Factor no painel.

## Testes

- Vitest (`lib/__tests__/two-factor-rules.test.ts`): código, hash, validade, tentativas, reenvio, máscara do e-mail, nome do dispositivo, último uso e conta só do Google.
- Banco (`app/(auth)/__tests__/twoFactor.db.test.ts` e `twoFactorEmail.db.test.ts`): senha sem verificação entra; com o e-mail ligado, a senha sozinha não lê dados (`getClientForTenant` e `requireTenant` recusam) até o código; outra sessão segue barrada; 5 erros revogam, vencido e usado não valem, código novo revoga o anterior, o propósito separa; limite de reenvio; dispositivo lembrado entra sem código (vencido, revogado ou de outro usuário não vale); app + dispositivo lembrado entra sem o código do app; ligar pelo e-mail e desligar (revoga dispositivos e sessões, auditoria); desligar com o app remove o fator.
- E2E (área `acesso`): `e2e/verificacao-email.spec.ts` (ligar pelo e-mail, sair, entrar com código, lembrar, entrar sem código, esquecer) e `e2e/seguranca-aviso.spec.ts` ("Ativar agora" abre a escolha). O código vem de `setKnownTwoFactorEmailCode` (`e2e/db.ts`), que grava um hash conhecido.

## Ainda não feito

- Política RLS restritiva por `aal` no banco. Hoje a barreira está no servidor (`requireTenant`, `getClientForTenant`) e no cookie da sessão.
- Códigos de recuperação do app. Quem perder o celular e não ligou o e-mail precisa que o suporte remova o fator pelo painel do Supabase.
- Ações que confiam só no cookie `gestarahub_session` (não assinado) e usam a chave de serviço, sem passar pelo `requireTenant` (ex.: `persistSetupToBackendAction`), não passam pela barreira. Vale revisar quando o cookie virar token assinado.

## Perguntas para o usuário

Registradas em 23/10/2026 durante a entrega 2, com a escolha feita para seguir:

1. **Desligar um método só.** Hoje "Desligar" desliga tudo (app, e-mail e dispositivos), como pedia o plano. Quem tem os dois e quer tirar só um precisa desligar e ligar de novo o que quer manter. Escolha: manter assim. Quer um "Remover" por método?
2. **Demonstração sem verificação.** Bloqueei ligar a verificação no espaço de demonstração (todos usam as mesmas contas). O aviso de segurança também não aparece lá. Escolha: bloquear. Confirma?
3. **Esquecer um dispositivo não encerra a sessão aberta nele.** O próximo login nele pede o código; a sessão que já está aberta segue até sair ou vencer (7 dias). Escolha: manter, como fazem Google e bancos. Quer encerrar também?
4. **Login de convidado.** `finishSignIn` busca o usuário por `users.id = id da conta de login`, mas o convidado tem `users.id` próprio (ligado por `auth_user_id`). Parece impedir o login com senha de quem entrou por convite. Não mexi (fora do escopo); fica para conferir no teste geral (Parte B).
