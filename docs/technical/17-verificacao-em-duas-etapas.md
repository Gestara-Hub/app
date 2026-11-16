# 17. Verificação em duas etapas (2FA)

Data: 2026-10-22.

Status: entrega 1 (aplicativo autenticador) e entrega 2 (código por e-mail e "lembrar este dispositivo") feitas em 23/10/2026. O aviso para ligar (doc product/25, seção 5) oferece os dois métodos.

## Decisao

Quem entra com senha pode ligar a verificação em duas etapas. Depois da senha, o login pede um código de 6 dígitos. A sessão do app só é criada depois do código.

- **Entrega 1: aplicativo autenticador (TOTP).**
  - Usa o MFA do Supabase Auth (Google Authenticator, Microsoft Authenticator, 1Password e outros).
  - O cadastro é por QR code ou por chave digitada.
- **Entrega 2: código por e-mail e "lembrar este dispositivo".**
  - Código por e-mail como alternativa ao app, feito por nós: 6 dígitos, 10 minutos, só o hash no banco, envio pelo Amazon SES. É o mesmo padrão do "Esqueci minha senha" (migração 36).
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
| Remover um método (30/10/2026) | só com os dois ligados; pede o código do método que **fica** (prova que ele funciona e a sessão atual segue verificada por ele). Remover o e-mail apaga as `two_factor_sessions` com `method = email`; remover o app derruba o AAL2 das sessões. Códigos de recuperação e dispositivos lembrados continuam |
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
- Com os dois ligados, cada método tem "Remover" (`removeTwoFactorMethodAction`, `removeAppTwoFactor` e `removeEmailTwoFactor` em `services/server/twoFactor.ts`). Remover o app pede o código do e-mail e grava a prova desta sessão pelo e-mail antes de apagar o fator; remover o e-mail pede o código do app. Com um método só não há "Remover": é o "Desligar".
- **Auditoria:** ligar (app ou e-mail), remover um método e desligar viram evento de segurança no histórico, com o próprio usuário como alvo (o gerente não vê eventos do dono).

**E-mail** (`sendTwoFactorCodeEmail`, `lib/email/ses.ts`): assunto "Seu código de acesso ao GestaraHub", o código em destaque e "Vale por 10 minutos. Se não foi você, troque sua senha." Sem credenciais AWS SES em desenvolvimento, o código sai no terminal do `pnpm dev`; em produção sem chave, `logError` e mensagem de falha.

**Supabase:**
- Local: `[auth.mfa.totp]` com `enroll_enabled` e `verify_enabled` em `apps/supabase/config.toml`. Precisa reiniciar o Supabase local.
- Produção: o TOTP já vem ligado nos projetos hospedados. Conferir em Authentication, Multi-Factor no painel.

## Códigos de recuperação e reinício pelo painel (24/10/2026)

**Códigos de recuperação.** Ao ligar a verificação pela primeira vez (app ou e-mail), a pessoa recebe 8 códigos de uso único (`ABCD-EFGH`, 32 símbolos sem 0, O, 1 e I), mostrados só uma vez com "Copiar" e "Baixar arquivo". No banco, `two_factor_recovery_codes` guarda só o hash (`recovery:usuário:código`), com RLS sem políticas (migração 58). Onde servem:
- **Login:** na tela `/two-factor`, "Perdi o acesso ao código". O código gasto prova o segundo fator da sessão (`two_factor_sessions.method = 'recovery'`) e vale uma vez, mesmo com dois cliques juntos. Entra no mesmo limite de tentativas dos outros códigos.
- **Desligar:** quem perdeu o aplicativo desliga com um código de recuperação e liga de novo com o aparelho novo.
- **Gerar novos** (Segurança, "Códigos de recuperação"): pede um código atual do app ou do e-mail (propósito `recovery`) e troca os 8 por novos; os antigos deixam de valer. Vira evento de segurança na auditoria.
- Desligar o 2FA apaga os códigos. A janela Segurança mostra quantos restam.

**Reinício pelo painel.** Quem perdeu o aplicativo e os códigos pede ajuda no Fale com a gente. O proprietário do GestaraHub abre o espaço no painel, aba "Dados e LGPD", escolhe a pessoa e reinicia (motivo obrigatório, confirmação em dois toques; antes, confirmar quem é por fora do sistema). O painel remove o app e desliga o e-mail pela API de administração do Auth, limpa dispositivos lembrados, sessões verificadas e códigos (`platform.finish_user_two_factor_reset`, migração 59), registra na Auditoria do espaço (o dono do espaço vê) e do painel, e avisa a pessoa por e-mail. Código: `apps/admin/src/lib/server/user-two-factor.ts`.

## Troca do e-mail de acesso (05/11/2026)

**Quem troca é a própria pessoa**, no menu da conta → "E-mail de acesso" (`features/auth/components/access-email-dialog.tsx`). O dono do espaço não troca o e-mail de outra pessoa: poderia pôr um e-mail dele e tomar a conta pedindo uma senha nova. Em Usuários o e-mail continua travado depois da ativação.

- **Pedido** (`app/(auth)/email-change-actions.ts`): novo e-mail + senha atual (conferida num cliente à parte, encerrando só aquela sessão). Quem entra só pelo Google (sem senha) confirma com um código de 6 números no e-mail atual (propósito `email_change`, migração 88). Com a verificação ligada, só a sessão que já passou pelo segundo fator. Limite de 5 pedidos a cada 15 minutos. Não vale na demonstração. Vira evento de segurança na Auditoria.
- **Link** (`services/server/emailChange.ts`, tabela `email_change_tokens`, migração 87, só o hash, RLS sem políticas): vai para o e-mail novo, vale 1 hora e uma vez só; pedir de novo invalida o anterior. O e-mail novo não pode ser de acesso de outra conta nem de um convite em aberto, em nenhum espaço (busca sem curinga, `likeExact`).
- **Confirmação** (`/confirm-email?token=`, pública como a de nova senha): abrir a página não confirma, o botão confirma (o leitor de links do e-mail abre a mensagem sozinho). Confere de novo se o e-mail ficou livre, troca no Auth e em todas as linhas da pessoa em `users` (uma por espaço) e avisa o e-mail antigo, com o novo mascarado. Depois a conta entra só pelo e-mail novo (`public.use_email_login`, migração 88): sai o login do Google antigo, fica a identidade de e-mail e todas as sessões e dispositivos lembrados caem. Quem tinha senha continua com ela; quem entrava só pelo Google cria a senha na própria página.
- **Perdeu o acesso ao e-mail** (ex.: perdeu o Gmail, nada no sistema prova quem é): o proprietário do GestaraHub confirma quem é a pessoa por fora e troca no painel, aba "Dados e LGPD" do espaço, "Trocar o e-mail de acesso de uma pessoa" (pessoa, e-mail novo, motivo, confirmação). `platform.change_user_access_email` faz tudo numa transação: troca o e-mail, `use_email_login`, grava o link de criar senha em `password_reset_tokens` (24 horas, o `/reset-password` do app) e registra nas Auditorias do espaço e do painel. O e-mail novo recebe o link e o antigo um aviso (`apps/admin/src/lib/server/user-access-email.ts`). O dono do espaço não faz isso: poderia tomar a conta de outra pessoa.
- **Instrutor:** o e-mail do cadastro do instrutor é "E-mail de contato" e não muda o acesso; o vínculo com o usuário é só o gravado (`users.professional_id`), e o aviso mostra o e-mail de acesso.

## Testes

- Vitest (`lib/__tests__/two-factor-rules.test.ts`): código, hash, validade, tentativas, reenvio, máscara do e-mail, nome do dispositivo, último uso e conta só do Google.
- Banco (`app/(auth)/__tests__/twoFactorRecovery.db.test.ts`: 8 códigos uma vez só, uso único, prova da sessão, desligar e gerar novos; `twoFactor.db.test.ts` e `twoFactorEmail.db.test.ts`): senha sem verificação entra; com o e-mail ligado, a senha sozinha não lê dados (`getClientForTenant` e `requireTenant` recusam) até o código; outra sessão segue barrada; 5 erros revogam, vencido e usado não valem, código novo revoga o anterior, o propósito separa; limite de reenvio; dispositivo lembrado entra sem código (vencido, revogado ou de outro usuário não vale); app + dispositivo lembrado entra sem o código do app; ligar pelo e-mail e desligar (revoga dispositivos e sessões, auditoria); desligar com o app remove o fator; remover o e-mail com o código do app e remover o app com o código do e-mail (o outro fica, códigos e dispositivos ficam, a sessão segue lendo, auditoria) e, com um método só, remover recusa.
- Banco (`services/server/__tests__/emailChange.db.test.ts`): troca pelo link (entra com o novo, a linha do espaço muda, uma vez só), mesmo e-mail, inválido, em uso por outra conta, curinga, e-mail ocupado com o link em aberto, novo pedido invalida o anterior e vencimento em 1 hora; conta só do Google cria a senha ao confirmar (sai o Google), quem tem senha continua com ela e sai das sessões; troca pelo painel (motivo, e-mail em uso, Google removido, link de criar senha, as duas auditorias).
- E2E (área `acesso`): `e2e/verificacao-email.spec.ts` (ligar pelo e-mail, sair, entrar com código, lembrar, entrar sem código, esquecer) e `e2e/seguranca-aviso.spec.ts` ("Ativar agora" abre a escolha). O código vem de `setKnownTwoFactorEmailCode` (`e2e/db.ts`), que grava um hash conhecido.

## Ainda não feito

- Política RLS restritiva por `aal` no banco. Hoje a barreira está no servidor (`requireTenant`, `getClientForTenant`) e no cookie da sessão.
- Aviso por e-mail ao usar um código de recuperação no login (hoje só o painel avisa, quando reinicia o 2FA de alguém).
- Ações que confiam só no cookie `gestarahub_session` (não assinado) e usam a chave de serviço, sem passar pelo `requireTenant` (ex.: `persistSetupToBackendAction`), não passam pela barreira. Vale revisar quando o cookie virar token assinado.

## Perguntas para o usuário

Registradas em 23/10/2026 durante a entrega 2, com a escolha feita para seguir:

1. **Desligar um método só.** Decidido em 30/10/2026: "Remover" por método, com os dois ligados (ver Regras e Fluxos). "Desligar" segue desligando tudo.
2. **Demonstração sem verificação.** Decidido em 30/10/2026 (usuário confirmou): ligar a verificação fica bloqueado no espaço de demonstração (todos usam as mesmas contas) e o aviso de segurança não aparece lá.
3. **Esquecer um dispositivo não encerra a sessão aberta nele.** Decidido em 30/10/2026 (usuário confirmou): o próximo login nele pede o código; a sessão que já está aberta segue até sair ou vencer (7 dias), como fazem Google e bancos.
4. **Login de convidado.** `finishSignIn` busca o usuário por `users.id = id da conta de login`, mas o convidado tem `users.id` próprio (ligado por `auth_user_id`). Parece impedir o login com senha de quem entrou por convite. Não mexi (fora do escopo); fica para conferir no teste geral (Parte B).
