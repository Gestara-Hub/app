"use client";

import { RequiredMark } from "@/components/form";
import { useState, useTransition } from "react";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE, isPasswordLongEnough } from "@/lib/password-rules";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsService } from "@/services/settings/settingsService";
import { GoogleDivider, GoogleSignInButton } from "@/features/auth";
import {
  completeSignupWithPassword,
  requestSignupLink,
  signInDemoAction,
  signInWithPasswordAction,
  type ValidateSignupTokenResult,
} from "../signup-actions";
import { focusField } from "@/lib/form-errors";
import { isValidEmail } from "@/lib/email-format";
import { startNavigationProgress } from "@/lib/unsaved-changes";

interface LoginFormProps {
  from: string;
  initialEmail?: string;
  tokenValidation?: ValidateSignupTokenResult | null;
  /** Ambiente com o espaco de demonstracao no banco (DEMO_PASSWORD). */
  demoAvailable?: boolean;
  /** Motivo da volta do Google sem entrar (`?google_error=`, rota /auth/callback). */
  googleError?: string;
  /** Voltou da troca de senha (`?reset=ok`). */
  passwordReset?: boolean;
  /** Com o cadastro na mesma tela: "Criar conta grátis" troca a aba em vez de ir para a landing. */
  onCreateAccount?: () => void;
}

/** Mensagens da volta do Google (codigos de `resolveGoogleAccount` e da rota). */
const GOOGLE_ERRORS: Record<string, string> = {
  cancelled: "Você cancelou a entrada com Google.",
  failed: "Não foi possível entrar com Google. Tente novamente.",
  invite_invalid: "Este convite expirou ou já foi usado. Peça um novo ao responsável.",
  invite_email_mismatch: "Entre com a conta Google do e-mail que recebeu o convite.",
  email_in_use: "Este e-mail já tem uma conta. Entre com sua senha.",
  inactive: "Sua conta está inativa. Procure o responsável pelo espaço.",
  error: "Não foi possível concluir a entrada. Tente novamente.",
};

export function LoginForm({
  from,
  initialEmail,
  tokenValidation: initialTokenValidation = null,
  demoAvailable = false,
  googleError,
  passwordReset = false,
  onCreateAccount,
}: LoginFormProps) {
  const router = useRouter();
  const [tokenState, setTokenState] = useState<ValidateSignupTokenResult | null>(
    initialTokenValidation,
  );

  // Estado de criacao de senha (quando tokenState.status === "valid")
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Campo do erro de senha: embaixo dele; sem campo (erro do servidor), no fim.
  const [passwordErrorField, setPasswordErrorField] = useState<"new" | "confirm" | null>(null);
  const [isCreatingAccount, startCreateTransition] = useTransition();

  // Estado de reenvio quando o link expirou (tokenState.status === "expired")
  const [resentToEmail, setResentToEmail] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isResendingLink, startResendTransition] = useTransition();

  // Estado do login padrao (e-mail + senha)
  const [loginEmail, setLoginEmail] = useState(
    initialTokenValidation?.status === "consumed"
      ? initialTokenValidation.email
      : initialEmail ?? "",
  );
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  // Campos vazios no ultimo "Entrar": ficam marcados (borda vermelha) ate a pessoa digitar.
  const [missingLoginFields, setMissingLoginFields] = useState({ email: false, password: false });
  const [isSigningIn, startSignInTransition] = useTransition();

  // Acesso de demonstracao (espaco de demonstracao no banco)
  const [isDemoPending, startDemoTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // 1. MODO CRIAR SENHA (link valido dentro de 24h)
  // ---------------------------------------------------------------------------
  if (tokenState?.status === "valid") {
    const handleCreatePassword = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setPasswordError(null);
      setPasswordErrorField(null);

      if (!isPasswordLongEnough(newPassword)) {
        setPasswordError(PASSWORD_TOO_SHORT_MESSAGE);
        setPasswordErrorField("new");
        focusField("signup-new-password");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("As senhas não conferem. Digite a mesma senha nos dois campos.");
        setPasswordErrorField("confirm");
        focusField("signup-confirm-password");
        return;
      }

      startCreateTransition(async () => {
        const result = await completeSignupWithPassword({
          token: tokenState.token,
          password: newPassword,
        });

        if (!result.ok) {
          if (result.code === "expired") {
            setTokenState({
              status: "expired",
              email: result.email ?? tokenState.email,
              name: result.name ?? tokenState.name,
            });
            return;
          }
          setPasswordError(result.message);
          return;
        }

        // Hidrata o novo tenant criado no Supabase dentro do store local e limpa rascunhos antigos
        try {
          window.sessionStorage.removeItem("gestarahub:setup-draft");
        } catch {
          // Ignora se sessionStorage indisponivel
        }
        settingsService.hydrateTenant({
          organization: result.organization,
          unit: result.unit,
          user: result.user,
          categories: result.categories,
        });

        toast.success("Conta criada com sucesso! Vamos configurar seu espaço.");
        startNavigationProgress({ immediate: true });
        router.push("/setup");
        router.refresh();
      });
    };

    return (
      <form onSubmit={handleCreatePassword} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="signup-locked-email" className="flex items-center justify-between">
            <span>E-mail</span>
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Lock className="size-3" />
              Confirmado pelo link
            </span>
          </Label>
          <Input
            id="signup-locked-email"
            type="email"
            value={tokenState.email}
            disabled
            readOnly
            className="bg-muted/60 text-muted-foreground cursor-not-allowed font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-new-password">
            <span>
              Senha
              <RequiredMark />
            </span>
          </Label>
          <div className="relative">
            <Input
              id="signup-new-password"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
              autoComplete="new-password"
              aria-invalid={(passwordError && passwordErrorField === "new") || undefined}
              aria-describedby={passwordError && passwordErrorField === "new" ? "signup-password-error" : undefined}
              required
              disabled={isCreatingAccount}
              className="pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowNewPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {passwordError && passwordErrorField === "new" ? (
            <p id="signup-password-error" role="alert" className="text-xs text-destructive">
              {passwordError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-confirm-password">
            <span>
              Confirmar senha
              <RequiredMark />
            </span>
          </Label>
          <div className="relative">
            <Input
              id="signup-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="Repita a senha escolhida"
              autoComplete="new-password"
              aria-invalid={(passwordError && passwordErrorField === "confirm") || undefined}
              aria-describedby={passwordError && passwordErrorField === "confirm" ? "signup-password-error" : undefined}
              required
              disabled={isCreatingAccount}
              className="pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label={
                showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"
              }
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {passwordError && passwordErrorField === "confirm" ? (
            <p id="signup-password-error" role="alert" className="text-xs text-destructive">
              {passwordError}
            </p>
          ) : null}
        </div>

        {passwordError && !passwordErrorField ? (
          <p role="alert" className="text-sm text-destructive">
            {passwordError}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isCreatingAccount}
          className="w-full gap-2 font-semibold"
        >
          {isCreatingAccount ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Criando sua conta…
            </>
          ) : (
            <>
              Criar senha e continuar
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. MODO LINK EXPIRADO (> 24h ou substituido por novo envio)
  // ---------------------------------------------------------------------------
  if (tokenState?.status === "expired") {
    const handleResendExpiredLink = () => {
      setResendError(null);
      startResendTransition(async () => {
        const result = await requestSignupLink({
          name: tokenState.name,
          email: tokenState.email,
          forceResend: true,
        });

        if (result.status === "sent") {
          setResentToEmail(result.email);
          toast.success("Novo link enviado para seu e-mail!");
          return;
        }

        if (result.status === "account_exists") {
          setLoginEmail(result.email);
          setTokenState(null);
          toast.info("Sua conta já foi criada. Entre com seu e-mail e senha.");
          return;
        }

        if (result.status === "error") {
          setResendError(result.message);
        }
      });
    };

    if (resentToEmail) {
      return (
        <div
          role="status"
          className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                Novo link enviado com sucesso!
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Enviamos um novo link de criação de conta (válido por 24 horas) para{" "}
                <strong className="font-semibold text-foreground break-words">{resentToEmail}</strong>.
                Abra seu e-mail e clique no botão para definir sua senha.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setTokenState(null)}
            className="w-full"
          >
            Voltar para o login
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Este link de criação de conta expirou
              </p>
              <p className="text-muted-foreground leading-relaxed">
                O link enviado para{" "}
                <strong className="font-medium text-foreground break-words">
                  {tokenState.email}
                </strong>{" "}
                passou do prazo de 24 horas ou foi substituído por um envio mais recente.
                Deseja gerar e receber um novo link agora?
              </p>
            </div>
          </div>
        </div>

        {resendError ? (
          <p role="alert" className="text-sm text-destructive">
            {resendError}
          </p>
        ) : null}

        <Button
          type="button"
          onClick={handleResendExpiredLink}
          disabled={isResendingLink}
          className="w-full gap-2 font-semibold"
        >
          {isResendingLink ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Gerando e enviando novo link…
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              Gerar e enviar novo link
            </>
          )}
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setTokenState(null)}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline cursor-pointer"
          >
            Já tenho senha · Ir para o login
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. MODO LOGIN PADRAO (e-mail + senha + acesso de demonstracao)
  // ---------------------------------------------------------------------------
  const handlePasswordSignIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    // Campo obrigatorio vazio: avisa e poe o foco nele, sem ir ao servidor (10/11/2026).
    // E-mail vazio ou fora do formato (algo@dominio.tld) e erro do campo, nao do servidor.
    const emailMissing = !loginEmail.trim() || !isValidEmail(loginEmail);
    const passwordMissing = !loginPassword;
    if (emailMissing || passwordMissing) {
      // A mensagem vai embaixo de cada campo vazio (nao no fim do formulario).
      setMissingLoginFields({ email: emailMissing, password: passwordMissing });
      document.getElementById(emailMissing ? "login-email" : "login-password")?.focus();
      return;
    }
    setMissingLoginFields({ email: false, password: false });

    startSignInTransition(async () => {
      const result = await signInWithPasswordAction({
        email: loginEmail,
        password: loginPassword,
        from,
      });

      if (!result.ok && result.twoFactorRequired) {
        // Senha certa e verificacao em duas etapas ligada (doc 17): falta o codigo.
        startNavigationProgress({ immediate: true });
        router.push(`/two-factor?from=${encodeURIComponent(from)}`);
        return;
      }
      if (!result.ok) {
        setLoginError(result.message);
        // E-mail ou senha errados: volta para a senha, ja selecionada para digitar de novo.
        const passwordInput = document.getElementById("login-password") as HTMLInputElement | null;
        passwordInput?.focus();
        passwordInput?.select();
        return;
      }

      settingsService.hydrateTenant({
        organization: result.organization,
        unit: result.unit,
        user: result.user,
        categories: result.categories,
      });

      startNavigationProgress({ immediate: true });
      router.push(result.redirectTo);
      router.refresh();
    });
  };

  const onEnterDemo = () => {
    setLoginError(null);
    startDemoTransition(async () => {
      const result = await signInDemoAction(from);
      if (!result.ok) {
        setLoginError(result.message);
        return;
      }
      settingsService.hydrateTenant({
        organization: result.organization,
        unit: result.unit,
        user: result.user,
        categories: result.categories,
      });
      startNavigationProgress({ immediate: true });
      router.push(result.redirectTo);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {tokenState?.status === "consumed" ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs leading-relaxed text-foreground"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground text-sm">
              Sua senha já foi cadastrada
            </p>
            <p className="text-muted-foreground">
              Você já concluiu o cadastro para{" "}
              <strong className="text-foreground">{tokenState.email}</strong>. Digite sua senha
              abaixo para acessar seu espaço.
            </p>
          </div>
        </div>
      ) : null}

      {tokenState?.status === "invalid" ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs leading-relaxed text-destructive"
        >
          Link de cadastro inválido.{" "}
          <Link href="/#cadastro" className="font-semibold underline underline-offset-4">
            Solicitar novo link na página inicial
          </Link>
        </div>
      ) : null}

      {passwordReset ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 text-xs leading-relaxed text-foreground"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Senha alterada. Entre com a nova senha.
        </div>
      ) : null}

      {googleError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs leading-relaxed text-destructive"
        >
          {GOOGLE_ERRORS[googleError] ?? GOOGLE_ERRORS.error}
        </div>
      ) : null}

      <GoogleSignInButton from={from} placement="login" />
      <GoogleDivider />

      <form onSubmit={handlePasswordSignIn} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">
            <span>
              E-mail
              <RequiredMark />
            </span>
          </Label>
          <Input
            id="login-email"
            type="email"
            value={loginEmail}
            onChange={(e) => {
              setLoginEmail(e.target.value);
              if (loginError) setLoginError(null);
              if (missingLoginFields.email) setMissingLoginFields((m) => ({ ...m, email: false }));
            }}
            placeholder="seu@email.com"
            autoComplete="email"
            aria-invalid={missingLoginFields.email || undefined}
            aria-describedby={missingLoginFields.email ? "login-email-error" : loginError ? "login-error" : undefined}
            required
            disabled={isSigningIn}
          />
          {missingLoginFields.email ? (
            <p id="login-email-error" role="alert" className="text-xs text-destructive">
              {loginEmail.trim() ? "Informe um e-mail válido." : "Informe seu e-mail."}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">
              <span>
                Senha
                <RequiredMark />
              </span>
            </Label>
            <Link
              href={loginEmail.trim() ? `/forgot-password?email=${encodeURIComponent(loginEmail.trim())}` : "/forgot-password"}
              className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showLoginPassword ? "text" : "password"}
              value={loginPassword}
              onChange={(e) => {
                setLoginPassword(e.target.value);
                if (loginError) setLoginError(null);
                if (missingLoginFields.password) setMissingLoginFields((m) => ({ ...m, password: false }));
              }}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              aria-invalid={missingLoginFields.password || undefined}
              aria-describedby={missingLoginFields.password ? "login-password-error" : loginError ? "login-error" : undefined}
              required
              disabled={isSigningIn}
              className="pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowLoginPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showLoginPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {missingLoginFields.password ? (
            <p id="login-password-error" role="alert" className="text-xs text-destructive">
              Informe sua senha.
            </p>
          ) : null}
        </div>

        {loginError ? (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {loginError}
          </p>
        ) : null}

        <Button type="submit" disabled={isSigningIn} className="w-full gap-2 font-semibold">
          {isSigningIn ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Entrando…
            </>
          ) : (
            <>
              Entrar
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Ainda não tem conta?{" "}
          {onCreateAccount ? (
            <button
              type="button"
              onClick={onCreateAccount}
              className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline"
            >
              Criar conta grátis
            </button>
          ) : (
            <Link
              href="/#cadastro"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Criar conta grátis
            </Link>
          )}
        </p>
      </form>

      {demoAvailable ? (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">Quer só conhecer o sistema?</p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onEnterDemo}
            disabled={isDemoPending || isSigningIn}
          >
            {isDemoPending ? <Loader2 className="animate-spin" /> : null}
            Entrar na demonstração
          </Button>
        </div>
      ) : null}
    </div>
  );
}
