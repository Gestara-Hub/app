"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { startGoogleSignInAction } from "@/app/(auth)/signup-actions";

/** Ligado so com o app OAuth configurado (NEXT_PUBLIC_AUTH_GOOGLE_ENABLED, doc 16). */
export const googleSignInAvailable = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

/** Logo do Google nas cores oficiais (o botao segue o padrao de marca do Google). */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.73Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.3A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.3V6.6H1.27a12 12 0 0 0 0 10.8l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

/**
 * "Continuar com Google" do cadastro, do login e do convite. O servidor devolve
 * o endereco do Google e o navegador vai ate ele; a volta e a rota /auth/callback.
 */
export function GoogleSignInButton({
  from,
  invite,
  placement,
  className,
}: {
  from?: string;
  /** Token do convite: entra com a conta Google do e-mail convidado. */
  invite?: string;
  /** Onde o botao esta (para a analise de uso). */
  placement: "signup" | "login" | "invite";
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  // Ao voltar da tela do Google pelo botao "Voltar" do navegador, o bfcache restaura
  // o estado em memoria; o evento pageshow reseta o loading do botao.
  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  if (!googleSignInAvailable) return null;

  const start = async () => {
    setPending(true);
    trackEvent("google_sign_in_started", { placement });
    const result = await startGoogleSignInAction({ from, invite });
    if (result.ok) {
      window.location.assign(result.url);
      return;
    }
    setPending(false);
    toast.error(result.message);
  };

  return (
    <Button type="button" variant="outline" disabled={pending} onClick={start} className={cn("w-full gap-2", className)}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <GoogleLogo />}
      {pending ? "Abrindo o Google..." : "Continuar com Google"}
    </Button>
  );
}

/** Divisor entre o Google e o formulario por e-mail. */
export function GoogleDivider({ label = "ou com e-mail" }: { label?: string }) {
  if (!googleSignInAvailable) return null;
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
