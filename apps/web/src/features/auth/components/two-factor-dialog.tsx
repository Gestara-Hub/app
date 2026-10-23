"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmTotpEnrollmentAction,
  disableTotpAction,
  getTwoFactorStatusAction,
  startTotpEnrollmentAction,
} from "@/app/(auth)/two-factor-actions";

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "google" }
  | { kind: "off" }
  | { kind: "on" }
  | { kind: "enroll"; factorId: string; qrCode: string; secret: string }
  | { kind: "disable" };

/** Campo do codigo de 6 numeros do aplicativo. */
function CodeField({
  id,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        Código do aplicativo<span className="ml-0.5 text-destructive">*</span>
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className="text-center font-mono text-lg tracking-[0.5em] md:text-lg"
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Seguranca" no menu do usuario (doc 17): liga ou desliga a verificacao em
 * duas etapas com aplicativo autenticador. Conta so do Google nao usa: a
 * verificacao fica na conta Google.
 */
export function TwoFactorDialog({
  open,
  onOpenChange,
  startOnOpen = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ja comeca o cadastro (QR code) ao abrir, quando esta desligada (aviso de seguranca). */
  startOnOpen?: boolean;
}) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getTwoFactorStatusAction().then((status) => {
      if (!alive) return;
      if (!status.ok) setView({ kind: "error", message: status.message });
      else if (status.googleOnly) setView({ kind: "google" });
      else if (!status.enabled && startOnOpen) {
        // Aviso de seguranca: ja vai para o QR code.
        void startTotpEnrollmentAction().then((result) => {
          if (!alive) return;
          if (!result.ok) {
            toast.error(result.message);
            setView({ kind: "off" });
            return;
          }
          setView({ kind: "enroll", factorId: result.factorId, qrCode: result.qrCode, secret: result.secret });
        });
      }
      else setView({ kind: status.enabled ? "on" : "off" });
    });
    return () => {
      alive = false;
      setView({ kind: "loading" });
      setCode("");
      setError(null);
    };
  }, [open, startOnOpen]);

  const go = (next: View) => {
    setCode("");
    setError(null);
    setView(next);
  };

  const startEnrollment = () => {
    startTransition(async () => {
      const result = await startTotpEnrollmentAction();
      if (!result.ok) {
        toast.error(result.message);
        go({ kind: "off" });
        return;
      }
      go({ kind: "enroll", factorId: result.factorId, qrCode: result.qrCode, secret: result.secret });
    });
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (view.kind !== "enroll" && view.kind !== "disable") return;
    setError(null);
    startTransition(async () => {
      const result =
        view.kind === "enroll"
          ? await confirmTotpEnrollmentAction({ factorId: view.factorId, code })
          : await disableTotpAction({ code });
      if (!result.ok) {
        setError(result.message);
        setCode("");
        return;
      }
      if (view.kind === "enroll") {
        toast.success("Verificação em duas etapas ligada.");
        go({ kind: "on" });
      } else {
        toast.success("Verificação em duas etapas desligada.");
        go({ kind: "off" });
      }
    });
  };

  const copySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success("Chave copiada.");
    } catch {
      toast.error("Não foi possível copiar. Selecione a chave e copie.");
    }
  };

  const isForm = view.kind === "enroll" || view.kind === "disable";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="contents">
          <DialogHeader className="shrink-0">
            <DialogTitle>Segurança</DialogTitle>
            <DialogDescription>Verificação em duas etapas no login.</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {view.kind === "loading" ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-label="Carregando" />
              </div>
            ) : null}

            {view.kind === "error" ? <p className="text-sm text-destructive">{view.message}</p> : null}

            {view.kind === "google" ? (
              <p className="text-sm text-muted-foreground">
                Você entra pelo Google. A verificação em duas etapas fica na sua conta Google.
              </p>
            ) : null}

            {view.kind === "off" || view.kind === "on" ? (
              <div className="flex items-start gap-3 rounded-xl border border-border p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Smartphone className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Aplicativo autenticador</p>
                    <Badge variant={view.kind === "on" ? "default" : "secondary"}>
                      {view.kind === "on" ? "Ligada" : "Desligada"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {view.kind === "on"
                      ? "O login pede o código do aplicativo depois da senha."
                      : "Depois da senha, o login pede um código do celular."}
                  </p>
                </div>
              </div>
            ) : null}

            {view.kind === "enroll" ? (
              <div className="space-y-4">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Abra o Google Authenticator ou outro aplicativo autenticador.</li>
                  <li>Leia o QR code abaixo.</li>
                  <li>Digite o código que aparecer no aplicativo.</li>
                </ol>
                <div className="flex justify-center">
                  {/* QR code em SVG gerado pelo Supabase (data URL). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={view.qrCode} alt="QR code para o aplicativo autenticador" className="size-44 rounded-lg bg-white p-2" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Não consegue ler? Digite esta chave no aplicativo:</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs break-all">
                      {view.secret}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Copiar chave"
                      onClick={() => copySecret(view.secret)}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
                <CodeField id="two-factor-enroll-code" value={code} onChange={setCode} disabled={pending} error={error} />
              </div>
            ) : null}

            {view.kind === "disable" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Para desligar, digite um código do aplicativo. Depois disso, o login pede só a senha.
                </p>
                <CodeField id="two-factor-disable-code" value={code} onChange={setCode} disabled={pending} error={error} />
              </div>
            ) : null}
          </DialogBody>

          <DialogFooter className="shrink-0">
            {isForm ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => go({ kind: view.kind === "enroll" ? "off" : "on" })}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant={view.kind === "disable" ? "destructive" : "default"}
                  disabled={pending || code.length !== 6}
                >
                  {pending ? "Conferindo..." : view.kind === "enroll" ? "Ligar" : "Desligar"}
                </Button>
              </>
            ) : view.kind === "off" ? (
              <Button type="button" onClick={startEnrollment} disabled={pending} className="gap-2">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Ligar com aplicativo
              </Button>
            ) : view.kind === "on" ? (
              <Button type="button" variant="outline" onClick={() => go({ kind: "disable" })}>
                Desligar
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
