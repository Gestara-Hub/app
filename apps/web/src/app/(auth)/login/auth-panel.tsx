"use client";

import { useState } from "react";
import { SignupForm } from "@/features/landing";
import { cn } from "@/lib/utils";
import { LoginForm } from "./login-form";
import type { ValidateSignupTokenResult } from "../signup-actions";

export type AuthMode = "login" | "signup";

/**
 * Entrar e Criar conta na mesma tela (abas): o cadastro nao manda mais para a
 * landing. O modo vai para a URL (`?modo=criar`) para o link "Criar conta
 * gratis" da landing cair direto na aba certa.
 */
export function AuthPanel({
  from = "/dashboard",
  initialMode = "login",
  initialEmail,
  tokenValidation = null,
  demoAvailable = false,
  googleError,
  passwordReset = false,
  showTitle = true,
}: {
  from?: string;
  initialMode?: AuthMode;
  initialEmail?: string;
  tokenValidation?: ValidateSignupTokenResult | null;
  demoAvailable?: boolean;
  googleError?: string;
  passwordReset?: boolean;
  /** Titulo e subtitulo dentro do painel (a variacao pode mostrar fora). */
  showTitle?: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  /** E-mail vindo do cadastro ("Voce ja tem conta"): ja preenche o login. */
  const [loginEmail, setLoginEmail] = useState(initialEmail);

  const switchTo = (next: AuthMode, email?: string) => {
    if (email) setLoginEmail(email);
    setMode(next);
    try {
      const url = new URL(window.location.href);
      if (next === "signup") url.searchParams.set("modo", "criar");
      else url.searchParams.delete("modo");
      window.history.replaceState(null, "", url);
    } catch {
      // URL so de conveniencia.
    }
  };

  return (
    <div className="space-y-6">
      {showTitle ? (
        // As abas ja dizem Entrar e Criar conta: o titulo fica so para leitor de tela (04/11/2026).
        <div>
          <h1 className="sr-only">
            {mode === "login" ? "Entrar" : "Criar conta grátis"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login"
              ? "Acesse o painel do seu espaço."
              : "Sem cartão e sem limite de alunos."}
          </p>
        </div>
      ) : null}

      <div role="tablist" aria-label="Entrar ou criar conta" className="grid grid-cols-2 rounded-lg bg-muted p-1">
        {(
          [
            ["login", "Entrar"],
            ["signup", "Criar conta"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => switchTo(value)}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "login" ? (
        <LoginForm
          key={loginEmail ?? ""}
          from={from}
          initialEmail={loginEmail}
          tokenValidation={tokenValidation}
          demoAvailable={demoAvailable}
          googleError={googleError}
          passwordReset={passwordReset}
          onCreateAccount={() => switchTo("signup")}
        />
      ) : (
        <div className="space-y-6">
          <SignupForm idPrefix="auth-signup" onSignIn={(email) => switchTo("login", email)} />
          <p className="text-center text-xs text-muted-foreground">
            Já tem conta?{" "}
            <button
              type="button"
              onClick={() => switchTo("login")}
              className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline"
            >
              Entrar
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
