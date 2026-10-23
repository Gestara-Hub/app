# 17. Verificação em duas etapas (2FA)

Status: entrega 1 (aplicativo autenticador) em andamento; entrega 2 (código por e-mail e aviso no painel) a fazer.

## Decisao

Quem entra com senha pode ligar a verificação em duas etapas. Depois da senha, o login pede um código de 6 dígitos. A sessão do app só é criada depois do código.

- **Entrega 1: aplicativo autenticador (TOTP).**
  - Usa o MFA do Supabase Auth (Google Authenticator, Microsoft Authenticator, 1Password e outros).
  - O cadastro é por QR code ou por chave digitada.
  - Liga e desliga em "Segurança", no menu do usuário. Para desligar, pede um código do app.
- **Entrega 2: código por e-mail e aviso no painel.**
  - Código por e-mail como alternativa ao app, feito por nós: código de 6 dígitos, 10 minutos, só o hash no banco, envio pelo MailerSend. É o mesmo padrão do "Esqueci minha senha" (migração 36).
  - "Lembrar este dispositivo por 30 dias".
  - Aviso discreto e dispensável no painel, só para o dono e só depois que ele ativar o pagamento online.
- **Contas só do Google ficam de fora.** O Google já tem a verificação em duas etapas dele. A tela de Segurança explica isso e não oferece o app.
- **Opcional por enquanto.** Exigir o 2FA para ações sensíveis, como trocar a conta de recebimento, fica para depois.

## Contexto

O dono do espaço mexe com dinheiro (Pix e links de pagamento pelo Asaas). Uma senha vazada ou repetida em outro site daria acesso às cobranças e aos dados dos alunos.

O público não é técnico, por isso o código por e-mail entra como alternativa ao app. Ele protege menos, porque quem invade o e-mail já troca a senha pelo "Esqueci minha senha". Mesmo assim, segura o caso mais comum: senha vazada.

## Escopo

**Login com senha** (`signInWithPasswordAction`, `app/(auth)/signup-actions.ts`):
- Senha certa com fator TOTP verificado deixa a sessão do Supabase em AAL1, com AAL2 como próximo nível.
- Nesse caso a action não grava o cookie `gestarahub_session` e responde `twoFactorRequired`.
- O formulário leva para `/two-factor`.

**Tela `/two-factor`** (`app/(auth)/two-factor/`):
- Pede o código, faz `challengeAndVerify` no fator TOTP e só então cria a sessão do app (`finishSignIn`).
- "Usar outra conta" encerra a sessão do Supabase.

**Google** (`app/auth/callback/route.ts`):
- Uma conta com senha e Google que ligou o 2FA também passa por `/two-factor`.
- Conta só do Google não tem fator, então segue direto.

**Dados** (`getClientForTenant`, `lib/supabase/tenant-client.ts`):
- Recusa uma sessão AAL1 de quem tem 2FA.
- Sem o código, a sessão do Supabase não lê nem grava nada pelo RLS, mesmo que alguém chame uma server action direto.

**Segurança no menu do usuário** (`features/auth/components/two-factor-dialog.tsx` e `app/(auth)/two-factor-actions.ts`):
- Mostra o estado e liga ou desliga o app.
- O cadastro apaga antes um fator não confirmado que tenha ficado para trás.
- Desligar pede um código válido e só então remove o fator. O Supabase também exige AAL2 para isso.

**Supabase:**
- Local: `[auth.mfa.totp]` com `enroll_enabled` e `verify_enabled` em `apps/supabase/config.toml`. Precisa reiniciar o Supabase local.
- Produção: o TOTP já vem ligado nos projetos hospedados. Conferir em Authentication, Multi-Factor no painel.

**Ainda não feito:**
- Política RLS restritiva por `aal` no banco. Hoje a barreira está no app (`getClientForTenant` e o cookie da sessão).
- Registro no histórico (auditoria) de ligar e desligar.
- Códigos de recuperação. Quem perder o celular precisa que o suporte remova o fator pelo painel do Supabase. A entrega 2 resolve com o código por e-mail como alternativa.

## Alternativas

- **SMS:** tem custo por mensagem, é mais fraco (troca de chip) e o Supabase cobra à parte. Descartado.
- **Código por e-mail como única opção:** é o mais simples para o público, mas protege menos. Fica como alternativa na entrega 2, não como principal.
- **Passkeys (WebAuthn):** é o melhor para segurança e uso, mas o suporte no Supabase ainda é recente. Fica para avaliar depois.
- **2FA obrigatório para todos:** atrito alto num produto grátis que acabou de ganhar o cadastro em uma tela. Começa opcional, e a obrigação por ação sensível fica para depois.
